//go:build integration

package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fintrack/server/config"
	"fintrack/server/util"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"
)

type ledgerContractApp struct {
	t      *testing.T
	server *httptest.Server
	client *http.Client
}

func newLedgerContractApp(t *testing.T) *ledgerContractApp {
	t.Helper()
	uri := os.Getenv("MONGO_TEST_URI")
	if uri == "" {
		t.Fatal("MONGO_TEST_URI is required for database contract tests")
	}

	initCtx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	database := fmt.Sprintf("fintrack_contract_%d", time.Now().UnixNano())
	if err := util.InitDB(initCtx, uri, database); err != nil {
		cancel()
		t.Fatal(err)
	}
	if err := util.EnsureLedger(initCtx, "USD"); err != nil {
		cancel()
		t.Fatal(err)
	}
	cancel()

	auth := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		user := map[string]string{
			"Bearer alpha": "owner-a",
			"Bearer beta":  "owner-b",
		}[r.Header.Get("Authorization")]
		if user == "" {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]string{"id": user})
	}))

	server := httptest.NewServer(newRouter(config.Config{
		Environment:    "test",
		SupabaseURL:    auth.URL,
		SupabaseKey:    "public-contract-test",
		AllowedOrigins: []string{"https://app.test"},
		LedgerCurrency: "USD",
	}))

	app := &ledgerContractApp{
		t:      t,
		server: server,
		client: &http.Client{Timeout: 15 * time.Second},
	}

	t.Cleanup(func() {
		server.Close()
		auth.Close()
		cleanup, stop := context.WithTimeout(context.Background(), 10*time.Second)
		defer stop()
		if util.MongoClient != nil {
			_ = util.MongoClient.Database(database).Drop(cleanup)
			_ = util.MongoClient.Disconnect(cleanup)
		}
	})
	return app
}

func (a *ledgerContractApp) request(method, path, token string, body interface{}, idempotencyKey string) (int, []byte) {
	a.t.Helper()
	var raw []byte
	var err error
	if body != nil {
		raw, err = json.Marshal(body)
		if err != nil {
			a.t.Fatal(err)
		}
	}
	req, err := http.NewRequest(method, a.server.URL+path, bytes.NewReader(raw))
	if err != nil {
		a.t.Fatal(err)
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	if idempotencyKey != "" {
		req.Header.Set("Idempotency-Key", idempotencyKey)
	}
	resp, err := a.client.Do(req)
	if err != nil {
		a.t.Fatal(err)
	}
	defer resp.Body.Close()
	data, err := io.ReadAll(io.LimitReader(resp.Body, 2<<20))
	if err != nil {
		a.t.Fatal(err)
	}
	return resp.StatusCode, data
}

func (a *ledgerContractApp) requireStatus(method, path, token string, body interface{}, idempotencyKey string, want int) []byte {
	a.t.Helper()
	status, data := a.request(method, path, token, body, idempotencyKey)
	if status != want {
		a.t.Fatalf("%s %s returned %d, want %d: %s", method, path, status, want, data)
	}
	return data
}

func (a *ledgerContractApp) create(path, token string, body interface{}, idempotencyKey string) string {
	a.t.Helper()
	data := a.requireStatus(http.MethodPost, path, token, body, idempotencyKey, http.StatusOK)
	var result struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(data, &result); err != nil || result.ID == "" {
		a.t.Fatalf("missing create id in %s: %v", data, err)
	}
	return result.ID
}
