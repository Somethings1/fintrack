//go:build integration

package main

import (
	"context"
	"database/sql"
	"fintrack/server/money"
	"fintrack/server/util"
	"github.com/google/uuid"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"os"
	"strings"
	"testing"
	"time"
)

func importerDatabase(t *testing.T) context.Context {
	t.Helper()
	const url = "postgres://fintrack:fintrack@127.0.0.1:55432/fintrack?sslmode=disable"
	if os.Getenv("DATABASE_TEST_URL") != url {
		t.Fatal("import tests only permit the disposable loopback database")
	}
	admin, err := sql.Open("pgx", url)
	if err != nil {
		t.Fatal(err)
	}
	name := "fintrack_import_" + strings.ReplaceAll(uuid.NewString(), "-", "")
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	if _, err := admin.ExecContext(ctx, `CREATE DATABASE "`+name+`"`); err != nil {
		cancel()
		admin.Close()
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_ = util.CloseDB()
		cleanup, stop := context.WithTimeout(context.Background(), 10*time.Second)
		defer stop()
		if _, err := admin.ExecContext(cleanup, `DROP DATABASE "`+name+`" WITH (FORCE)`); err != nil {
			t.Error(err)
		}
		_ = admin.Close()
		cancel()
	})
	if err := util.InitDB(ctx, strings.Replace(url, "/fintrack?", "/"+name+"?", 1)); err != nil {
		t.Fatal(err)
	}
	if err := util.EnsureLedger(ctx, "USD"); err != nil {
		t.Fatal(err)
	}
	return ctx
}

func TestRelationalImportPreservesLedgerAndRefusesOverwrite(t *testing.T) {
	ctx := importerDatabase(t)
	s := fixtureSnapshot()
	if err := apply(ctx, s, "USD"); err != nil {
		t.Fatal(err)
	}
	var balance, opening int64
	if err := util.DB.QueryRowContext(ctx, `SELECT balance_micros,opening_balance_micros FROM financial_accounts WHERE id=$1`, s.Accounts[0].ID.Hex()).Scan(&balance, &opening); err != nil {
		t.Fatal(err)
	}
	if money.Amount(balance) != s.Accounts[0].Balance || money.Amount(opening) != s.Accounts[0].OpeningBalance {
		t.Fatal("import changed exact balances")
	}
	var key, hash, subscription string
	var occurrence time.Time
	if err := util.DB.QueryRowContext(ctx, `SELECT request_key,request_hash,subscription_id,occurrence_at FROM transactions WHERE id=$1`, s.Transactions[0].ID.Hex()).Scan(&key, &hash, &subscription, &occurrence); err != nil {
		t.Fatal(err)
	}
	if key != "old-request" || hash != "old-hash" || subscription != s.Subscriptions[0].ID.Hex() || !occurrence.Equal(s.Transactions[0].OccurrenceAt) {
		t.Fatal("lost private transaction metadata")
	}
	var count int
	if err := util.DB.QueryRowContext(ctx, `SELECT count(*) FROM transactions WHERE is_deleted`).Scan(&count); err != nil || count != 1 {
		t.Fatal("lost tombstone", count, err)
	}
	if err := apply(ctx, s, "USD"); err == nil {
		t.Fatal("import overwrote non-empty ledger")
	}
	if err := util.DB.QueryRowContext(ctx, `SELECT count(*) FROM transactions`).Scan(&count); err != nil || count != 3 {
		t.Fatal("failed overwrite changed ledger", count, err)
	}
}

func TestRelationalImportRollsBackInvalidSnapshots(t *testing.T) {
	cases := map[string]func(*snapshot){
		"unreconciled balance":  func(s *snapshot) { s.Accounts[0].Balance += money.Must("1") },
		"missing foreign key":   func(s *snapshot) { s.Transactions[1].DestinationAccount = primitive.NewObjectID() },
		"cross-owner reference": func(s *snapshot) { s.Transactions[0].Creator = "owner-b" },
		"wrong currency":        func(s *snapshot) { s.Transactions[0].Currency = "EUR" },
	}
	for name, mutate := range cases {
		t.Run(name, func(t *testing.T) {
			ctx := importerDatabase(t)
			s := fixtureSnapshot()
			mutate(&s)
			if err := apply(ctx, s, "USD"); err == nil {
				t.Fatal("invalid import accepted")
			}
			for _, table := range []string{"financial_accounts", "categories", "subscriptions", "transactions", "notifications"} {
				var count int
				if err := util.DB.QueryRowContext(ctx, `SELECT count(*) FROM `+table).Scan(&count); err != nil || count != 0 {
					t.Fatal("partial import remained", table, count, err)
				}
			}
		})
	}
}
