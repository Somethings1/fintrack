//go:build integration

package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fintrack/server/config"
	"fintrack/server/model"
	"fintrack/server/money"
	"fintrack/server/socket"
	"fintrack/server/util"
	"fmt"
	"github.com/gorilla/websocket"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"sync"
	"testing"
	"time"
)

func TestIntegrationFinancialIsolationAndSync(t *testing.T) {
	uri := os.Getenv("MONGO_TEST_URI")
	if uri == "" {
		t.Fatal("MONGO_TEST_URI is required for explicitly requested integration tests")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
	defer cancel()
	database := "fintrack_ci_" + primitive.NewObjectID().Hex()
	if err := util.InitDB(ctx, uri, database); err != nil {
		t.Fatal(err)
	}
	defer func() {
		cleanup, stop := context.WithTimeout(context.Background(), 10*time.Second)
		defer stop()
		socket.Manager.Close()
		_ = util.MongoClient.Database(database).Drop(cleanup)
		_ = util.MongoClient.Disconnect(cleanup)
	}()
	auth := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		user := map[string]string{"Bearer alpha": "owner-a", "Bearer beta": "owner-b"}[r.Header.Get("Authorization")]
		if user == "" {
			w.WriteHeader(401)
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]string{"id": user})
	}))
	defer auth.Close()
	server := httptest.NewServer(newRouter(config.Config{Environment: "test", SupabaseURL: auth.URL, SupabaseKey: "public-test", AllowedOrigins: []string{"https://app.test"}}))
	defer server.Close()
	client := &http.Client{Timeout: 15 * time.Second}
	request := func(method, path, token string, body interface{}, key string) (int, []byte, http.Header) {
		raw, _ := json.Marshal(body)
		req, err := http.NewRequest(method, server.URL+path, bytes.NewReader(raw))
		if err != nil {
			t.Fatal(err)
		}
		req.Header.Set("Content-Type", "application/json")
		if token != "" {
			req.Header.Set("Authorization", "Bearer "+token)
		}
		if key != "" {
			req.Header.Set("Idempotency-Key", key)
		}
		resp, err := client.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		defer resp.Body.Close()
		data, err := io.ReadAll(io.LimitReader(resp.Body, 2<<20))
		if err != nil {
			t.Fatal(err)
		}
		return resp.StatusCode, data, resp.Header
	}
	create := func(path, token string, body interface{}, key string) string {
		status, data, _ := request("POST", path, token, body, key)
		if status != 200 {
			t.Fatalf("%s: %d %s", path, status, data)
		}
		var result struct {
			ID string `json:"id"`
		}
		if json.Unmarshal(data, &result) != nil || result.ID == "" {
			t.Fatalf("missing id: %s", data)
		}
		return result.ID
	}
	checkStatus := func(method, path, token string, body interface{}, key string, want int) {
		t.Helper()
		status, data, _ := request(method, path, token, body, key)
		if status != want {
			t.Fatalf("%s %s: %d want %d: %s", method, path, status, want, data)
		}
	}
	checkStatus("GET", "/livez", "", nil, "", 200)
	checkStatus("GET", "/readyz", "", nil, "", 200)
	checkStatus("POST", "/api/accounts/add", "", map[string]interface{}{}, "", 403) // no ambient-cookie origin
	checkStatus("POST", "/api/agent/draft", "alpha", map[string]interface{}{"input": "test", "consent": true}, "", 503)
	accountA := create("/api/accounts/add", "alpha", map[string]interface{}{"name": "Wallet A", "owner": "owner-b", "balance": 1000, "icon": "W"}, "")
	accountB := create("/api/accounts/add", "beta", map[string]interface{}{"name": "Wallet B", "balance": 200, "icon": "W"}, "")
	categoryA := create("/api/categories/add", "alpha", map[string]interface{}{"name": "Food", "owner": "owner-b", "type": "expense", "budget": 100, "icon": "F"}, "")
	checkStatus("PUT", "/api/accounts/update/"+accountA, "beta", map[string]interface{}{"name": "hijack", "balance": 0}, "", 404)
	balance := func(id string) float64 {
		objectID, _ := primitive.ObjectIDFromHex(id)
		var account model.Account
		if err := util.AccountCollection.FindOne(ctx, bson.M{"_id": objectID}).Decode(&account); err != nil {
			t.Fatal(err)
		}
		return float64(account.Balance) / float64(money.Scale)
	}
	expense := map[string]interface{}{"creator": "owner-b", "amount": 10, "dateTime": "2026-09-01T12:00:00Z", "type": "expense", "sourceAccount": accountA, "category": categoryA, "note": "Lunch"}
	first := create("/api/transactions/add", "alpha", expense, "first-request")
	replay := create("/api/transactions/add", "alpha", expense, "first-request")
	if first != replay || balance(accountA) != 990 {
		t.Fatal("replay duplicated a transaction or changed balance")
	}
	// Switching transaction type must clear the now-inapplicable account side.
	incomeCategory := create("/api/categories/add", "alpha", map[string]interface{}{"name": "Income", "type": "income", "budget": 0, "icon": "I"}, "")
	income := map[string]interface{}{"amount": 15, "dateTime": "2026-09-01T12:00:00Z", "type": "income", "destinationAccount": accountA, "category": incomeCategory, "note": "Correction"}
	checkStatus("PUT", "/api/transactions/update/"+first, "alpha", income, "", 200)
	if balance(accountA) != 1015 {
		t.Fatal("expense-to-income correction did not reverse and reapply balances")
	}
	transactionID, _ := primitive.ObjectIDFromHex(first)
	var corrected model.Transaction
	if err := util.TransactionCollection.FindOne(ctx, bson.M{"_id": transactionID}).Decode(&corrected); err != nil || !corrected.SourceAccount.IsZero() {
		t.Fatalf("income retained its old expense source: %v", err)
	}
	checkStatus("PUT", "/api/transactions/update/"+first, "alpha", expense, "", 200)
	corrected = model.Transaction{}
	if err := util.TransactionCollection.FindOne(ctx, bson.M{"_id": transactionID}).Decode(&corrected); err != nil || !corrected.DestinationAccount.IsZero() || balance(accountA) != 990 {
		t.Fatalf("expense retained its old income destination or wrong balance: %v", err)
	}
	expense["amount"] = 11
	checkStatus("POST", "/api/transactions/add", "alpha", expense, "first-request", 409)
	expense["sourceAccount"] = accountB
	checkStatus("POST", "/api/transactions/add", "alpha", expense, "", 400)
	if balance(accountB) != 200 {
		t.Fatal("foreign balance modified")
	}
	expense["sourceAccount"] = accountA
	expense["amount"] = 3
	// Concurrent retries must return one identity and apply the balance exactly once.
	raw, _ := json.Marshal(expense)
	var wg sync.WaitGroup
	ids := make(chan string, 8)
	failures := make(chan error, 8)
	for i := 0; i < 8; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			req, _ := http.NewRequest("POST", server.URL+"/api/transactions/add", bytes.NewReader(raw))
			req.Header.Set("Authorization", "Bearer alpha")
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("Idempotency-Key", "concurrent-request")
			resp, err := client.Do(req)
			if err != nil {
				failures <- err
				return
			}
			defer resp.Body.Close()
			var result struct {
				ID string `json:"id"`
			}
			if resp.StatusCode != 200 {
				failures <- fmt.Errorf("concurrent create status %d", resp.StatusCode)
				return
			}
			if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
				failures <- err
				return
			}
			ids <- result.ID
		}()
	}
	wg.Wait()
	close(ids)
	close(failures)
	for err := range failures {
		t.Error(err)
	}
	if t.Failed() {
		return
	}
	concurrentID := ""
	for id := range ids {
		if id == "" {
			t.Fatal("empty concurrent id")
		}
		if concurrentID != "" && concurrentID != id {
			t.Fatal("concurrent duplicate")
		}
		concurrentID = id
	}
	if balance(accountA) != 987 {
		t.Fatalf("concurrent balance=%v", balance(accountA))
	}
	checkStatus("DELETE", "/api/accounts/delete/"+accountA, "alpha", nil, "", 409)
	checkStatus("DELETE", "/api/categories/delete/"+categoryA, "alpha", nil, "", 409)
	checkStatus("DELETE", "/api/transactions/delete/"+first, "alpha", nil, "", 200)
	checkStatus("DELETE", "/api/transactions/delete/"+first, "alpha", nil, "", 404)
	if balance(accountA) != 997 {
		t.Fatal("repeated deletion reversed balance again")
	}
	checkStatus("DELETE", "/api/transactions/delete/"+concurrentID, "alpha", nil, "", 200)
	if balance(accountA) != 1000 {
		t.Fatal("balance not restored")
	}
	checkStatus("DELETE", "/api/accounts/delete/"+accountA, "alpha", nil, "", 200)
	// Bulk notification updates cannot affect another owner.
	a, b := primitive.NewObjectID(), primitive.NewObjectID()
	_, err := util.NotificationCollection.InsertMany(ctx, []interface{}{model.Notification{ID: a, Owner: "owner-a", LastUpdate: time.Now()}, model.Notification{ID: b, Owner: "owner-b", LastUpdate: time.Now()}})
	if err != nil {
		t.Fatal(err)
	}
	checkStatus("PUT", "/api/notifications/mark-read", "alpha", map[string]interface{}{"ids": []string{a.Hex(), b.Hex()}}, "", 204)
	var foreign model.Notification
	if err := util.NotificationCollection.FindOne(ctx, bson.M{"_id": b}).Decode(&foreign); err != nil || foreign.Read {
		t.Fatal("cross-owner notification update")
	}
	// Same-timestamp records across a page boundary must not be lost or duplicated.
	rows := make([]interface{}, 505)
	now := time.Now().UTC().Truncate(time.Millisecond)
	for i := range rows {
		rows[i] = model.Account{ID: primitive.NewObjectID(), Owner: "owner-a", Name: "Page", LastUpdate: now}
	}
	if _, err := util.AccountCollection.InsertMany(ctx, rows); err != nil {
		t.Fatal(err)
	}
	seen := map[string]bool{}
	cursor := ""
	pages := 0
	for {
		path := "/api/accounts/get-since/1970-01-01T00:00:00Z"
		if cursor != "" {
			path += "?cursor=" + cursor
		}
		status, data, _ := request("GET", path, "alpha", nil, "")
		if status != 200 {
			t.Fatalf("sync status %d", status)
		}
		decoder := json.NewDecoder(bytes.NewReader(data))
		complete := false
		cursor = ""
		for decoder.More() {
			var item map[string]interface{}
			if err := decoder.Decode(&item); err != nil {
				t.Fatal(err)
			}
			if item["_syncComplete"] == true {
				complete = true
				cursor, _ = item["nextCursor"].(string)
				continue
			}
			id, _ := item["_id"].(string)
			if id == "" || seen[id] || item["owner"] != "owner-a" {
				t.Fatal("invalid or cross-owner sync record")
			}
			seen[id] = true
		}
		if !complete {
			t.Fatal("sync missing completion marker")
		}
		pages++
		if cursor == "" {
			break
		}
		if pages > 3 {
			t.Fatal("unbounded pagination")
		}
	}
	if len(seen) != 506 || pages != 2 {
		t.Fatalf("sync records=%d pages=%d", len(seen), pages)
	}
	// Cookie transport and WebSocket origin enforcement.
	status, _, headers := request("POST", "/api/session", "alpha", nil, "")
	if status != 204 {
		t.Fatal("session creation failed")
	}
	cookie := headers.Get("Set-Cookie")
	if !strings.Contains(cookie, "HttpOnly") || !strings.Contains(cookie, "Path=/api") || !strings.Contains(cookie, "SameSite=Strict") {
		t.Fatal("cookie attributes missing")
	}
	wsURL := "ws" + strings.TrimPrefix(server.URL, "http") + "/api/ws"
	bad := http.Header{"Authorization": []string{"Bearer alpha"}, "Origin": []string{"https://evil.test"}}
	conn, response, err := websocket.DefaultDialer.Dial(wsURL, bad)
	if conn != nil {
		conn.Close()
		t.Fatal("foreign origin connected")
	}
	if err == nil || response == nil || response.StatusCode != 403 {
		t.Fatal("foreign WebSocket origin not rejected")
	}
	response.Body.Close()
	good := http.Header{"Authorization": []string{"Bearer alpha"}, "Origin": []string{"https://app.test"}}
	conn, _, err = websocket.DefaultDialer.Dial(wsURL, good)
	if err != nil {
		t.Fatal(err)
	}
	_ = conn.SetReadDeadline(time.Now().Add(2 * time.Second))
	var hello map[string]string
	if conn.ReadJSON(&hello) != nil || hello["type"] != "init" || hello["clientId"] == "" {
		t.Fatal("socket initialization failed")
	}
	conn.Close()
}
