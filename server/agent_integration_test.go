//go:build integration

package main

import (
	"context"
	"encoding/json"
	"fintrack/server/agent"
	"fintrack/server/model"
	"fintrack/server/money"
	"fintrack/server/service"
	"fintrack/server/util"
	"reflect"
	"strings"
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

func TestAgentToolsReadOwnedPostgresDataWithoutMutations(t *testing.T) {
	resetTestDatabase(t)
	ctx := money.WithCurrency(context.WithValue(context.Background(), util.UserIdKey, "agent-owner"), "USD")
	now := time.Date(2026, 9, 7, 12, 0, 0, 0, time.UTC)
	mustID := func(id any, err error) primitive.ObjectID {
		t.Helper()
		if err != nil {
			t.Fatal(err)
		}
		return id.(primitive.ObjectID)
	}
	account := mustID(service.AddAccount(ctx, model.Account{Name: "Agent Wallet", Balance: money.Must("100")}))
	saving := mustID(service.AddSaving(ctx, model.Saving{Name: "Trip", Balance: money.Must("20"), Goal: money.Must("50"), GoalDate: now.AddDate(0, 3, 0)}))
	food := mustID(service.AddCategory(ctx, model.Category{Name: "Food", Type: "expense", Budget: money.Must("50")}))
	salary := mustID(service.AddCategory(ctx, model.Category{Name: "Salary", Type: "income"}))
	addExpense := func(amount string, date time.Time) primitive.ObjectID {
		return mustID(service.AddTransaction(ctx, model.Transaction{Amount: money.Must(amount), DateTime: date, Type: "expense", SourceAccount: account, Category: food, Note: "private note excluded from summaries"}))
	}
	addExpense("0.1", now)
	addExpense("0.2", now)
	_ = mustID(service.AddTransaction(ctx, model.Transaction{Amount: money.Must("10"), DateTime: now, Type: "income", DestinationAccount: account, Category: salary}))
	_ = mustID(service.AddTransaction(ctx, model.Transaction{Amount: money.Must("5"), DateTime: now, Type: "transfer", SourceAccount: account, DestinationAccount: saving}))
	deleted := addExpense("7", now)
	if err := service.DeleteTransaction(ctx, deleted); err != nil {
		t.Fatal(err)
	}
	addExpense("1", time.Date(2026, 8, 31, 23, 59, 59, 0, time.UTC))
	_ = mustID(service.AddTransaction(ctx, model.Transaction{Amount: money.Must("9"), DateTime: time.Date(2026, 10, 1, 0, 0, 0, 0, time.UTC), Type: "income", DestinationAccount: account, Category: salary}))
	archived := mustID(service.AddAccount(ctx, model.Account{Name: "Archived", Balance: money.Must("99")}))
	if err := service.DeleteAccount(ctx, archived); err != nil {
		t.Fatal(err)
	}
	for _, sub := range []struct {
		name, amount string
		start        time.Time
	}{
		{"Next payment only", "3", now.AddDate(0, 0, 1)},
		{"Overdue", "2", now.AddDate(0, 0, -1)},
		{"Beyond horizon", "99", now.AddDate(0, 2, 0)},
	} {
		_ = mustID(service.AddSubscription(ctx, model.Subscription{Name: sub.name, Amount: money.Must(sub.amount), SourceAccount: account, Category: food, StartDate: sub.start, Interval: "day"}))
	}
	other := money.WithCurrency(context.WithValue(context.Background(), util.UserIdKey, "other-owner"), "USD")
	otherAccount := mustID(service.AddAccount(other, model.Account{Name: "FOREIGN SECRET", Balance: money.Must("1000")}))
	otherCategory := mustID(service.AddCategory(other, model.Category{Name: "FOREIGN SECRET", Type: "expense"}))
	_ = mustID(service.AddTransaction(other, model.Transaction{Amount: money.Must("25"), DateTime: now, Type: "expense", SourceAccount: otherAccount, Category: otherCategory}))
	_ = mustID(service.AddSaving(other, model.Saving{Name: "FOREIGN SECRET", Goal: money.Must("999")}))
	_ = mustID(service.AddSubscription(other, model.Subscription{Name: "FOREIGN SECRET", Amount: money.Must("777"), SourceAccount: otherAccount, Category: otherCategory, StartDate: now.AddDate(0, 0, 2), Interval: "month"}))

	// Compare complete persisted rows before/after all tools, not just balances.
	state := func() []string {
		t.Helper()
		out := []string{}
		for _, table := range []string{"financial_accounts", "transactions", "categories", "subscriptions", "notifications"} {
			var raw string
			if err := util.DB.QueryRow(`SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY id),'[]'::jsonb)::text FROM ` + table + ` r`).Scan(&raw); err != nil {
				t.Fatal(err)
			}
			out = append(out, raw)
		}
		return out
	}
	before := state()
	tools := agent.LedgerTools{DB: util.DB, Now: func() time.Time { return now }}
	run := func(name, args string) map[string]any {
		t.Helper()
		result, err := tools.Execute(ctx, name, json.RawMessage(args))
		if err != nil {
			t.Fatal(err)
		}
		raw, err := json.Marshal(result)
		if err != nil {
			t.Fatal(err)
		}
		if strings.Contains(string(raw), "FOREIGN SECRET") || strings.Contains(string(raw), "private note") {
			t.Fatal("tool leaked unrelated data")
		}
		var decoded map[string]any
		if err := json.Unmarshal(raw, &decoded); err != nil {
			t.Fatal(err)
		}
		if decoded["currency"] != "USD" {
			t.Fatal("missing ledger currency")
		}
		return decoded
	}
	snapshot := run("get_financial_snapshot", `{}`)
	if snapshot["totalBalance"] != "137.7" || snapshot["accountCount"] != float64(2) {
		t.Fatalf("incorrect balance snapshot: %+v", snapshot)
	}
	summary := run("get_spending_summary", `{"from":"2026-09-01","to":"2026-10-01"}`)
	if summary["income"] != "10" || summary["expense"] != "0.3" || summary["netCashflow"] != "9.7" || summary["transactionCount"] != float64(3) {
		t.Fatalf("inexact/incorrect period totals: %+v", summary)
	}
	var foodBudget any
	for _, row := range summary["categories"].([]any) {
		if row.(map[string]any)["name"] == "Food" {
			foodBudget = row.(map[string]any)["currentMonthlyBudget"]
		}
	}
	if foodBudget != "50" {
		t.Fatalf("current monthly budget missing: %+v", summary)
	}
	goals := run("get_savings_goals", `{}`)["goals"].([]any)
	if len(goals) != 1 || goals[0].(map[string]any)["remaining"] != "25" {
		t.Fatalf("incorrect savings goals: %+v", goals)
	}
	upcoming := run("get_upcoming_subscriptions", `{"days":30}`)
	if upcoming["nextPaymentsTotal"] != "5" || upcoming["subscriptionCount"] != float64(2) {
		t.Fatalf("incorrect next-occurrence summary: %+v", upcoming)
	}
	if !reflect.DeepEqual(before, state()) {
		t.Fatal("read-only agent tools changed ledger rows")
	}
}

func TestAgentToolsBoundedDetailAndLargeExactTotals(t *testing.T) {
	resetTestDatabase(t)
	ctx := money.WithCurrency(context.WithValue(context.Background(), util.UserIdKey, "large-owner"), "USD")
	// 101 maximum-sized balances deliberately overflow an int64 aggregate, but
	// each individual stored amount still respects the ledger's bounds.
	_, err := util.DB.Exec(`INSERT INTO financial_accounts(id,owner,kind,currency,opening_balance_micros,balance_micros,name)
        SELECT lpad(to_hex(n),24,'0'),'large-owner','account','USD',1000000000000000000,1000000000000000000,'Account '||n FROM generate_series(1,101) n`)
	if err != nil {
		t.Fatal(err)
	}
	result, err := (agent.LedgerTools{DB: util.DB}).Execute(ctx, "get_financial_snapshot", json.RawMessage(`{}`))
	if err != nil {
		t.Fatal(err)
	}
	raw, err := json.Marshal(result)
	if err != nil {
		t.Fatal(err)
	}
	var snapshot struct {
		Total     string `json:"totalBalance"`
		Count     int    `json:"accountCount"`
		Accounts  []any  `json:"accounts"`
		Truncated bool   `json:"truncated"`
	}
	if err := json.Unmarshal(raw, &snapshot); err != nil {
		t.Fatal(err)
	}
	if snapshot.Total != "101000000000000" || snapshot.Count != 101 || len(snapshot.Accounts) != 100 || !snapshot.Truncated {
		t.Fatalf("invalid bounded exact summary: %+v", snapshot)
	}
	empty := money.WithCurrency(context.WithValue(context.Background(), util.UserIdKey, "empty-owner"), "USD")
	result, err = (agent.LedgerTools{DB: util.DB}).Execute(empty, "get_spending_summary", json.RawMessage(`{"from":"2026-09-01","to":"2026-10-01"}`))
	if err != nil {
		t.Fatal(err)
	}
	raw, err = json.Marshal(result)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(raw), `"expense":"0"`) || !strings.Contains(string(raw), `"categories":[]`) {
		t.Fatalf("invalid empty summary: %s", raw)
	}
}
