//go:build integration

package main

import (
	"context"
	"fintrack/server/migration"
	"fintrack/server/model"
	"fintrack/server/money"
	"fintrack/server/service"
	"fintrack/server/util"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"os"
	"sync"
	"testing"
	"time"
)

func ledgerDB(t *testing.T) (context.Context, *mongo.Database) {
	t.Helper()
	uri := os.Getenv("MONGO_TEST_URI")
	if uri == "" {
		t.Fatal("MONGO_TEST_URI required")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
	database := "fintrack_ledger_ci_" + primitive.NewObjectID().Hex()
	if err := util.InitDB(ctx, uri, database); err != nil {
		cancel()
		t.Fatal(err)
	}
	db := util.MongoClient.Database(database)
	t.Cleanup(func() {
		cleanup, stop := context.WithTimeout(context.Background(), 10*time.Second)
		defer stop()
		_ = db.Drop(cleanup)
		_ = util.MongoClient.Disconnect(cleanup)
		cancel()
	})
	return ctx, db
}
func TestExactMoneyAndConcurrentRecurringPayments(t *testing.T) {
	ctx, _ := ledgerDB(t)
	ctx = money.WithCurrency(context.WithValue(ctx, util.UserIdKey, "owner-a"), "USD")
	if err := util.EnsureLedger(ctx, "USD"); err != nil {
		t.Fatal(err)
	}
	a, err := service.AddAccount(ctx, model.Account{Name: "Wallet", Balance: money.Must("100")})
	if err != nil {
		t.Fatal(err)
	}
	account := a.(primitive.ObjectID)
	c, err := service.AddCategory(ctx, model.Category{Name: "Food", Type: "expense"})
	if err != nil {
		t.Fatal(err)
	}
	category := c.(primitive.ObjectID)
	balance := func() money.Amount {
		t.Helper()
		var a model.Account
		if err := util.AccountCollection.FindOne(ctx, bson.M{"_id": account}).Decode(&a); err != nil {
			t.Fatal(err)
		}
		return a.Balance
	}
	start := time.Date(2026, 1, 31, 12, 0, 0, 0, time.UTC)
	spec := model.Subscription{Name: "Monthly", Amount: money.Must("0.1"), SourceAccount: account, Category: category, StartDate: start, Interval: "month", MaxInterval: 2, RemindBefore: 1}
	inserted, err := service.AddSubscription(ctx, spec)
	if err != nil {
		t.Fatal(err)
	}
	id := inserted.(primitive.ObjectID)
	var wg sync.WaitGroup
	outcomes := make(chan error, 16)
	for i := 0; i < 16; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, err := service.ProcessOccurrence(ctx, id, start, start, "USD")
			outcomes <- err
		}()
	}
	wg.Wait()
	close(outcomes)
	for err := range outcomes {
		if err != nil {
			t.Fatal(err)
		}
	}
	count, _ := util.TransactionCollection.CountDocuments(ctx, bson.M{"subscription_id": id})
	if count != 1 || balance() != money.Must("99.9") {
		t.Fatal("duplicate occurrence or inexact balance", count, balance())
	}
	var sub model.Subscription
	if err := util.SubscriptionCollection.FindOne(ctx, bson.M{"_id": id}).Decode(&sub); err != nil {
		t.Fatal(err)
	}
	if sub.CurrentInterval != 1 || sub.NextActive.Format("2006-01-02") != "2026-02-28" {
		t.Fatal("wrong anchor or count", sub)
	}
	// Retrying reminders and editing future amount never duplicate a reminder.
	reminderTime := sub.NextActive.Add(-12 * time.Hour)
	for i := 0; i < 3; i++ {
		if _, err := service.ProcessReminder(ctx, id, sub.NotifyAt, reminderTime, "USD"); err != nil {
			t.Fatal(err)
		}
	}
	reminders, _ := util.NotificationCollection.CountDocuments(ctx, bson.M{"reference_id": id})
	if reminders != 1 {
		t.Fatal("duplicate reminders")
	}
	changed := spec
	changed.StartDate = start.AddDate(0, 0, 1)
	if service.UpdateSubscription(ctx, id, changed) == nil {
		t.Fatal("posted schedule reset accepted")
	}
	changed = spec
	changed.Amount = money.Must("0.2")
	if err := service.UpdateSubscription(ctx, id, changed); err != nil {
		t.Fatal(err)
	}
	if _, err := service.ProcessReminder(ctx, id, sub.NotifyAt, reminderTime, "USD"); err != nil {
		t.Fatal(err)
	}
	reminders, _ = util.NotificationCollection.CountDocuments(ctx, bson.M{"reference_id": id})
	if reminders != 1 {
		t.Fatal("edit repeated reminder")
	}
	if _, err := service.ProcessOccurrence(ctx, id, sub.NextActive, sub.NextActive, "USD"); err != nil {
		t.Fatal(err)
	}
	if balance() != money.Must("99.7") {
		t.Fatal("not exact after 0.1 + 0.2", balance())
	}
	if err := util.SubscriptionCollection.FindOne(ctx, bson.M{"_id": id}).Decode(&sub); err != nil {
		t.Fatal(err)
	}
	if sub.IsActive || sub.CurrentInterval != 2 {
		t.Fatal("max interval did not stop processing")
	}
	if _, err := service.ProcessOccurrence(ctx, id, sub.NextActive, sub.NextActive, "USD"); err != nil {
		t.Fatal(err)
	}
	count, _ = util.TransactionCollection.CountDocuments(ctx, bson.M{"subscription_id": id})
	if count != 2 {
		t.Fatal("completed schedule posted again")
	}
	// A stale metadata edit cannot overwrite either the current or opening balance.
	if err := service.UpdateAccount(ctx, account, model.Account{Name: "Renamed", Balance: money.Must("999")}); err != nil {
		t.Fatal(err)
	}
	if balance() != money.Must("99.7") {
		t.Fatal("metadata update clobbered balance")
	}
	// Invalid references roll back schedule advancement AND the balance posting.
	broken := spec
	broken.StartDate = start.AddDate(0, 0, 1)
	inserted, err = service.AddSubscription(ctx, broken)
	if err != nil {
		t.Fatal(err)
	}
	brokenID := inserted.(primitive.ObjectID)
	if _, err := util.CategoryCollection.UpdateOne(ctx, bson.M{"_id": category}, bson.M{"$set": bson.M{"is_deleted": true}}); err != nil {
		t.Fatal(err)
	}
	if _, err := service.ProcessOccurrence(ctx, brokenID, broken.StartDate, broken.StartDate, "USD"); err == nil {
		t.Fatal("deleted reference accepted")
	}
	var pending model.Subscription
	if err := util.SubscriptionCollection.FindOne(ctx, bson.M{"_id": brokenID}).Decode(&pending); err != nil {
		t.Fatal(err)
	}
	if pending.CurrentInterval != 0 || balance() != money.Must("99.7") {
		t.Fatal("partial occurrence committed")
	}
	count, _ = util.TransactionCollection.CountDocuments(ctx, bson.M{"subscription_id": brokenID})
	if count != 0 {
		t.Fatal("failed occurrence inserted transaction")
	}
	if _, err := service.AddAccount(money.WithCurrency(ctx, "EUR"), model.Account{Name: "Wrong", Currency: "USD"}); err == nil {
		t.Fatal("currency mismatch accepted")
	}
	// Stored BSON must be Decimal128, not int64 millionths or doubles.
	raw, err := util.AccountCollection.FindOne(ctx, bson.M{"_id": account}).Raw()
	if err != nil {
		t.Fatal(err)
	}
	d, ok := raw.Lookup("balance").Decimal128OK()
	if !ok || d.String() != "99.7" {
		t.Fatal("not exact decimal storage", d)
	}
}
func TestOfflineMoneyMigrationAndReconciliation(t *testing.T) {
	ctx, db := ledgerDB(t)
	a, c, tx := primitive.NewObjectID(), primitive.NewObjectID(), primitive.NewObjectID()
	if _, err := db.Collection("accounts").InsertOne(ctx, bson.M{"_id": a, "owner": "owner-a", "name": "Old", "balance": 0.3, "last_update": time.Now(), "is_deleted": false}); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Collection("categories").InsertOne(ctx, bson.M{"_id": c, "owner": "owner-a", "type": "expense", "budget": 10.0}); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Collection("transactions").InsertOne(ctx, bson.M{"_id": tx, "creator": "owner-a", "amount": 0.2, "source_account": a, "category": c, "type": "expense", "date_time": time.Now(), "is_deleted": false}); err != nil {
		t.Fatal(err)
	}
	if util.EnsureLedger(ctx, "USD") == nil {
		t.Fatal("legacy floats accepted at startup")
	}
	plan, err := migration.Build(ctx, db, "USD", nil)
	if err != nil || len(plan.Issues) > 0 {
		t.Fatal(plan.Issues, err)
	}
	again, err := migration.Build(ctx, db, "USD", nil)
	if err != nil || again.Digest != plan.Digest {
		t.Fatal("non-deterministic plan")
	}
	if plan.Balances[0].Opening != money.Must("0.5") || !plan.Balances[0].Inferred {
		t.Fatal("incorrect historical opening inference")
	}
	if migration.Apply(ctx, db, plan, "wrong", true) == nil || migration.Apply(ctx, db, plan, plan.Digest, false) == nil {
		t.Fatal("unreviewed migration allowed")
	}
	if _, err := db.Collection("accounts").UpdateByID(ctx, a, bson.M{"$set": bson.M{"name": "Changed after plan"}}); err != nil {
		t.Fatal(err)
	}
	if migration.Apply(ctx, db, plan, plan.Digest, true) == nil {
		t.Fatal("stale plan overwrote changed record")
	}
	plan, err = migration.Build(ctx, db, "USD", nil)
	if err != nil {
		t.Fatal(err)
	}
	if err := migration.Apply(ctx, db, plan, plan.Digest, true); err != nil {
		t.Fatal(err)
	}
	if err := util.EnsureLedger(ctx, "USD"); err != nil {
		t.Fatal(err)
	}
	if util.EnsureLedger(ctx, "EUR") == nil {
		t.Fatal("currency reinterpretation allowed")
	}
	var account model.Account
	if err := db.Collection("accounts").FindOne(ctx, bson.M{"_id": a}).Decode(&account); err != nil {
		t.Fatal(err)
	}
	if account.OpeningBalance != money.Must("0.5") || account.Balance != money.Must("0.3") {
		t.Fatal("migration altered value")
	}
	plan, err = migration.Build(ctx, db, "USD", nil)
	if err != nil || plan.Changes != 0 || len(plan.Issues) > 0 {
		t.Fatal("migration not idempotent", plan.Changes, plan.Issues, err)
	}
	if _, err := db.Collection("accounts").InsertOne(ctx, bson.M{"_id": primitive.NewObjectID(), "owner": "owner-b", "balance": 0.30000000000000004}); err != nil {
		t.Fatal(err)
	}
	plan, err = migration.Build(ctx, db, "USD", nil)
	if err != nil {
		t.Fatal(err)
	}
	if len(plan.Issues) == 0 || migration.Apply(ctx, db, plan, plan.Digest, true) == nil {
		t.Fatal("silent rounding accepted")
	}
}
