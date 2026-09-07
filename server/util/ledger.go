package util

import (
	"context"
	"errors"
	"fintrack/server/money"
	"fmt"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// EnsureLedger rejects mixed storage and currency changes before accepting traffic.
// Conversion is NEVER an implicit startup side effect. Fresh databases are safe.
func EnsureLedger(ctx context.Context, currency string) error {
	if _, err := money.Precision(currency); err != nil {
		return err
	}
	db := AccountCollection.Database()
	for collection, fields := range MonetaryFields {
		for _, field := range fields {
			n, err := db.Collection(collection).CountDocuments(ctx, bson.M{field: bson.M{"$not": bson.M{"$type": "decimal"}}}, options.Count().SetLimit(1))
			if err != nil {
				return err
			}
			if n > 0 {
				return fmt.Errorf("%s.%s requires a reviewed offline money migration", collection, field)
			}
		}
		n, err := db.Collection(collection).CountDocuments(ctx, bson.M{"currency": bson.M{"$ne": currency}}, options.Count().SetLimit(1))
		if err != nil {
			return err
		}
		if n > 0 {
			return fmt.Errorf("%s contains absent or incompatible ledger currency", collection)
		}
	}
	metadata := db.Collection("schema_metadata")
	_, err := metadata.UpdateOne(ctx, bson.M{"_id": "money_v1"}, bson.M{"$setOnInsert": bson.M{"currency": currency, "storage": "decimal128", "version": 1}}, options.Update().SetUpsert(true))
	if err != nil {
		return err
	}
	var meta struct {
		Currency string `bson:"currency"`
		Version  int    `bson:"version"`
	}
	if err := metadata.FindOne(ctx, bson.M{"_id": "money_v1"}).Decode(&meta); err != nil {
		return err
	}
	if meta.Currency != currency || meta.Version != 1 {
		return errors.New("immutable ledger configuration mismatch")
	}
	return nil
}

var MonetaryFields = map[string][]string{
	"accounts": {"balance", "opening_balance"}, "savings": {"balance", "opening_balance", "goal"},
	"categories": {"budget"}, "transactions": {"amount"}, "subscriptions": {"amount"},
}

// LedgerIndexes are independent of legacy single-field indexes.
func ledgerIndexes(ctx context.Context) error {
	for _, item := range []struct {
		c     *mongo.Collection
		index mongo.IndexModel
	}{
		{TransactionCollection, mongo.IndexModel{Keys: bson.D{{Key: "creator", Value: 1}, {Key: "subscription_id", Value: 1}, {Key: "occurrence_at", Value: 1}}, Options: options.Index().SetName("subscription_occurrence_v1").SetUnique(true).SetPartialFilterExpression(bson.M{"subscription_id": bson.M{"$exists": true}})}},
		{NotificationCollection, mongo.IndexModel{Keys: bson.D{{Key: "owner", Value: 1}, {Key: "occurrence_key", Value: 1}}, Options: options.Index().SetName("reminder_occurrence_v1").SetUnique(true).SetPartialFilterExpression(bson.M{"occurrence_key": bson.M{"$exists": true}})}},
		{SubscriptionCollection, mongo.IndexModel{Keys: bson.D{{Key: "schedule_version", Value: 1}, {Key: "is_active", Value: 1}, {Key: "is_deleted", Value: 1}, {Key: "next_active", Value: 1}, {Key: "_id", Value: 1}}, Options: options.Index().SetName("subscription_due_v2")}},
		{SubscriptionCollection, mongo.IndexModel{Keys: bson.D{{Key: "schedule_version", Value: 1}, {Key: "is_active", Value: 1}, {Key: "is_deleted", Value: 1}, {Key: "notify_at", Value: 1}, {Key: "_id", Value: 1}}, Options: options.Index().SetName("subscription_reminder_v2")}},
	} {
		if _, err := item.c.Indexes().CreateOne(ctx, item.index); err != nil {
			return err
		}
	}
	return nil
}
