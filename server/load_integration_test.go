//go:build integration

package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fintrack/server/config"
	"fintrack/server/model"
	"fintrack/server/money"
	"fintrack/server/service"
	"fintrack/server/util"
	"fmt"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"io"
	"net/http"
	"net/http/httptest"
	"sort"
	"strings"
	"sync"
	"testing"
	"time"
)

// This is a bounded CI performance regression gate, not a production capacity claim.
// Requests go through the real router/auth/validation/transaction paths. Only the
// external identity provider is stubbed; MongoDB is the disposable replica set.
func TestConcurrentAPILoadRegression(t *testing.T) {
	ctx, _ := ledgerDB(t)
	if err := util.EnsureLedger(ctx, "USD"); err != nil {
		t.Fatal(err)
	}
	const users, writes = 8, 20
	type fixture struct {
		user              string
		account, category primitive.ObjectID
	}
	fixtures := make([]fixture, users)
	for i := range fixtures {
		user := fmt.Sprintf("load-user-%d", i)
		owned := money.WithCurrency(context.WithValue(ctx, util.UserIdKey, user), "USD")
		a, err := service.AddAccount(owned, model.Account{Name: "Load wallet", Balance: money.Must("100")})
		if err != nil {
			t.Fatal(err)
		}
		c, err := service.AddCategory(owned, model.Category{Name: "Load expense", Type: "expense"})
		if err != nil {
			t.Fatal(err)
		}
		fixtures[i] = fixture{user, a.(primitive.ObjectID), c.(primitive.ObjectID)}
	}
	auth := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		id := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
		for _, f := range fixtures {
			if id == f.user {
				_ = json.NewEncoder(w).Encode(map[string]string{"id": id})
				return
			}
		}
		w.WriteHeader(401)
	}))
	defer auth.Close()
	server := httptest.NewServer(newRouter(config.Config{Environment: "test", LedgerCurrency: "USD", SupabaseURL: auth.URL, SupabaseKey: "public-load-test", AllowedOrigins: []string{"https://app.test"}}))
	defer server.Close()
	client := &http.Client{Timeout: 10 * time.Second}
	var wg sync.WaitGroup
	var mu sync.Mutex
	durations := make([]time.Duration, 0, users*writes*2)
	errors := make(chan error, users)
	started := time.Now()
	for _, f := range fixtures {
		f := f
		wg.Add(1)
		go func() {
			defer wg.Done()
			for j := 0; j < writes; j++ {
				payload, _ := json.Marshal(map[string]interface{}{"amount": "0.10", "currency": "USD", "type": "expense", "sourceAccount": f.account.Hex(), "category": f.category.Hex(), "dateTime": "2026-01-01T00:00:00Z", "note": "Synthetic load"})
				// Repeat the same idempotency key and payload: 320 successful requests must
				// create exactly 160 postings, independent of timing.
				for retry := 0; retry < 2; retry++ {
					request, _ := http.NewRequest("POST", server.URL+"/api/transactions/add", bytes.NewReader(payload))
					request.Header.Set("Content-Type", "application/json")
					request.Header.Set("Authorization", "Bearer "+f.user)
					request.Header.Set("Idempotency-Key", fmt.Sprintf("load-%d", j))
					start := time.Now()
					response, err := client.Do(request)
					if err != nil {
						errors <- fmt.Errorf("load transport failed")
						return
					}
					_, readErr := io.Copy(io.Discard, response.Body)
					_ = response.Body.Close()
					if readErr != nil || response.StatusCode != 200 {
						errors <- fmt.Errorf("load request status %d", response.StatusCode)
						return
					}
					mu.Lock()
					durations = append(durations, time.Since(start))
					mu.Unlock()
				}
			}
		}()
	}
	wg.Wait()
	close(errors)
	for err := range errors {
		t.Error(err)
	}
	if len(durations) != users*writes*2 {
		t.Fatalf("incomplete workload: %d requests", len(durations))
	}
	for _, f := range fixtures {
		var a model.Account
		if err := util.AccountCollection.FindOne(ctx, bson.M{"_id": f.account}).Decode(&a); err != nil {
			t.Fatal(err)
		}
		count, err := util.TransactionCollection.CountDocuments(ctx, bson.M{"creator": f.user})
		if err != nil || count != writes || a.Balance != money.Must("98.00") {
			t.Fatal("load violated exact balance or idempotency")
		}
	}
	sort.Slice(durations, func(i, j int) bool { return durations[i] < durations[j] })
	p95 := durations[(len(durations)*95-1)/100]
	evidence := map[string]interface{}{"requests": len(durations), "concurrent_users": users, "postings": users * writes, "p95_ms": p95.Milliseconds(), "duration_ms": time.Since(started).Milliseconds(), "error_count": 0}
	raw, _ := json.Marshal(evidence)
	t.Log(string(raw))
	// Generous CI guard avoids depending on a particular hosted-runner SKU.
	if p95 > 2*time.Second {
		t.Fatalf("API p95 %s exceeds 2s regression budget", p95)
	}
}
