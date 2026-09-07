//go:build integration

package main

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"fintrack/server/config"
	"fintrack/server/util"
	"github.com/google/uuid"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"
)

type ledgerContractApp struct {
	t      *testing.T
	server *httptest.Server
	client *http.Client
}

// Each test owns a fresh database, not the shared public schema. The exact
// loopback fixture URL is checked before opening any connection or executing DDL.
func resetTestDatabase(t *testing.T) string {
	t.Helper()
	const fixtureURL = "postgres://fintrack:fintrack@127.0.0.1:55432/fintrack?sslmode=disable"
	if os.Getenv("DATABASE_TEST_URL") != fixtureURL {
		t.Fatal("DATABASE_TEST_URL must be the disposable loopback PostgreSQL fixture")
	}
	_ = util.CloseDB()
	admin, err := sql.Open("pgx", fixtureURL)
	if err != nil {
		t.Fatal(err)
	}
	name := "fintrack_test_" + strings.ReplaceAll(uuid.NewString(), "-", "")
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	if _, err := admin.ExecContext(ctx, `CREATE DATABASE "`+name+`"`); err != nil {
		admin.Close()
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_ = util.CloseDB()
		cleanup, stop := context.WithTimeout(context.Background(), 10*time.Second)
		defer stop()
		if _, err := admin.ExecContext(cleanup, `DROP DATABASE "`+name+`" WITH (FORCE)`); err != nil {
			t.Errorf("cleanup test database: %v", err)
		}
		_ = admin.Close()
	})
	url := strings.Replace(fixtureURL, "/fintrack?", "/"+name+"?", 1)
	if err := util.InitDB(ctx, url); err != nil {
		t.Fatal(err)
	}
	if err := util.EnsureLedger(ctx, "USD"); err != nil {
		t.Fatal(err)
	}
	return url
}

func newLedgerContractApp(t *testing.T) *ledgerContractApp {
	t.Helper()
	resetTestDatabase(t)
	auth := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		user := map[string]string{"Bearer alpha": "owner-a", "Bearer beta": "owner-b"}[r.Header.Get("Authorization")]
		if user == "" {
			w.WriteHeader(401)
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]string{"id": user})
	}))
	server := httptest.NewServer(newRouter(config.Config{Environment: "test", SupabaseURL: auth.URL, SupabaseKey: "public-contract-test", AllowedOrigins: []string{"https://app.test"}, LedgerCurrency: "USD"}))
	app := &ledgerContractApp{t: t, server: server, client: &http.Client{Timeout: 15 * time.Second}}
	t.Cleanup(func() { server.Close(); auth.Close(); _ = util.CloseDB() })
	return app
}
func (a *ledgerContractApp) request(method, path, token string, body interface{}, key string) (int, []byte) {
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
	if key != "" {
		req.Header.Set("Idempotency-Key", key)
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
func (a *ledgerContractApp) requireStatus(method, path, token string, body interface{}, key string, want int) []byte {
	a.t.Helper()
	status, data := a.request(method, path, token, body, key)
	if status != want {
		a.t.Fatalf("%s %s returned %d, want %d: %s", method, path, status, want, data)
	}
	return data
}
func (a *ledgerContractApp) create(path, token string, body interface{}, key string) string {
	a.t.Helper()
	data := a.requireStatus(http.MethodPost, path, token, body, key, 200)
	var result struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(data, &result); err != nil || result.ID == "" {
		a.t.Fatalf("missing create id in %s: %v", data, err)
	}
	return result.ID
}
