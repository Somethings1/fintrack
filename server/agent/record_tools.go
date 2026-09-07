package agent

import (
	"context"
	"database/sql"
	"encoding/json"
	"fintrack/server/money"
	"fintrack/server/util"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// Field and table names are developer-owned constants, never model-provided SQL.
type recordSpec struct {
	table, owner, predicate, search, columns string
	fields                                   map[string]string
}

var recordSpecs = map[string]recordSpec{
	"account": {"financial_accounts", "owner", "kind='account'", "name",
		`jsonb_build_object('name',name,'icon',icon,'balance',(balance_micros::numeric/1000000)::text)`,
		map[string]string{"name": "text", "icon": "text", "balance": "money"}},
	"saving": {"financial_accounts", "owner", "kind='saving'", "name",
		`jsonb_build_object('name',name,'icon',icon,'balance',(balance_micros::numeric/1000000)::text,'goal',(goal_micros::numeric/1000000)::text,'createdDate',COALESCE(to_char(created_date AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'0001-01-01T00:00:00Z'),'goalDate',COALESCE(to_char(goal_date AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'0001-01-01T00:00:00Z'))`,
		map[string]string{"name": "text", "icon": "text", "balance": "money", "goal": "money", "createdDate": "date", "goalDate": "date"}},
	"category": {"categories", "owner", "true", "name",
		`jsonb_build_object('name',name,'icon',icon,'type',type,'budget',(budget_micros::numeric/1000000)::text)`,
		map[string]string{"name": "text", "icon": "text", "type": "text", "budget": "money"}},
	"transaction": {"transactions", "creator", "true", "note",
		`jsonb_build_object('amount',(amount_micros::numeric/1000000)::text,'type',type,'sourceAccount',COALESCE(source_account_id,''),'destinationAccount',COALESCE(destination_account_id,''),'category',COALESCE(category_id,''),'note',note,'dateTime',to_char(date_time AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'))`,
		map[string]string{"amount": "money", "type": "text", "sourceAccount": "text", "destinationAccount": "text", "category": "text", "note": "text", "dateTime": "date"}},
	"subscription": {"subscriptions", "creator", "true", "name",
		`jsonb_build_object('name',name,'icon',icon,'amount',(amount_micros::numeric/1000000)::text,'sourceAccount',source_account_id,'category',category_id,'startDate',to_char(start_date AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'interval',interval_unit,'maxInterval',max_interval,'remindBefore',remind_before)`,
		map[string]string{"name": "text", "icon": "text", "amount": "money", "sourceAccount": "text", "category": "text", "startDate": "date", "interval": "text", "maxInterval": "integer", "remindBefore": "integer"}},
}

type Record struct {
	ID         string                     `json:"id"`
	Values     map[string]json.RawMessage `json:"values"`
	LastUpdate time.Time                  `json:"lastUpdate"`
}

type findRecordArgs struct {
	Entity  string `json:"entity"`
	ID      string `json:"id"`
	Query   string `json:"query"`
	From    string `json:"from"`
	To      string `json:"to"`
	AfterID string `json:"afterId"`
}

// WorkspaceTools adds discovery and proposal construction to the analytics tools.
// Preparing any change is still read-only. Only the ordinary confirmed API writes.
type WorkspaceTools struct{ LedgerTools }

func (s WorkspaceTools) Execute(parent context.Context, name string, raw json.RawMessage) (any, error) {
	if name != "find_records" && !strings.HasPrefix(name, "propose_") {
		return s.LedgerTools.Execute(parent, name, raw)
	}
	if util.UserID(parent) == "" {
		return nil, errToolUnavailable
	}
	if _, err := money.Precision(money.Currency(parent)); err != nil {
		return nil, errToolUnavailable
	}
	var find findRecordArgs
	var change changeArgs
	entity := strings.TrimPrefix(name, "propose_")
	if name == "find_records" {
		if err := decodeToolArgs(raw, &find); err != nil {
			return nil, err
		}
		entity = find.Entity
	} else {
		if err := decodeToolArgs(raw, &change); err != nil {
			return nil, err
		}
	}
	if entity == "budget" {
		entity = "category"
	}
	spec, ok := recordSpecs[entity]
	if !ok {
		return nil, badArguments("Unknown record type.")
	}
	if name == "find_records" {
		if err := validateFind(find); err != nil {
			return nil, err
		}
	} else if err := validateChangeArgs(entity, name, change); err != nil {
		return nil, err
	}
	if s.DB == nil {
		return nil, errToolUnavailable
	}
	ctx, cancel := context.WithTimeout(parent, 5*time.Second)
	defer cancel()
	tx, err := s.DB.BeginTx(ctx, &sql.TxOptions{ReadOnly: true, Isolation: sql.LevelRepeatableRead})
	if err != nil {
		return nil, errToolUnavailable
	}
	defer tx.Rollback()
	var result any
	if name == "find_records" {
		result, err = findRecords(ctx, tx, spec, find)
	} else {
		now := time.Now().UTC()
		if s.Now != nil {
			now = s.Now().UTC()
		}
		result, err = prepareChange(ctx, tx, entity, name, change, now)
	}
	if err != nil {
		return nil, err
	}
	if err = tx.Commit(); err != nil {
		return nil, errToolUnavailable
	}
	return result, nil
}

func validRecordID(id string) bool {
	v, err := primitive.ObjectIDFromHex(id)
	return err == nil && !v.IsZero() && id == strings.ToLower(id)
}

func validateFind(a findRecordArgs) error {
	if len(a.Query) > 200 || (a.ID != "" && !validRecordID(a.ID)) || (a.AfterID != "" && !validRecordID(a.AfterID)) {
		return badArguments("Use a valid record ID and at most 200 bytes of search text.")
	}
	if a.From != "" || a.To != "" {
		from, e1 := time.Parse("2006-01-02", a.From)
		to, e2 := time.Parse("2006-01-02", a.To)
		if a.Entity != "transaction" || e1 != nil || e2 != nil || !to.After(from) || to.Sub(from) > 366*24*time.Hour {
			return badArguments("Transaction dates require from inclusive and to exclusive, UTC YYYY-MM-DD, at most 366 days apart.")
		}
	}
	return nil
}

func readRecord(ctx context.Context, tx *sql.Tx, entity, id string) (Record, error) {
	spec := recordSpecs[entity]
	var r Record
	var raw []byte
	err := tx.QueryRowContext(ctx, `SELECT id,`+spec.columns+`,last_update FROM `+spec.table+` WHERE `+spec.owner+`=$1 AND currency=$2 AND NOT is_deleted AND `+spec.predicate+` AND id=$3`, util.UserID(ctx), money.Currency(ctx), id).Scan(&r.ID, &raw, &r.LastUpdate)
	if err == sql.ErrNoRows {
		return r, badArguments("Record not found. Find an existing record owned by this user before proposing a change.")
	}
	if err != nil {
		return r, errToolUnavailable
	}
	if json.Unmarshal(raw, &r.Values) != nil || normalizeRecord(spec, &r) != nil {
		return r, errToolUnavailable
	}
	return r, nil
}

// Normalize transport only; retain PostgreSQL microsecond timestamps and exact amounts.
func normalizeRecord(spec recordSpec, r *Record) error {
	for key, kind := range spec.fields {
		if kind == "money" {
			value, err := money.Parse(stringValue(r.Values[key]))
			if err != nil {
				return err
			}
			r.Values[key] = jsonValue(value.String())
		}
		if kind == "date" {
			value, err := time.Parse(time.RFC3339, stringValue(r.Values[key]))
			if err != nil {
				return err
			}
			r.Values[key] = jsonValue(value.UTC().Format(time.RFC3339Nano))
		}
	}
	return nil
}

func findRecords(ctx context.Context, tx *sql.Tx, spec recordSpec, a findRecordArgs) (any, error) {
	// Literal substring search, not a user-controlled LIKE pattern. ID keyset
	// pagination is deterministic; it does not imply chronological transaction dates.
	where := ` WHERE ` + spec.owner + `=$1 AND currency=$2 AND NOT is_deleted AND ` + spec.predicate + `
 AND ($3='' OR id=$3) AND ($4='' OR strpos(lower(` + spec.search + `),lower($4))>0)
 AND ($5='' OR id<$5)`
	args := []any{util.UserID(ctx), money.Currency(ctx), a.ID, a.Query, a.AfterID}
	if a.Entity == "budget" {
		where += ` AND type='expense'`
	}
	if a.From != "" {
		from, _ := time.Parse("2006-01-02", a.From)
		to, _ := time.Parse("2006-01-02", a.To)
		where += ` AND date_time >= $6 AND date_time < $7`
		args = append(args, from, to)
	}
	rows, err := tx.QueryContext(ctx, `SELECT id,`+spec.columns+`,last_update FROM `+spec.table+where+` ORDER BY id DESC LIMIT 26`, args...)
	if err != nil {
		return nil, errToolUnavailable
	}
	defer rows.Close()
	records := []Record{}
	for rows.Next() {
		var r Record
		var raw []byte
		if rows.Scan(&r.ID, &raw, &r.LastUpdate) != nil || json.Unmarshal(raw, &r.Values) != nil || normalizeRecord(spec, &r) != nil {
			return nil, errToolUnavailable
		}
		records = append(records, r)
	}
	if rows.Err() != nil {
		return nil, errToolUnavailable
	}
	more := len(records) > 25
	next := ""
	if more {
		records = records[:25]
		next = records[24].ID
	}
	return map[string]any{"entity": a.Entity, "records": records, "hasMore": more, "nextAfterId": next, "currency": money.Currency(ctx), "order": "id descending", "dateBasis": "UTC; from inclusive, to exclusive"}, nil
}

// Keep the provider schema and accepted fields together. Money is transported as
// strings so both model arguments and confirmation payloads retain exact values.
func allChatToolDeclarations() json.RawMessage {
	var declarations []map[string]any
	if err := json.Unmarshal(chatToolDeclarations, &declarations); err != nil {
		panic(err)
	}
	stringField := func(description string) map[string]any {
		return map[string]any{"type": "STRING", "description": description}
	}
	declarations = append(declarations, map[string]any{
		"name": "find_records", "description": "Find/list/read owned records before editing/deleting or resolving account/category IDs. entity budget lists expense categories, including ones without a budget. Transactions search note text; others search names. Never guess among ambiguous matches. Page using nextAfterId.",
		"parameters": map[string]any{"type": "OBJECT", "required": []string{"entity"}, "properties": map[string]any{
			"entity": map[string]any{"type": "STRING", "enum": []string{"transaction", "account", "saving", "category", "budget", "subscription"}},
			"id":     stringField("Exact ID for reading a single record"), "query": stringField("Literal name or transaction note substring; omit to list"),
			"from": stringField("Transaction date range start YYYY-MM-DD, inclusive UTC"), "to": stringField("Transaction date range end YYYY-MM-DD, exclusive UTC"), "afterId": stringField("nextAfterId from previous page"),
		}},
	})
	for _, entity := range []string{"transaction", "account", "saving", "category", "subscription", "budget"} {
		base := entity
		if base == "budget" {
			base = "category"
		}
		fields := map[string]any{}
		for key, kind := range recordSpecs[base].fields {
			typ, description := "STRING", "Only explicitly requested fields. Omitted update fields are preserved."
			if kind == "money" {
				description = "Exact decimal string in ledger currency major units, e.g. 12.34. Never convert currency."
			}
			if kind == "date" {
				description = "RFC3339 timestamp with timezone. Use UTC when no timezone supplied."
			}
			if kind == "integer" {
				typ = "INTEGER"
			}
			fields[key] = map[string]any{"type": typ, "description": description}
		}
		description := "Prepare one " + entity + " create/update/delete proposal for an explicit user request. Does NOT save: the user must click the confirmation card. Use recordId from find_records for update/delete and only changed values. For delete omit values. Never claim it was saved."
		if entity == "account" || entity == "saving" {
			description += " balance is an opening balance for CREATE only (default 0); to change existing balances propose a transaction/transfer."
		}
		if entity == "saving" {
			description += " goal defaults to 0 (no target); goalDate defaults to no deadline. createdDate is creation-only."
		}
		if entity == "category" {
			description += " type income/expense is immutable after creation. budget is a monthly amount; prefer propose_budget to set/clear an expense budget."
		}
		if entity == "transaction" {
			description += " Require amount,type and valid account/category IDs. Date defaults to now, visibly shown for review. Income: destination+income category. Expense: source+expense category. Transfer: two distinct accounts and no category. Deleting reverses ledger effects."
		}
		if entity == "subscription" {
			description += " Require name,amount,sourceAccount,expense category,startDate,interval day/week/month/year. Defaults: maxInterval 0=unlimited, remindBefore 0. Delete stops tracking/future postings, NOT a merchant cancellation. No pause tool. After postings, startDate/interval cannot change."
		}
		operations := []string{"create", "update", "delete"}
		if entity == "budget" {
			operations = []string{"set", "clear"}
			fields = map[string]any{"budget": stringField("Positive exact decimal monthly limit. Required for set; omit for clear.")}
			description = "Set/create/update or clear/delete the MONTHLY budget on an existing expense category. recordId is the category ID. clear sets budget to zero without deleting the category or history. No separate budget table."
		}
		declarations = append(declarations, map[string]any{"name": "propose_" + entity, "description": description, "parameters": map[string]any{"type": "OBJECT", "required": []string{"operation"}, "properties": map[string]any{
			"operation": map[string]any{"type": "STRING", "enum": operations}, "recordId": stringField("Existing owned record ID; required for update/delete and all budget operations"), "values": map[string]any{"type": "OBJECT", "properties": fields},
		}}})
	}
	raw, err := json.Marshal(declarations)
	if err != nil {
		panic(err)
	}
	return raw
}
