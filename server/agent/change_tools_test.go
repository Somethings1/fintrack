package agent

import (
	"context"
	"encoding/json"
	"errors"
	"fintrack/server/money"
	"fintrack/server/util"
	"testing"
	"time"
)

func TestWorkspaceToolDeclarations(t *testing.T) {
	var declarations []struct {
		Name string `json:"name"`
	}
	if err := json.Unmarshal(allChatToolDeclarations(), &declarations); err != nil {
		t.Fatal(err)
	}
	want := map[string]bool{"get_financial_snapshot": true, "get_spending_summary": true, "get_savings_goals": true, "get_upcoming_subscriptions": true, "find_records": true, "propose_transaction": true, "propose_account": true, "propose_saving": true, "propose_category": true, "propose_budget": true, "propose_subscription": true}
	for _, d := range declarations {
		if !want[d.Name] {
			t.Fatalf("unexpected or duplicate tool %q", d.Name)
		}
		delete(want, d.Name)
	}
	if len(want) != 0 {
		t.Fatalf("missing tools: %v", want)
	}
}

func TestChangeToolArgumentsFailBeforeDatabaseAccess(t *testing.T) {
	ctx := money.WithCurrency(context.WithValue(context.Background(), util.UserIdKey, "owner-a"), "USD")
	tools := WorkspaceTools{}
	for _, tc := range []struct{ name, args string }{
		{"propose_account", `{"operation":"create","values":{"name":"Wallet","owner":"other"}}`},
		{"propose_transaction", `{"operation":"create","values":{"amount":12.34}}`},
		{"propose_subscription", `{"operation":"create","values":{"maxInterval":null}}`},
		{"propose_saving", `{"operation":"update","recordId":"bad","values":{"name":"x"}}`},
		{"propose_category", `{"operation":"delete","recordId":"111111111111111111111111","values":{"name":"x"}}`},
		{"propose_budget", `{"operation":"clear","recordId":"111111111111111111111111","values":{"budget":"1"}}`},
		{"propose_budget", `{"operation":"set","recordId":"111111111111111111111111","values":{"name":"x"}}`},
		{"find_records", `{"entity":"transaction","from":"2026-09-01","to":"2026-08-01"}`},
		{"find_records", `{"entity":"account","owner":"other"}`},
		{"propose_shell", `{"operation":"delete"}`},
	} {
		t.Run(tc.name+tc.args, func(t *testing.T) {
			_, err := tools.Execute(ctx, tc.name, json.RawMessage(tc.args))
			var argument *toolArgumentError
			if !errors.As(err, &argument) {
				t.Fatalf("not an argument rejection: %v", err)
			}
		})
	}
	if _, err := tools.Execute(context.Background(), "find_records", json.RawMessage(`{"entity":"account"}`)); !errors.Is(err, errToolUnavailable) {
		t.Fatal("missing identity accepted")
	}
}

func TestChangeProposalStopsBeforeAnyOtherCall(t *testing.T) {
	calls, modelCalls := 0, 0
	proposal := &ChangeProposal{ID: "test-proposal", Entity: "account", Operation: "create", Currency: "USD", Values: map[string]json.RawMessage{"name": jsonValue("Wallet"), "balance": jsonValue("0")}}
	runner := chatRunner{model: modelFunc(func(context.Context, string, []json.RawMessage, bool) (modelTurn, error) {
		modelCalls++
		return modelTurn{Raw: json.RawMessage(`{"role":"model","parts":[]}`), Text: "I already saved it", Calls: []functionCall{{Name: "propose_account"}, {Name: "propose_account"}}}, nil
	}), tools: toolFunc(func(context.Context, string, json.RawMessage) (any, error) {
		calls++
		return proposal, nil
	})}
	result, err := runner.Run(context.Background(), ChatRequest{Input: "Create Wallet", Consent: true, AllowChanges: true}, time.Now(), "USD")
	if err != nil || result.Proposal != proposal || calls != 1 || modelCalls != 1 {
		t.Fatalf("unexpected proposal lifecycle: %+v calls=%d model=%d err=%v", result, calls, modelCalls, err)
	}
	if result.Answer == "I already saved it" {
		t.Fatal("model's unverified success claim was used")
	}
}

func TestNormalizeChangesUsesExactMoneyAndTransactionShape(t *testing.T) {
	ctx := money.WithCurrency(context.Background(), "USD")
	v := map[string]json.RawMessage{"type": jsonValue("income"), "amount": jsonValue("0.30"), "dateTime": jsonValue("2026-09-07T12:00:00+07:00"), "sourceAccount": jsonValue("old"), "destinationAccount": jsonValue("111111111111111111111111"), "category": jsonValue("222222222222222222222222"), "note": jsonValue("")}
	if err := normalizeValues(ctx, "transaction", v); err != nil {
		t.Fatal(err)
	}
	if stringValue(v["amount"]) != "0.3" || stringValue(v["sourceAccount"]) != "" || stringValue(v["dateTime"]) != "2026-09-07T05:00:00Z" {
		t.Fatalf("unexpected normalization: %s", jsonValue(v))
	}
	for _, amount := range []string{"0.001", "-1", "0", "1000000000001"} {
		v["amount"] = jsonValue(amount)
		if normalizeValues(ctx, "transaction", v) == nil {
			t.Fatalf("invalid amount accepted: %s", amount)
		}
	}
}
