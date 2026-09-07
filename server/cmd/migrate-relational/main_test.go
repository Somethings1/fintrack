package main

import (
	"fintrack/server/model"
	"fintrack/server/money"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"testing"
	"time"
)

func fixtureSnapshot() snapshot {
	account, saving := primitive.NewObjectID(), primitive.NewObjectID()
	category, sub, expense, transfer := primitive.NewObjectID(), primitive.NewObjectID(), primitive.NewObjectID(), primitive.NewObjectID()
	at := time.Date(2026, 9, 1, 12, 0, 0, 0, time.UTC)
	return snapshot{
		Accounts:      []model.Account{{ID: account, Owner: "owner-a", Currency: "USD", Name: "Wallet", OpeningBalance: money.Must("100"), Balance: money.Must("96.8"), LastUpdate: at}},
		Savings:       []model.Saving{{ID: saving, Owner: "owner-a", Currency: "USD", Name: "Trip", OpeningBalance: 0, Balance: money.Must("2.2"), Goal: money.Must("50"), CreatedDate: at, GoalDate: at.AddDate(1, 0, 0), LastUpdate: at}},
		Categories:    []model.Category{{ID: category, Owner: "owner-a", Currency: "USD", Type: "expense", Name: "Food", Budget: money.Must("100"), LastUpdate: at}},
		Subscriptions: []model.Subscription{{ID: sub, Creator: "owner-a", Currency: "USD", ScheduleVersion: 2, Name: "Monthly", Amount: money.Must("1"), SourceAccount: account, Category: category, StartDate: at, Interval: "month", CurrentInterval: 1, IsActive: true, NextActive: at.AddDate(0, 1, 0), LastUpdate: at}},
		Transactions: []model.Transaction{
			{ID: expense, Creator: "owner-a", Currency: "USD", Amount: money.Must("1"), Type: "expense", SourceAccount: account, Category: category, DateTime: at, LastUpdate: at, SubscriptionID: sub, OccurrenceAt: at, RequestKey: "old-request", RequestHash: "old-hash"},
			{ID: transfer, Creator: "owner-a", Currency: "USD", Amount: money.Must("2.2"), Type: "transfer", SourceAccount: account, DestinationAccount: saving, DateTime: at, LastUpdate: at},
			{ID: primitive.NewObjectID(), Creator: "owner-a", Currency: "USD", Amount: money.Must("0.25"), Type: "expense", SourceAccount: account, Category: category, DateTime: at, LastUpdate: at, IsDeleted: true},
		},
		Notifications: []model.Notification{{ID: primitive.NewObjectID(), Owner: "owner-a", Type: model.TypeSubscription, ReferenceId: sub, OccurrenceKey: "old-reminder", Title: "Reminder", ScheduledAt: at, LastUpdate: at}},
	}
}

func TestPlanDigestIncludesPrivatePersistenceFields(t *testing.T) {
	mutations := map[string]func(*snapshot){
		"account opening":        func(s *snapshot) { s.Accounts[0].OpeningBalance++ },
		"saving opening":         func(s *snapshot) { s.Savings[0].OpeningBalance++ },
		"request key":            func(s *snapshot) { s.Transactions[0].RequestKey += "changed" },
		"request hash":           func(s *snapshot) { s.Transactions[0].RequestHash += "changed" },
		"subscription reference": func(s *snapshot) { s.Transactions[0].SubscriptionID = primitive.NewObjectID() },
		"occurrence time": func(s *snapshot) {
			s.Transactions[0].OccurrenceAt = s.Transactions[0].OccurrenceAt.Add(time.Millisecond)
		},
		"schedule version":       func(s *snapshot) { s.Subscriptions[0].ScheduleVersion++ },
		"reminder deduplication": func(s *snapshot) { s.Notifications[0].OccurrenceKey += "changed" },
		"tombstone":              func(s *snapshot) { s.Transactions[0].IsDeleted = true },
	}
	for name, change := range mutations {
		t.Run(name, func(t *testing.T) {
			s := fixtureSnapshot()
			before, err := snapshotPlan(s)
			if err != nil {
				t.Fatal(err)
			}
			repeated, err := snapshotPlan(s)
			if err != nil || repeated.Digest != before.Digest {
				t.Fatal("digest is not deterministic", err)
			}
			change(&s)
			after, err := snapshotPlan(s)
			if err != nil {
				t.Fatal(err)
			}
			if after.Digest == before.Digest {
				t.Fatal("reviewed plan failed to bind private financial metadata")
			}
		})
	}
}
