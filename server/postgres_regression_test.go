//go:build integration

package main

import (
	"context"
	"database/sql"
	"errors"
	"fintrack/server/model"
	"fintrack/server/money"
	"fintrack/server/service"
	"fintrack/server/util"
	"fmt"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"sync"
	"testing"
	"time"
)

func regressionContext(t *testing.T) context.Context {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 40*time.Second)
	t.Cleanup(cancel)
	return money.WithCurrency(context.WithValue(ctx, util.UserIdKey, "owner-a"), "USD")
}
func regressionAccount(t *testing.T, ctx context.Context, balance money.Amount) primitive.ObjectID {
	t.Helper()
	id, err := service.AddAccount(ctx, model.Account{Name: "Wallet", Balance: balance})
	if err != nil {
		t.Fatal(err)
	}
	return id.(primitive.ObjectID)
}
func regressionCategory(t *testing.T, ctx context.Context, kind string) primitive.ObjectID {
	t.Helper()
	id, err := service.AddCategory(ctx, model.Category{Name: "Category", Type: kind})
	if err != nil {
		t.Fatal(err)
	}
	return id.(primitive.ObjectID)
}
func regressionBalance(t *testing.T, ctx context.Context, id primitive.ObjectID, want money.Amount) {
	t.Helper()
	var got int64
	if err := util.DB.QueryRowContext(ctx, `SELECT balance_micros FROM financial_accounts WHERE id=$1`, id.Hex()).Scan(&got); err != nil {
		t.Fatal(err)
	}
	if money.Amount(got) != want {
		t.Fatalf("balance=%d want=%d", got, want)
	}
}
func parallelCalls(n int, call func(int) error) []error {
	start := make(chan struct{})
	out := make([]error, n)
	var wg sync.WaitGroup
	for i := range n {
		wg.Add(1)
		go func(i int) { defer wg.Done(); <-start; out[i] = call(i) }(i)
	}
	close(start)
	wg.Wait()
	return out
}

func TestPostgresConcurrentTransfersAndIdempotency(t *testing.T) {
	resetTestDatabase(t)
	ctx := regressionContext(t)
	a := regressionAccount(t, ctx, money.Must("100"))
	b := regressionAccount(t, ctx, money.Must("100"))
	at := time.Date(2026, 9, 1, 12, 0, 0, 0, time.UTC)
	for _, err := range parallelCalls(24, func(i int) error {
		src, dst := a, b
		if i%2 == 1 {
			src, dst = b, a
		}
		_, err := service.AddTransaction(context.WithValue(ctx, util.RequestKey, fmt.Sprintf("opposite-%d", i)), model.Transaction{Type: "transfer", SourceAccount: src, DestinationAccount: dst, Amount: money.Must("0.1"), DateTime: at})
		return err
	}) {
		if err != nil {
			t.Fatal("opposite transfers failed", err)
		}
	}
	regressionBalance(t, ctx, a, money.Must("100"))
	regressionBalance(t, ctx, b, money.Must("100"))

	category := regressionCategory(t, ctx, "expense")
	request := model.Transaction{Type: "expense", SourceAccount: a, Category: category, Amount: money.Must("0.1"), DateTime: at}
	ids := make([]primitive.ObjectID, 12)
	for _, err := range parallelCalls(len(ids), func(i int) error {
		id, err := service.AddTransaction(context.WithValue(ctx, util.RequestKey, "same-request"), request)
		if err == nil {
			ids[i] = id.(primitive.ObjectID)
		}
		return err
	}) {
		if err != nil {
			t.Fatal("duplicate request failed", err)
		}
	}
	for _, id := range ids {
		if id != ids[0] {
			t.Fatal("duplicate request returned different IDs")
		}
	}
	regressionBalance(t, ctx, a, money.Must("99.9"))

	// A concurrent conflicting payload must return a conflict, not a generic
	// database error, and cannot leave either of its tentative postings behind.
	results := parallelCalls(2, func(i int) error {
		v := request
		v.Amount = money.Amount(i+1) * money.Must("1")
		_, err := service.AddTransaction(context.WithValue(ctx, util.RequestKey, "conflicting-request"), v)
		return err
	})
	successes, conflicts := 0, 0
	for _, err := range results {
		if err == nil {
			successes++
		} else if errors.Is(err, service.ErrIdempotencyConflict) {
			conflicts++
		} else {
			t.Fatal(err)
		}
	}
	if successes != 1 || conflicts != 1 {
		t.Fatalf("successes=%d conflicts=%d", successes, conflicts)
	}
	var count int
	if err := util.DB.QueryRowContext(ctx, `SELECT count(*) FROM transactions WHERE request_key='conflicting-request'`).Scan(&count); err != nil || count != 1 {
		t.Fatal("conflicting retry double posted", count, err)
	}
}

func TestPostgresRollbackAndTypeChange(t *testing.T) {
	resetTestDatabase(t)
	ctx := regressionContext(t)
	a := regressionAccount(t, ctx, money.Must("10"))
	full := regressionAccount(t, ctx, money.Max)
	expense := regressionCategory(t, ctx, "expense")
	income := regressionCategory(t, ctx, "income")
	at := time.Now().UTC().Truncate(time.Millisecond)
	_, err := service.AddTransaction(ctx, model.Transaction{Type: "transfer", SourceAccount: a, DestinationAccount: full, Amount: money.Must("1"), DateTime: at})
	if err == nil {
		t.Fatal("overflowing destination accepted")
	}
	regressionBalance(t, ctx, a, money.Must("10"))
	regressionBalance(t, ctx, full, money.Max)
	var count int
	if err := util.DB.QueryRowContext(ctx, `SELECT count(*) FROM transactions`).Scan(&count); err != nil || count != 0 {
		t.Fatal("failed write persisted", count, err)
	}

	id, err := service.AddTransaction(ctx, model.Transaction{Type: "expense", SourceAccount: a, Category: expense, Amount: money.Must("2"), DateTime: at})
	if err != nil {
		t.Fatal(err)
	}
	if err := service.UpdateTransaction(ctx, id.(primitive.ObjectID), model.Transaction{Type: "income", DestinationAccount: a, Category: income, Amount: money.Must("3"), DateTime: at}); err != nil {
		t.Fatal(err)
	}
	regressionBalance(t, ctx, a, money.Must("13"))
	stored, err := service.GetTransactionByID(ctx, id.(primitive.ObjectID).Hex())
	if err != nil || !stored.SourceAccount.IsZero() || stored.DestinationAccount != a {
		t.Fatal("stale transaction reference", stored, err)
	}
	if err := service.DeleteTransaction(ctx, id.(primitive.ObjectID)); err != nil {
		t.Fatal(err)
	}
	regressionBalance(t, ctx, a, money.Must("10"))
	if err := service.DeleteTransaction(ctx, id.(primitive.ObjectID)); !errors.Is(err, sql.ErrNoRows) {
		t.Fatal("repeated delete did not reject tombstone", err)
	}
	regressionBalance(t, ctx, a, money.Must("10"))
}

func TestPostgresReminderDeduplicationAndOccurrenceRollback(t *testing.T) {
	resetTestDatabase(t)
	ctx := regressionContext(t)
	a := regressionAccount(t, ctx, -money.Max)
	category := regressionCategory(t, ctx, "expense")
	start := time.Date(2026, 9, 2, 12, 0, 0, 0, time.UTC)
	s, err := service.AddSubscription(ctx, model.Subscription{Name: "Reminder", SourceAccount: a, Category: category, Amount: money.Must("1"), StartDate: start, Interval: "month", RemindBefore: 1})
	if err != nil {
		t.Fatal(err)
	}
	id := s.(primitive.ObjectID)
	notify := start.Add(-24 * time.Hour)
	for _, err := range parallelCalls(12, func(int) error {
		_, err := service.ProcessReminder(ctx, id, notify, notify, "USD")
		return err
	}) {
		if err != nil {
			t.Fatal(err)
		}
	}
	var count int
	if err := util.DB.QueryRowContext(ctx, `SELECT count(*) FROM notifications WHERE reference_id=$1`, id.Hex()).Scan(&count); err != nil || count != 1 {
		t.Fatal("reminder deduplication failed", count, err)
	}
	if posted, err := service.ProcessOccurrence(ctx, id, start, start, "USD"); err == nil || posted {
		t.Fatal("out-of-range occurrence should roll back")
	}
	stored, err := service.GetSubscriptionById(ctx, id.Hex())
	if err != nil || stored.CurrentInterval != 0 || !stored.NextActive.Equal(start) {
		t.Fatal("failed occurrence advanced schedule", stored, err)
	}
	if err := util.DB.QueryRowContext(ctx, `SELECT count(*) FROM transactions WHERE subscription_id=$1`, id.Hex()).Scan(&count); err != nil || count != 0 {
		t.Fatal("failed occurrence persisted", count, err)
	}
	regressionBalance(t, ctx, a, -money.Max)
}

func TestPostgresSyncPaginationIncludesTombstonesAndIsolatesOwners(t *testing.T) {
	resetTestDatabase(t)
	ctx := regressionContext(t)
	at := time.Date(2026, 9, 1, 12, 0, 0, 0, time.UTC)
	for i := range 505 {
		id := regressionAccount(t, ctx, 0)
		if _, err := util.DB.ExecContext(ctx, `UPDATE financial_accounts SET last_update=$1,is_deleted=$2 WHERE id=$3`, at, i == 3, id.Hex()); err != nil {
			t.Fatal(err)
		}
	}
	foreign := money.WithCurrency(context.WithValue(ctx, util.UserIdKey, "owner-b"), "USD")
	regressionAccount(t, foreign, money.Must("1"))
	rows, more, err := service.SyncAccounts(ctx, "owner-a", at, time.Time{}, primitive.NilObjectID, 500)
	if err != nil || !more || len(rows) != 500 {
		t.Fatal("wrong first page", len(rows), more, err)
	}
	last := rows[len(rows)-1]
	tail, more, err := service.SyncAccounts(ctx, "owner-a", at, last.LastUpdate, last.ID, 500)
	if err != nil || more || len(tail) != 5 {
		t.Fatal("wrong final page", len(tail), more, err)
	}
	seen := map[primitive.ObjectID]bool{}
	deleted := 0
	for _, row := range append(rows, tail...) {
		if seen[row.ID] || row.Owner != "owner-a" {
			t.Fatal("duplicate or foreign row in sync")
		}
		seen[row.ID] = true
		if row.IsDeleted {
			deleted++
		}
	}
	if deleted != 1 {
		t.Fatal("sync omitted tombstone")
	}
}

func TestPostgresLedgerDeniesBrowserAccess(t *testing.T) {
	resetTestDatabase(t)
	ctx := regressionContext(t)
	regressionAccount(t, ctx, money.Must("5"))
	tx, err := util.DB.BeginTx(ctx, nil)
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback()
	// A synthetic role models an accidentally granted browser role. RLS must
	// still deny financial rows. Role/grant changes roll back with this test.
	for _, query := range []string{
		`CREATE ROLE fintrack_test_browser NOLOGIN NOSUPERUSER NOBYPASSRLS`,
		`GRANT USAGE ON SCHEMA public TO fintrack_test_browser`,
		`GRANT SELECT,INSERT ON financial_accounts TO fintrack_test_browser`,
		`SET LOCAL ROLE fintrack_test_browser`,
	} {
		if _, err := tx.ExecContext(ctx, query); err != nil {
			t.Fatal(err)
		}
	}
	var count int
	if err := tx.QueryRowContext(ctx, `SELECT count(*) FROM financial_accounts`).Scan(&count); err != nil || count != 0 {
		t.Fatal("browser can read ledger", count, err)
	}
	_, err = tx.ExecContext(ctx, `INSERT INTO financial_accounts(id,owner,kind,currency,opening_balance_micros,balance_micros,name) VALUES('111111111111111111111111','owner-a','account','USD',0,0,'forged')`)
	if err == nil {
		t.Fatal("browser can write ledger")
	}
}
