package agent

import (
	"context"
	"database/sql"
	"encoding/json"
	"fintrack/server/money"
	"fintrack/server/util"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
)

type changeArgs struct {
	Operation string                     `json:"operation"`
	RecordID  string                     `json:"recordId"`
	Values    map[string]json.RawMessage `json:"values"`
}

// ChangeProposal is produced by tool code, never parsed from model prose.
// It is not an authorization token. Confirmation uses the ordinary owned CRUD
// endpoints, which revalidate every write and enforce ledger invariants.
type ChangeProposal struct {
	RecordVersion string                     `json:"recordVersion,omitempty"`
	ID            string                     `json:"id"`
	Entity        string                     `json:"entity"`
	Operation     string                     `json:"operation"`
	RecordID      string                     `json:"recordId,omitempty"`
	Currency      string                     `json:"currency"`
	Values        map[string]json.RawMessage `json:"values"`
	Before        map[string]json.RawMessage `json:"before,omitempty"`
	References    map[string]string          `json:"references"`
	Warnings      []string                   `json:"warnings"`
}

func jsonValue(v any) json.RawMessage {
	b, _ := json.Marshal(v)
	return b
}

func stringValue(v json.RawMessage) string {
	var s string
	_ = json.Unmarshal(v, &s)
	return s
}

func cloneValues(v map[string]json.RawMessage) map[string]json.RawMessage {
	out := map[string]json.RawMessage{}
	for k, x := range v {
		out[k] = append(json.RawMessage(nil), x...)
	}
	return out
}

func validateChangeArgs(entity, name string, a changeArgs) error {
	if name == "propose_budget" {
		if (a.Operation != "set" && a.Operation != "clear") || !validRecordID(a.RecordID) {
			return badArguments("Budget changes require set/clear and an existing expense category recordId.")
		}
		if (a.Operation == "set" && len(a.Values) != 1) || (a.Operation == "clear" && len(a.Values) != 0) {
			return badArguments("set requires only values.budget; clear takes no values.")
		}
		if a.Operation == "set" && a.Values["budget"] == nil {
			return badArguments("Provide values.budget.")
		}
	} else {
		if a.Operation != "create" && a.Operation != "update" && a.Operation != "delete" {
			return badArguments("operation must be create, update, or delete.")
		}
		if (a.Operation == "create" && a.RecordID != "") || (a.Operation != "create" && !validRecordID(a.RecordID)) {
			return badArguments("Create has no recordId; update/delete need an existing owned recordId.")
		}
		if a.Operation == "delete" && len(a.Values) != 0 {
			return badArguments("Delete takes no values; it previews the current record.")
		}
		if a.Operation != "delete" && len(a.Values) == 0 {
			return badArguments("Provide values for the requested change.")
		}
	}
	for key, raw := range a.Values {
		kind, ok := recordSpecs[entity].fields[key]
		if !ok {
			return badArguments("Unknown or protected field: " + key)
		}
		if kind == "integer" {
			var n int
			if string(raw) == "null" || json.Unmarshal(raw, &n) != nil {
				return badArguments(key + " must be an integer.")
			}
		} else {
			var text string
			if string(raw) == "null" || json.Unmarshal(raw, &text) != nil {
				return badArguments(key + " must be a string; monetary values use exact decimal strings.")
			}
		}
	}
	return nil
}

func prepareChange(ctx context.Context, tx *sql.Tx, entity, name string, a changeArgs, now time.Time) (*ChangeProposal, error) {
	op := a.Operation
	if name == "propose_budget" {
		op = "update"
	}
	p := &ChangeProposal{ID: uuid.NewString(), Entity: entity, Operation: op, RecordID: a.RecordID, Currency: money.Currency(ctx), References: map[string]string{}, Warnings: []string{}}
	var previous Record
	if op != "create" {
		var err error
		previous, err = readRecord(ctx, tx, entity, a.RecordID)
		if err != nil {
			return nil, err
		}
		p.Before = cloneValues(previous.Values)
		p.RecordVersion = previous.LastUpdate.UTC().Format(time.RFC3339Nano)
	}
	if op == "delete" {
		p.Values = map[string]json.RawMessage{}
		// Inactive subscriptions may reference archived accounts. Deleting them
		// must remain possible; the preview retains the exact saved reference IDs.
		switch entity {
		case "transaction":
			p.Warnings = append(p.Warnings, "Deleting reverses this transaction's balance effects. It does not reverse a real bank payment.")
		case "subscription":
			p.Warnings = append(p.Warnings, "Stops future FinTrack postings and reminders. This does NOT cancel the subscription with the merchant.")
		default:
			p.Warnings = append(p.Warnings, "Archives this record. The API rejects deletion when ledger or subscription references prevent it.")
		}
		return p, nil
	}
	values := cloneValues(previous.Values)
	if op == "create" {
		switch entity {
		case "account":
			values = map[string]json.RawMessage{"balance": jsonValue("0"), "icon": jsonValue("")}
		case "saving":
			values = map[string]json.RawMessage{"balance": jsonValue("0"), "goal": jsonValue("0"), "icon": jsonValue(""), "createdDate": jsonValue(now.Format(time.RFC3339)), "goalDate": jsonValue("0001-01-01T00:00:00Z")}
		case "category":
			values = map[string]json.RawMessage{"budget": jsonValue("0"), "icon": jsonValue("")}
		case "transaction":
			values = map[string]json.RawMessage{"sourceAccount": jsonValue(""), "destinationAccount": jsonValue(""), "category": jsonValue(""), "note": jsonValue(""), "dateTime": jsonValue(now.Format(time.RFC3339))}
		case "subscription":
			values = map[string]json.RawMessage{"icon": jsonValue(""), "maxInterval": jsonValue(0), "remindBefore": jsonValue(0)}
		}
	}
	if op == "update" {
		for key := range a.Values {
			if ((entity == "saving" || entity == "account") && key == "balance") || (entity == "saving" && key == "createdDate") || (entity == "category" && key == "type") {
				return nil, badArguments(key + " cannot be changed on this record. Use a transaction/transfer to change balances; category type is immutable.")
			}
		}
	}
	for k, v := range a.Values {
		values[k] = v
	}
	if name == "propose_budget" {
		if stringValue(values["type"]) != "expense" {
			return nil, badArguments("Monthly budgets can only be set on expense categories.")
		}
		if a.Operation == "clear" {
			values["budget"] = jsonValue("0")
		} else {
			amount, err := money.Parse(stringValue(values["budget"]))
			if err != nil || amount <= 0 {
				return nil, badArguments("Set a positive budget, or use clear to remove it.")
			}
		}
		p.Warnings = append(p.Warnings, "Changes the category's current monthly limit only; no category, transaction history, or money is removed.")
	}
	if op == "create" && (entity == "account" || entity == "saving") {
		opening, err := money.Parse(stringValue(values["balance"]))
		if err != nil || opening < 0 {
			return nil, badArguments("Opening balance must be non-negative.")
		}
	}
	if err := normalizeValues(ctx, entity, values); err != nil {
		return nil, err
	}
	if err := resolveReferences(ctx, tx, entity, values, p.References); err != nil {
		return nil, err
	}
	if entity == "subscription" && op == "update" {
		var current int
		if err := tx.QueryRowContext(ctx, `SELECT current_interval FROM subscriptions WHERE id=$1 AND creator=$2 AND currency=$3 AND NOT is_deleted`, a.RecordID, util.UserID(ctx), money.Currency(ctx)).Scan(&current); err != nil {
			return nil, errToolUnavailable
		}
		oldDate, _ := time.Parse(time.RFC3339, stringValue(previous.Values["startDate"]))
		newDate, _ := time.Parse(time.RFC3339, stringValue(values["startDate"]))
		limit, _ := strconv.Atoi(string(values["maxInterval"]))
		if (current > 0 && (!oldDate.Equal(newDate) || stringValue(previous.Values["interval"]) != stringValue(values["interval"]))) || (limit > 0 && limit < current) {
			return nil, badArguments("A posted schedule's start/interval cannot change and its repetition limit cannot precede completed occurrences.")
		}
	}
	// Existing API updates ignore balances but still validate incoming amounts.
	// Do not send ledger-controlled balances as editable fields, even if negative.
	if op == "update" && (entity == "account" || entity == "saving") {
		delete(values, "balance")
	}
	values["currency"] = jsonValue(p.Currency)
	p.Values = values
	if entity == "transaction" {
		p.Warnings = append(p.Warnings, "Records a FinTrack ledger entry only. It does not move money at a bank.")
	}
	if entity == "subscription" {
		p.Warnings = append(p.Warnings, "A tracked schedule may post automatically when the recurring worker is enabled. This does not purchase or cancel a merchant service.")
	}
	return p, nil
}

func normalizeValues(ctx context.Context, entity string, v map[string]json.RawMessage) error {
	required := map[string][]string{
		"account": {"name"}, "saving": {"name"}, "category": {"name", "type"},
		"transaction": {"amount", "type", "dateTime"}, "subscription": {"name", "amount", "sourceAccount", "category", "startDate", "interval"},
	}
	for _, key := range required[entity] {
		if strings.TrimSpace(stringValue(v[key])) == "" {
			return badArguments("Missing " + key + "; ask the user instead of guessing.")
		}
	}
	for key, raw := range v {
		kind := recordSpecs[entity].fields[key]
		text := stringValue(raw)
		switch kind {
		case "money":
			a, err := money.Parse(text)
			if err != nil || money.Validate(a, money.Currency(ctx)) != nil {
				return badArguments("Invalid " + key + " for the ledger currency precision/range.")
			}
			if (key == "amount" && a <= 0) || (key != "amount" && key != "balance" && a < 0) {
				return badArguments(key + " has an invalid sign.")
			}
			v[key] = jsonValue(a.String())
		case "date":
			t, err := time.Parse(time.RFC3339, text)
			if err != nil || t.Year() < 1 || t.Year() > 9999 || ((key == "dateTime" || key == "startDate") && t.IsZero()) {
				return badArguments(key + " must be an RFC3339 timestamp with timezone.")
			}
			v[key] = jsonValue(t.UTC().Format(time.RFC3339Nano))
		case "integer":
			var n int
			if json.Unmarshal(raw, &n) != nil || n < 0 || (key == "maxInterval" && n > 100000) || (key == "remindBefore" && n > 366) {
				return badArguments("Invalid " + key + ".")
			}
		case "text":
			if key == "name" {
				text = strings.TrimSpace(text)
				if text == "" || len(text) > 100 {
					return badArguments("Name must be 1-100 bytes.")
				}
				v[key] = jsonValue(text)
			}
			if (key == "icon" && len(text) > 100) || (key == "note" && len(text) > 500) {
				return badArguments(key + " is too long.")
			}
		}
	}
	if entity == "category" && stringValue(v["type"]) != "income" && stringValue(v["type"]) != "expense" {
		return badArguments("Category type must be income or expense.")
	}
	if entity == "subscription" {
		switch stringValue(v["interval"]) {
		case "day", "week", "month", "year":
		default:
			return badArguments("Interval must be day, week, month, or year.")
		}
	}
	if entity == "transaction" {
		switch stringValue(v["type"]) {
		case "income":
			v["sourceAccount"] = jsonValue("")
		case "expense":
			v["destinationAccount"] = jsonValue("")
		case "transfer":
			v["category"] = jsonValue("")
			if stringValue(v["sourceAccount"]) == stringValue(v["destinationAccount"]) {
				return badArguments("A transfer needs two distinct accounts.")
			}
		default:
			return badArguments("Transaction type must be income, expense, or transfer.")
		}
	}
	return nil
}

func resolveReferences(ctx context.Context, tx *sql.Tx, entity string, v map[string]json.RawMessage, names map[string]string) error {
	if entity != "transaction" && entity != "subscription" {
		return nil
	}
	kind := stringValue(v["type"])
	if entity == "subscription" {
		kind = "expense"
	}
	for _, key := range []string{"sourceAccount", "destinationAccount", "category"} {
		required := (key == "sourceAccount" && (kind == "expense" || kind == "transfer")) || (key == "destinationAccount" && (kind == "income" || kind == "transfer")) || (key == "category" && kind != "transfer")
		if !required {
			continue
		}
		id := stringValue(v[key])
		if !validRecordID(id) {
			return badArguments("Find an existing " + key + " ID first.")
		}
		var label string
		var err error
		if key == "category" {
			err = tx.QueryRowContext(ctx, `SELECT name FROM categories WHERE id=$1 AND owner=$2 AND currency=$3 AND type=$4 AND NOT is_deleted`, id, util.UserID(ctx), money.Currency(ctx), kind).Scan(&label)
		} else {
			err = tx.QueryRowContext(ctx, `SELECT name FROM financial_accounts WHERE id=$1 AND owner=$2 AND currency=$3 AND NOT is_deleted`, id, util.UserID(ctx), money.Currency(ctx)).Scan(&label)
		}
		if err == sql.ErrNoRows {
			return badArguments(fmt.Sprintf("%s is missing, archived, has the wrong type/currency, or is not owned by this user.", key))
		}
		if err != nil {
			return errToolUnavailable
		}
		names[id] = label
	}
	return nil
}
