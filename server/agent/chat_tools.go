package agent

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fintrack/server/money"
	"fintrack/server/util"
	"math/big"
	"strings"
	"time"
)

// No arbitrary SQL, owner IDs, URLs, or write operations are model parameters.
var chatToolDeclarations = json.RawMessage(`[
 {"name":"get_financial_snapshot","description":"Read current account and savings balances, with an exact combined balance and at most 100 account details. No arguments."},
 {"name":"get_spending_summary","description":"Read recorded income, expense and net cash flow and category totals for a UTC date range. Transfers and deleted transactions are excluded. Category budgets are CURRENT monthly settings, not historical or period-adjusted budgets.","parameters":{"type":"OBJECT","properties":{"from":{"type":"STRING","description":"Inclusive UTC date YYYY-MM-DD"},"to":{"type":"STRING","description":"Exclusive UTC date YYYY-MM-DD; after from, at most 366 days later"}},"required":["from","to"]}},
 {"name":"get_savings_goals","description":"Read savings balances, targets, remaining amounts, and target dates. No arguments. This does not forecast future income or progress."},
 {"name":"get_upcoming_subscriptions","description":"Read only the NEXT payment per active subscription, including overdue payments, before now plus days. Not all renewals in the window or all future bills.","parameters":{"type":"OBJECT","properties":{"days":{"type":"INTEGER","description":"Look ahead 1 to 90 days; defaults to 30","minimum":1,"maximum":90}}}}
]`)

type toolArgumentError struct{ message string }

func (e *toolArgumentError) Error() string { return e.message }
func badArguments(message string) error    { return &toolArgumentError{message: message} }

func decodeToolArgs(raw json.RawMessage, target any) error {
	raw = bytes.TrimSpace(raw)
	if len(raw) == 0 {
		raw = json.RawMessage(`{}`)
	}
	if len(raw) > 2048 || raw[0] != '{' || decodeStrict(raw, target) != nil {
		return badArguments("Use the declared tool arguments only, as a JSON object.")
	}
	return nil
}

// LedgerTools executes fixed queries under the authenticated context. Each call
// gets a read-only, repeatable-read snapshot. No connection is held during LLM
// generation. The clock is injectable for deterministic application tests.
type LedgerTools struct {
	DB  *sql.DB
	Now func() time.Time
}

func (s LedgerTools) Execute(parent context.Context, name string, raw json.RawMessage) (any, error) {
	if util.UserID(parent) == "" {
		return nil, errToolUnavailable
	}
	if _, err := money.Precision(money.Currency(parent)); err != nil {
		return nil, errToolUnavailable
	}
	// Validate before opening a database connection, including unknown names.
	from, to := time.Time{}, time.Time{}
	days := 30
	switch name {
	case "get_financial_snapshot", "get_savings_goals":
		if err := decodeToolArgs(raw, &struct{}{}); err != nil {
			return nil, err
		}
	case "get_spending_summary":
		var args struct {
			From string `json:"from"`
			To   string `json:"to"`
		}
		if err := decodeToolArgs(raw, &args); err != nil {
			return nil, err
		}
		var err error
		from, err = time.Parse("2006-01-02", args.From)
		if err != nil {
			return nil, badArguments("from must be a UTC date YYYY-MM-DD.")
		}
		to, err = time.Parse("2006-01-02", args.To)
		if err != nil || !to.After(from) || to.Sub(from) > 366*24*time.Hour {
			return nil, badArguments("to must be an exclusive UTC date after from and at most 366 days later.")
		}
	case "get_upcoming_subscriptions":
		var args struct {
			Days *int `json:"days"`
		}
		if err := decodeToolArgs(raw, &args); err != nil {
			return nil, err
		}
		if args.Days != nil {
			days = *args.Days
		}
		if days < 1 || days > 90 {
			return nil, badArguments("days must be an integer from 1 to 90.")
		}
	default:
		return nil, badArguments("Unknown tool. Use one of the declared read-only financial tools.")
	}
	if s.DB == nil {
		return nil, errToolUnavailable
	}
	now := time.Now().UTC()
	if s.Now != nil {
		now = s.Now().UTC()
	}
	ctx, cancel := context.WithTimeout(parent, 5*time.Second)
	defer cancel()
	tx, err := s.DB.BeginTx(ctx, &sql.TxOptions{ReadOnly: true, Isolation: sql.LevelRepeatableRead})
	if err != nil {
		return nil, errToolUnavailable
	}
	defer tx.Rollback()
	var result map[string]any
	switch name {
	case "get_financial_snapshot":
		result, err = financialSnapshot(ctx, tx)
	case "get_spending_summary":
		result, err = spendingSummary(ctx, tx, from, to)
	case "get_savings_goals":
		result, err = savingsGoals(ctx, tx)
	case "get_upcoming_subscriptions":
		result, err = upcomingSubscriptions(ctx, tx, now.AddDate(0, 0, days))
	}
	if err != nil {
		return nil, errToolUnavailable
	}
	if err := tx.Commit(); err != nil {
		return nil, errToolUnavailable
	}
	result["currency"] = money.Currency(ctx)
	result["asOf"] = now.Format(time.RFC3339)
	result["amountFormat"] = "exact decimal strings in major currency units"
	return result, nil
}

// PostgreSQL SUM(bigint) is NUMERIC and can exceed int64 or money.Amount's
// per-record cap. Keep aggregates exact using arbitrary precision, never floats.
type decimalAmount string

func (a *decimalAmount) Scan(value any) error {
	var raw string
	switch v := value.(type) {
	case string:
		raw = v
	case []byte:
		raw = string(v)
	default:
		return errors.New("expected integer micros as text")
	}
	n, ok := new(big.Int).SetString(raw, 10)
	if !ok {
		return errors.New("invalid integer micros")
	}
	sign := ""
	if n.Sign() < 0 {
		sign = "-"
		n.Abs(n)
	}
	whole, fraction := new(big.Int), new(big.Int)
	whole.QuoRem(n, big.NewInt(money.Scale), fraction)
	digits := fraction.String()
	digits = strings.Repeat("0", 6-len(digits)) + digits
	digits = strings.TrimRight(digits, "0")
	major := sign + whole.String()
	if digits != "" {
		major += "." + digits
	}
	*a = decimalAmount(major)
	return nil
}

func financialSnapshot(ctx context.Context, tx *sql.Tx) (map[string]any, error) {
	rows, err := tx.QueryContext(ctx, `SELECT id,name,kind,balance_micros::text,
        count(*) OVER (),sum(balance_micros) OVER ()::text
        FROM financial_accounts WHERE owner=$1 AND currency=$2 AND NOT is_deleted
        ORDER BY kind,name,id LIMIT 100`, util.UserID(ctx), money.Currency(ctx))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	accounts := []map[string]any{}
	var count int64
	total := decimalAmount("0")
	for rows.Next() {
		var id, name, kind string
		var balance decimalAmount
		if err := rows.Scan(&id, &name, &kind, &balance, &count, &total); err != nil {
			return nil, err
		}
		accounts = append(accounts, map[string]any{"id": id, "name": name, "kind": kind, "balance": balance})
	}
	return map[string]any{"totalBalance": total, "accountCount": count, "accounts": accounts, "truncated": count > int64(len(accounts))}, rows.Err()
}

func spendingSummary(ctx context.Context, tx *sql.Tx, from, to time.Time) (map[string]any, error) {
	var income, expense, net decimalAmount
	var count int64
	err := tx.QueryRowContext(ctx, `SELECT
        COALESCE(sum(amount_micros) FILTER(WHERE type='income'),0)::text,
        COALESCE(sum(amount_micros) FILTER(WHERE type='expense'),0)::text,
        COALESCE(sum(CASE WHEN type='income' THEN amount_micros ELSE -amount_micros END),0)::text,
        count(*) FROM transactions WHERE creator=$1 AND currency=$2 AND NOT is_deleted
        AND type IN ('income','expense') AND date_time >= $3 AND date_time < $4`,
		util.UserID(ctx), money.Currency(ctx), from, to).Scan(&income, &expense, &net, &count)
	if err != nil {
		return nil, err
	}
	rows, err := tx.QueryContext(ctx, `SELECT c.id,c.name,c.type,c.budget_micros::text,c.is_deleted,
        COALESCE(sum(t.amount_micros),0)::text,count(t.id),count(*) OVER ()
        FROM categories c LEFT JOIN transactions t ON t.category_id=c.id AND t.creator=c.owner
          AND t.currency=c.currency AND t.type=c.type AND NOT t.is_deleted
          AND t.date_time >= $3 AND t.date_time < $4
        WHERE c.owner=$1 AND c.currency=$2 AND (NOT c.is_deleted OR t.id IS NOT NULL)
        GROUP BY c.id,c.name,c.type,c.budget_micros,c.is_deleted
        ORDER BY COALESCE(sum(t.amount_micros),0) DESC,c.id LIMIT 100`, util.UserID(ctx), money.Currency(ctx), from, to)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	categories := []map[string]any{}
	var categoryCount int64
	for rows.Next() {
		var id, name, kind string
		var budget, total decimalAmount
		var archived bool
		var transactions int64
		if err := rows.Scan(&id, &name, &kind, &budget, &archived, &total, &transactions, &categoryCount); err != nil {
			return nil, err
		}
		categories = append(categories, map[string]any{"id": id, "name": name, "type": kind, "total": total, "transactions": transactions, "currentMonthlyBudget": budget, "archivedCategory": archived})
	}
	return map[string]any{"from": from.Format("2006-01-02"), "toExclusive": to.Format("2006-01-02"),
		"timezone": "UTC", "income": income, "expense": expense, "netCashflow": net, "transactionCount": count,
		"budgetBasis": "current monthly configuration, not historical or prorated",
		"categories":  categories, "categoryCount": categoryCount, "truncated": categoryCount > int64(len(categories))}, rows.Err()
}

func savingsGoals(ctx context.Context, tx *sql.Tx) (map[string]any, error) {
	rows, err := tx.QueryContext(ctx, `SELECT id,name,balance_micros::text,goal_micros::text,
        GREATEST(goal_micros-balance_micros,0)::text,goal_date,count(*) OVER ()
        FROM financial_accounts WHERE owner=$1 AND currency=$2 AND kind='saving' AND NOT is_deleted
        ORDER BY goal_date NULLS LAST,id LIMIT 100`, util.UserID(ctx), money.Currency(ctx))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	goals := []map[string]any{}
	var count int64
	for rows.Next() {
		var id, name string
		var balance, target, remaining decimalAmount
		var date sql.NullTime
		if err := rows.Scan(&id, &name, &balance, &target, &remaining, &date, &count); err != nil {
			return nil, err
		}
		var targetDate any
		if date.Valid {
			targetDate = date.Time.UTC().Format("2006-01-02")
		}
		goals = append(goals, map[string]any{"id": id, "name": name, "balance": balance, "target": target, "remaining": remaining, "targetDate": targetDate})
	}
	return map[string]any{"goals": goals, "goalCount": count, "truncated": count > int64(len(goals))}, rows.Err()
}

func upcomingSubscriptions(ctx context.Context, tx *sql.Tx, before time.Time) (map[string]any, error) {
	rows, err := tx.QueryContext(ctx, `SELECT s.id,s.name,s.amount_micros::text,s.interval_unit,s.next_active,a.name,
        count(*) OVER (),sum(s.amount_micros) OVER ()::text
        FROM subscriptions s JOIN financial_accounts a ON a.id=s.source_account_id AND a.owner=s.creator AND a.currency=s.currency
        WHERE s.creator=$1 AND s.currency=$2 AND s.is_active AND NOT s.is_deleted AND s.next_active < $3
        ORDER BY s.next_active,s.id LIMIT 100`, util.UserID(ctx), money.Currency(ctx), before)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	subscriptions := []map[string]any{}
	var count int64
	total := decimalAmount("0")
	for rows.Next() {
		var id, name, interval, account string
		var amount decimalAmount
		var next time.Time
		if err := rows.Scan(&id, &name, &amount, &interval, &next, &account, &count, &total); err != nil {
			return nil, err
		}
		subscriptions = append(subscriptions, map[string]any{"id": id, "name": name, "amount": amount, "interval": interval, "nextPayment": next.UTC().Format(time.RFC3339), "account": account})
	}
	return map[string]any{"beforeExclusive": before.Format(time.RFC3339), "includesOverdue": true,
		"coverage":          "one next payment per active subscription; not all renewals in the window or all future bills",
		"nextPaymentsTotal": total, "subscriptionCount": count, "subscriptions": subscriptions, "truncated": count > int64(len(subscriptions))}, rows.Err()
}
