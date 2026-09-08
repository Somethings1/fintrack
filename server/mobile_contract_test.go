//go:build integration

package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fintrack/server/agent"
	"fintrack/server/model"
	"fintrack/server/money"
	"fintrack/server/service"
	"fintrack/server/util"
	"io"
	"net/http"
	"strings"
	"sync"
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

func mobileRequest(t *testing.T, app *ledgerContractApp, method, path, revision string, body any) (int, []byte) {
	t.Helper()
	raw, err := json.Marshal(body)
	if err != nil {
		t.Fatal(err)
	}
	req, err := http.NewRequest(method, app.server.URL+path, bytes.NewReader(raw))
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Authorization", "Bearer alpha")
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/vnd.fintrack.exact-v1+ndjson")
	if revision != "" {
		req.Header.Set("If-Match", `"`+revision+`"`)
	}
	resp, err := app.client.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	data, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatal(err)
	}
	return resp.StatusCode, data
}
func mobileContext() context.Context {
	return money.WithCurrency(context.WithValue(context.Background(), util.UserIdKey, "owner-a"), "USD")
}
func TestMobileExactMoneySyncKeepsLegacyContract(t *testing.T) {
	app := newLedgerContractApp(t)
	app.create("/api/accounts/add", "alpha", map[string]any{"name": "Exact wallet", "balance": "999999999999.99"}, "")
	path := "/api/accounts/get-since/1970-01-01T00:00:00Z"
	status, exact := mobileRequest(t, app, "GET", path, "", nil)
	if status != 200 || !bytes.Contains(exact, []byte(`"balance":"999999999999.99"`)) || !bytes.Contains(exact, []byte(`"_syncComplete":true`)) {
		t.Fatalf("invalid exact sync: %d %s", status, exact)
	}
	legacy := app.requireStatus("GET", path, "alpha", nil, "", 200)
	if !bytes.Contains(legacy, []byte(`"balance":999999999999.99`)) {
		t.Fatalf("legacy format changed: %s", legacy)
	}
}
func TestMobileConditionalTransactionAndProposal(t *testing.T) {
	app := newLedgerContractApp(t)
	ctx := mobileContext()
	account := app.create("/api/accounts/add", "alpha", map[string]any{"name": "Wallet", "balance": "100"}, "")
	category := app.create("/api/categories/add", "alpha", map[string]any{"name": "Food", "type": "expense"}, "")
	values := map[string]any{"amount": "10", "type": "expense", "sourceAccount": account, "category": category, "dateTime": "2026-09-08T00:00:00Z", "note": "Lunch"}
	id := app.create("/api/transactions/add", "alpha", values, "mobile-entry")
	before, err := service.GetTransactionByID(ctx, id)
	if err != nil {
		t.Fatal(err)
	}
	revision := before.LastUpdate.UTC().Format(time.RFC3339Nano)
	// The proposal carries the exact revision actually read, not a client clock.
	args := json.RawMessage(`{"operation":"update","recordId":"` + id + `","values":{"amount":"11"}}`)
	result, err := (agent.WorkspaceTools{LedgerTools: agent.LedgerTools{DB: util.DB}}).Execute(ctx, "propose_transaction", args)
	if err != nil {
		t.Fatal(err)
	}
	if result.(*agent.ChangeProposal).RecordVersion != revision {
		t.Fatal("proposal lost revision")
	}
	values["amount"] = "11"
	status, data := mobileRequest(t, app, "PUT", "/api/transactions/update/"+id, revision, values)
	if status != 200 {
		t.Fatalf("initial conditional update: %d %s", status, data)
	}
	values["amount"] = "50"
	status, _ = mobileRequest(t, app, "PUT", "/api/transactions/update/"+id, revision, values)
	if status != 412 {
		t.Fatalf("stale update status %d", status)
	}
	status, _ = mobileRequest(t, app, "DELETE", "/api/transactions/delete/"+id, revision, nil)
	if status != 412 {
		t.Fatalf("stale delete status %d", status)
	}
	wallet, err := service.GetAccountByID(ctx, account)
	if err != nil {
		t.Fatal(err)
	}
	if wallet.Balance != money.Must("89") {
		t.Fatalf("stale mutation changed balance: %s", wallet.Balance.String())
	}
	current, err := service.GetTransactionByID(ctx, id)
	if err != nil {
		t.Fatal(err)
	}
	status, _ = mobileRequest(t, app, "DELETE", "/api/transactions/delete/"+id, current.LastUpdate.UTC().Format(time.RFC3339Nano), nil)
	if status != 200 {
		t.Fatalf("current conditional delete status %d", status)
	}
	wallet, err = service.GetAccountByID(ctx, account)
	if err != nil || wallet.Balance != money.Must("100") {
		t.Fatal("delete did not reverse exactly")
	}
}
func TestMobileConditionalMetadataDomains(t *testing.T) {
	app := newLedgerContractApp(t)
	ctx := mobileContext()
	account := app.create("/api/accounts/add", "alpha", map[string]any{"name": "Wallet", "balance": "100"}, "")
	category := app.create("/api/categories/add", "alpha", map[string]any{"name": "Food", "type": "expense"}, "")
	saving := app.create("/api/savings/add", "alpha", map[string]any{"name": "Trip", "balance": "0", "goal": "100"}, "")
	subValues := map[string]any{"name": "Music", "amount": "2", "sourceAccount": account, "category": category, "startDate": "2027-01-01T00:00:00Z", "interval": "month"}
	subscription := app.create("/api/subscriptions/add", "alpha", subValues, "")
	for _, tc := range []struct {
		collection, entity, id string
		values                 map[string]any
	}{
		{"accounts", "account", account, map[string]any{"name": "Renamed", "icon": ""}},
		{"savings", "saving", saving, map[string]any{"name": "Trip", "goal": "120"}},
		{"categories", "category", category, map[string]any{"name": "Food", "type": "expense", "budget": "40"}},
		{"subscriptions", "subscription", subscription, subValues},
	} {
		t.Run(tc.entity, func(t *testing.T) {
			args := json.RawMessage(`{"entity":"` + tc.entity + `","id":"` + tc.id + `"}`)
			result, err := (agent.WorkspaceTools{LedgerTools: agent.LedgerTools{DB: util.DB}}).Execute(ctx, "find_records", args)
			if err != nil {
				t.Fatal(err)
			}
			raw, _ := json.Marshal(result)
			var found struct {
				Records []agent.Record `json:"records"`
			}
			if json.Unmarshal(raw, &found) != nil || len(found.Records) != 1 {
				t.Fatal("missing owned record")
			}
			revision := found.Records[0].LastUpdate.UTC().Format(time.RFC3339Nano)
			status, data := mobileRequest(t, app, "PUT", "/api/"+tc.collection+"/update/"+tc.id, revision, tc.values)
			if status != 200 {
				t.Fatalf("conditional metadata update: %d %s", status, data)
			}
			status, _ = mobileRequest(t, app, "PUT", "/api/"+tc.collection+"/update/"+tc.id, revision, tc.values)
			if status != 412 {
				t.Fatalf("stale metadata update accepted: %d", status)
			}
			status, _ = mobileRequest(t, app, "DELETE", "/api/"+tc.collection+"/delete/"+tc.id, revision, nil)
			if status != 412 {
				t.Fatalf("stale metadata archival accepted: %d", status)
			}
		})
	}
}
func TestMobileConcurrentRevisionOnlyOneWins(t *testing.T) {
	resetTestDatabase(t)
	ctx := mobileContext()
	id, err := service.AddAccount(ctx, model.Account{Name: "Wallet", Balance: money.Must("10")})
	if err != nil {
		t.Fatal(err)
	}
	oid := id.(primitive.ObjectID)
	row, err := service.GetAccountByID(ctx, oid.Hex())
	if err != nil {
		t.Fatal(err)
	}
	expected := util.WithExpectedVersion(ctx, row.LastUpdate)
	var wg sync.WaitGroup
	results := make(chan error, 2)
	for _, name := range []string{"Phone", "Web"} {
		wg.Add(1)
		go func(name string) {
			defer wg.Done()
			results <- service.UpdateAccount(expected, oid, model.Account{Name: name})
		}(name)
	}
	wg.Wait()
	close(results)
	passed, conflicts := 0, 0
	for err := range results {
		if err == nil {
			passed++
		} else if errors.Is(err, util.ErrPrecondition) {
			conflicts++
		} else {
			t.Fatal(err)
		}
	}
	if passed != 1 || conflicts != 1 {
		t.Fatalf("race admitted %d writes and %d conflicts", passed, conflicts)
	}
	// Foreign callers cannot use the revision to mutate this row.
	other := money.WithCurrency(context.WithValue(expected, util.UserIdKey, "owner-b"), "USD")
	if service.UpdateAccount(other, oid, model.Account{Name: "FOREIGN"}) == nil {
		t.Fatal("foreign revision changed owned record")
	}
	row, err = service.GetAccountByID(ctx, oid.Hex())
	if err != nil || strings.Contains(row.Name, "FOREIGN") || row.Balance != money.Must("10") {
		t.Fatal("conditional metadata changed ledger")
	}
}
