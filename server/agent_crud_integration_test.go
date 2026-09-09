//go:build integration

package main

import (
	"context"
	"encoding/json"
	"fintrack/server/agent"
	"fintrack/server/money"
	"fintrack/server/util"
	"net/http"
	"reflect"
	"strings"
	"testing"
	"time"
)

func TestAgentCRUDProposalsUseExistingHTTPContracts(t *testing.T) {
	app := newLedgerContractApp(t)
	ctx := money.WithCurrency(context.WithValue(context.Background(), util.UserIdKey, "owner-a"), "USD")
	now := time.Date(2026, 9, 7, 12, 0, 0, 0, time.UTC)
	tools := agent.WorkspaceTools{LedgerTools: agent.LedgerTools{DB: util.DB, Now: func() time.Time { return now }}}
	state := func() []string {
		t.Helper()
		out := []string{}
		for _, table := range []string{"financial_accounts", "categories", "transactions", "subscriptions", "notifications"} {
			var raw string
			if err := util.DB.QueryRow(`SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY id),'[]'::jsonb)::text FROM ` + table + ` r`).Scan(&raw); err != nil {
				t.Fatal(err)
			}
			out = append(out, raw)
		}
		return out
	}
	propose := func(entity, operation, id string, values map[string]any) *agent.ChangeProposal {
		t.Helper()
		before := state()
		raw, _ := json.Marshal(map[string]any{"operation": operation, "recordId": id, "values": values})
		result, err := tools.Execute(ctx, "propose_"+entity, raw)
		if err != nil {
			t.Fatalf("propose %s %s: %v", entity, operation, err)
		}
		p, ok := result.(*agent.ChangeProposal)
		if !ok {
			t.Fatalf("not a typed proposal: %T", result)
		}
		if !reflect.DeepEqual(before, state()) {
			t.Fatal("preparing a proposal mutated the ledger")
		}
		return p
	}
	collections := map[string]string{"account": "accounts", "saving": "savings", "category": "categories", "transaction": "transactions", "subscription": "subscriptions"}
	apply := func(p *agent.ChangeProposal) string {
		t.Helper()
		path := "/api/" + collections[p.Entity]
		method := http.MethodPost
		key := ""
		var body any = p.Values
		switch p.Operation {
		case "create":
			path += "/add"
			if p.Entity == "transaction" {
				key = p.ID
			}
		case "update":
			method = http.MethodPut
			path += "/update/" + p.RecordID
		case "delete":
			method = http.MethodDelete
			path += "/delete/" + p.RecordID
			body = nil
		}
		data := app.requireStatus(method, path, "alpha", body, key, 200)
		if p.Operation != "create" {
			return p.RecordID
		}
		var result struct {
			ID string `json:"id"`
		}
		if err := json.Unmarshal(data, &result); err != nil || result.ID == "" {
			t.Fatalf("missing created ID: %s", data)
		}
		return result.ID
	}
	balance := func(id string, want money.Amount) {
		t.Helper()
		var n int64
		if err := util.DB.QueryRow(`SELECT balance_micros FROM financial_accounts WHERE id=$1`, id).Scan(&n); err != nil {
			t.Fatal(err)
		}
		if money.Amount(n) != want {
			t.Fatalf("balance=%d want=%s", n, want)
		}
	}
	account := apply(propose("account", "create", "", map[string]any{"name": "Chat Wallet", "balance": "100"}))
	category := apply(propose("category", "create", "", map[string]any{"name": "Food", "type": "expense"}))
	saving := apply(propose("saving", "create", "", map[string]any{"name": "Trip", "goal": "50"}))
	tx := propose("transaction", "create", "", map[string]any{"type": "expense", "amount": "0.30", "sourceAccount": account, "category": category, "note": "Lunch"})
	transaction := apply(tx)
	balance(account, money.Must("99.7"))
	// An identical confirmation still uses normal transaction idempotency.
	if apply(tx) != transaction {
		t.Fatal("idempotent replay created another transaction")
	}
	balance(account, money.Must("99.7"))
	edit := propose("transaction", "update", transaction, map[string]any{"amount": "0.20"})
	var preserved string
	_ = json.Unmarshal(edit.Values["note"], &preserved)
	if preserved != "Lunch" {
		t.Fatal("partial update lost note")
	}
	apply(edit)
	balance(account, money.Must("99.8"))
	apply(propose("transaction", "delete", transaction, nil))
	balance(account, money.Must("100"))
	transfer := apply(propose("transaction", "create", "", map[string]any{"type": "transfer", "amount": "10", "sourceAccount": account, "destinationAccount": saving}))
	balance(account, money.Must("90"))
	balance(saving, money.Must("10"))
	apply(propose("transaction", "delete", transfer, nil))
	balance(account, money.Must("100"))
	balance(saving, 0)
	apply(propose("account", "update", account, map[string]any{"name": "Renamed Wallet"}))
	apply(propose("saving", "update", saving, map[string]any{"goal": "75", "goalDate": "2027-02-01T00:00:00Z"}))
	apply(propose("category", "update", category, map[string]any{"name": "Dining"}))
	apply(propose("budget", "set", category, map[string]any{"budget": "250"}))
	var budget int64
	var deleted bool
	if err := util.DB.QueryRow(`SELECT budget_micros,is_deleted FROM categories WHERE id=$1`, category).Scan(&budget, &deleted); err != nil {
		t.Fatal(err)
	}
	if money.Amount(budget) != money.Must("250") || deleted {
		t.Fatal("budget set changed category semantics")
	}
	apply(propose("budget", "clear", category, nil))
	if err := util.DB.QueryRow(`SELECT budget_micros,is_deleted FROM categories WHERE id=$1`, category).Scan(&budget, &deleted); err != nil {
		t.Fatal(err)
	}
	if budget != 0 || deleted {
		t.Fatal("clearing a budget deleted the category")
	}
	sub := apply(propose("subscription", "create", "", map[string]any{"name": "Music", "amount": "5", "sourceAccount": account, "category": category, "startDate": "2026-10-01T00:00:00Z", "interval": "month"}))
	apply(propose("subscription", "update", sub, map[string]any{"amount": "6", "remindBefore": 3}))
	apply(propose("subscription", "delete", sub, nil))
	for _, tc := range []struct{ entity, id string }{{"saving", saving}, {"category", category}, {"account", account}} {
		apply(propose(tc.entity, "delete", tc.id, nil))
	}
}

func TestAgentRecordDiscoveryAndInvalidChanges(t *testing.T) {
	app := newLedgerContractApp(t)
	ctx := money.WithCurrency(context.WithValue(context.Background(), util.UserIdKey, "owner-a"), "USD")
	tools := agent.WorkspaceTools{LedgerTools: agent.LedgerTools{DB: util.DB}}
	account := app.create("/api/accounts/add", "alpha", map[string]any{"name": "Owned", "balance": "20"}, "")
	foreign := app.create("/api/accounts/add", "beta", map[string]any{"name": "FOREIGN SECRET", "balance": "500"}, "")
	category := app.create("/api/categories/add", "alpha", map[string]any{"name": "Food", "type": "expense"}, "")
	for _, tc := range []struct{ name, args string }{
		{"propose_account", `{"operation":"update","recordId":"` + account + `","values":{"balance":"999"}}`},
		{"propose_account", `{"operation":"delete","recordId":"` + foreign + `"}`},
		{"propose_account", `{"operation":"create","values":{"name":"x","balance":"-1"}}`},
		{"propose_transaction", `{"operation":"create","values":{"type":"expense","amount":"1","sourceAccount":"` + foreign + `","category":"` + category + `"}}`},
		{"propose_transaction", `{"operation":"create","values":{"type":"expense","amount":"0.001","sourceAccount":"` + account + `","category":"` + category + `"}}`},
		{"propose_category", `{"operation":"update","recordId":"` + category + `","values":{"type":"income"}}`},
	} {
		if _, err := tools.Execute(ctx, tc.name, json.RawMessage(tc.args)); err == nil {
			t.Fatalf("unsafe proposal accepted: %s", tc.args)
		}
	}
	for _, query := range []string{`{"entity":"account"}`, `{"entity":"account","id":"` + foreign + `"}`, `{"entity":"account","query":"%' OR true --"}`} {
		result, err := tools.Execute(ctx, "find_records", json.RawMessage(query))
		if err != nil {
			t.Fatal(err)
		}
		raw, _ := json.Marshal(result)
		if strings.Contains(string(raw), "FOREIGN SECRET") {
			t.Fatal("record search leaked another owner's data")
		}
	}
	// More than one page; IDs, not OFFSET or names, drive continuation.
	_, err := util.DB.Exec(`INSERT INTO financial_accounts(id,owner,kind,currency,opening_balance_micros,balance_micros,name) SELECT lpad(to_hex(n),24,'0'),'owner-a','account','USD',0,0,'Paged' FROM generate_series(1,30)n`)
	if err != nil {
		t.Fatal(err)
	}
	result, err := tools.Execute(ctx, "find_records", json.RawMessage(`{"entity":"account","query":"Paged"}`))
	if err != nil {
		t.Fatal(err)
	}
	page := result.(map[string]any)
	records := page["records"].([]agent.Record)
	if len(records) != 25 || page["hasMore"] != true {
		t.Fatalf("invalid first page: %+v", page)
	}
	cursor := page["nextAfterId"].(string)
	result, err = tools.Execute(ctx, "find_records", json.RawMessage(`{"entity":"account","query":"Paged","afterId":"`+cursor+`"}`))
	if err != nil {
		t.Fatal(err)
	}
	page = result.(map[string]any)
	if len(page["records"].([]agent.Record)) != 5 || page["hasMore"] != false {
		t.Fatal("invalid continuation page")
	}
}
