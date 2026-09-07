package agent

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"testing"
	"time"
)

func requireGuard(t *testing.T, err error, code string) {
	t.Helper()
	var guard *guardError
	if !errors.As(err, &guard) || guard.code != code {
		t.Fatalf("expected %s; got %v", code, err)
	}
}

func TestGuardPermissionsCannotBeOverriddenByModel(t *testing.T) {
	for _, tc := range []struct {
		name, args, code string
		p                permissions
	}{
		{"propose_account", `{"operation":"create","values":{"name":"Wallet"}}`, "changes_not_enabled", permissions{}},
		{"propose_account", `{"operation":"delete","recordId":"111111111111111111111111"}`, "deletes_not_enabled", permissions{Changes: true}},
		{"propose_account", `{"operation":"update","recordId":"111111111111111111111111","values":{"name":"x"}}`, "unverified_record", permissions{Changes: true}},
		{"propose_transaction", `{"operation":"create","values":{"sourceAccount":"111111111111111111111111"}}`, "unverified_record", permissions{Changes: true}},
		{"execute_sql", `{"sql":"DELETE FROM transactions"}`, "unknown_tool", permissions{Changes: true, Deletes: true}},
		{"find_records", `{"entity":"account","entity":"saving"}`, "invalid_tool_arguments", permissions{}},
	} {
		t.Run(tc.code+tc.name, func(t *testing.T) {
			calls := 0
			g := &guardedTools{next: toolFunc(func(context.Context, string, json.RawMessage) (any, error) { calls++; return nil, nil })}
			_, err := g.Execute(context.WithValue(context.Background(), permissionKey{}, tc.p), tc.name, json.RawMessage(tc.args))
			requireGuard(t, err, tc.code)
			if calls != 0 {
				t.Fatal("denied call reached executor")
			}
		})
	}
}

func TestGuardRequiresCurrentRunEvidence(t *testing.T) {
	ctx := context.WithValue(context.Background(), permissionKey{}, permissions{Changes: true})
	id := "111111111111111111111111"
	proposal := &ChangeProposal{ID: "unit-proposal", Entity: "account", Operation: "update"}
	calls := 0
	next := toolFunc(func(ctx context.Context, name string, args json.RawMessage) (any, error) {
		calls++
		if name == "find_records" {
			return map[string]any{"entity": "account", "records": []Record{{ID: id}}}, nil
		}
		return proposal, nil
	})
	g := &guardedTools{next: next}
	if _, err := g.Execute(ctx, "find_records", json.RawMessage(`{"entity":"account"}`)); err != nil {
		t.Fatal(err)
	}
	args := json.RawMessage(`{"operation":"update","recordId":"` + id + `","values":{"name":"Renamed"}}`)
	result, err := g.Execute(ctx, "propose_account", args)
	if err != nil || result != proposal || calls != 2 {
		t.Fatalf("verified proposal lost: %v", err)
	}
	_, err = (&guardedTools{next: next}).Execute(ctx, "propose_account", args)
	requireGuard(t, err, "unverified_record")
}

func TestGuardScrubsNotesAndCredentialsWithoutRounding(t *testing.T) {
	key := "AIza" + strings.Repeat("x", 35)
	g := &guardedTools{next: toolFunc(func(context.Context, string, json.RawMessage) (any, error) {
		return map[string]any{"entity": "transaction", "records": []map[string]any{{"id": "111111111111111111111111", "values": map[string]any{"amount": "999999999999.99", "note": "PRIVATE-NOTE", "name": key, "count": int64(9007199254740993)}}}, "extra": []any{key}}, nil
	})}
	result, err := g.Execute(context.Background(), "find_records", json.RawMessage(`{"entity":"transaction"}`))
	if err != nil {
		t.Fatal(err)
	}
	raw, _ := json.Marshal(result)
	if strings.Contains(string(raw), key) || strings.Contains(string(raw), "PRIVATE-NOTE") || !strings.Contains(string(raw), "9007199254740993") || !strings.Contains(string(raw), "999999999999.99") {
		t.Fatalf("incorrect egress: %s", raw)
	}
	result, err = g.Execute(context.WithValue(context.Background(), permissionKey{}, permissions{Notes: true}), "find_records", json.RawMessage(`{"entity":"transaction"}`))
	if err != nil {
		t.Fatal(err)
	}
	raw, _ = json.Marshal(result)
	if !strings.Contains(string(raw), "PRIVATE-NOTE") || strings.Contains(string(raw), key) {
		t.Fatal("note permission bypassed credential redaction")
	}
}

func TestGuardLimitsAndDuplicateJSON(t *testing.T) {
	for _, raw := range []string{`{"a":1,"a":2}`, `{"a":{"b":1,"b":2}}`, `{"a":1} {}`, `{"a":`, strings.Repeat("[", 20) + "0" + strings.Repeat("]", 20)} {
		if uniqueJSON([]byte(raw)) {
			t.Fatalf("accepted %s", raw)
		}
	}
	if !uniqueJSON([]byte(`{"a":[{"b":1},{"b":2}]}`)) {
		t.Fatal("valid JSON rejected")
	}
	g := &guardedTools{next: toolFunc(func(context.Context, string, json.RawMessage) (any, error) {
		return strings.Repeat("x", maxToolResultBytes+1), nil
	})}
	_, err := g.Execute(context.Background(), "get_financial_snapshot", nil)
	requireGuard(t, err, "tool_result_limit")
	g.next = toolFunc(func(context.Context, string, json.RawMessage) (any, error) { return nil, badArguments("invalid dates") })
	for i := 0; i < 3; i++ {
		_, err = g.Execute(context.Background(), "get_spending_summary", json.RawMessage(`{}`))
	}
	requireGuard(t, err, "invalid_tool_limit")
}

func TestGuardInputHistoryAndOutputNeverEchoCredentials(t *testing.T) {
	secret := "password=" + "synthetic-value"
	for _, history := range []bool{false, true} {
		calls := 0
		runner := chatRunner{model: modelFunc(func(context.Context, string, []json.RawMessage, bool) (modelTurn, error) {
			calls++
			return modelTurn{Text: "ok"}, nil
		})}
		req := ChatRequest{Input: secret, Consent: true}
		if history {
			req.Input = "hello"
			req.History = []ChatMessage{{Role: "user", Content: secret}, {Role: "assistant", Content: "old"}}
		}
		_, err := runner.Run(context.Background(), req, time.Now(), "USD")
		requireGuard(t, err, "sensitive_input")
		if calls != 0 {
			t.Fatal("credentials reached model")
		}
	}
	runner := chatRunner{model: modelFunc(func(context.Context, string, []json.RawMessage, bool) (modelTurn, error) {
		return modelTurn{Text: secret}, nil
	})}
	_, err := runner.Run(context.Background(), ChatRequest{Input: "hello", Consent: true}, time.Now(), "USD")
	requireGuard(t, err, "sensitive_output")
	requireGuard(t, checkUserText("visible\u202ehidden"), "invalid_text")
	if err := checkUserText("Transfer 12.34 to savings."); err != nil {
		t.Fatal(err)
	}
}

func TestScopedToolSchemasAndDeletePermissions(t *testing.T) {
	for _, tc := range []struct {
		p     permissions
		count int
	}{{permissions{}, 5}, {permissions{Changes: true}, 11}, {permissions{Changes: true, Deletes: true}, 11}} {
		raw := scopedDeclarations(context.WithValue(context.Background(), permissionKey{}, tc.p))
		var declarations []map[string]any
		if json.Unmarshal(raw, &declarations) != nil || len(declarations) != tc.count {
			t.Fatal("wrong capability schema")
		}
		for _, tool := range declarations {
			name := tool["name"].(string)
			if !strings.HasPrefix(name, "propose_") || name == "propose_budget" {
				continue
			}
			params := tool["parameters"].(map[string]any)["properties"].(map[string]any)
			ops := params["operation"].(map[string]any)["enum"].([]any)
			found := false
			for _, op := range ops {
				if op == "delete" {
					found = true
				}
			}
			if found != tc.p.Deletes {
				t.Fatal("delete schema not scoped")
			}
		}
	}
}
