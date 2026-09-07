package util

import (
	"context"
	"errors"
	"fintrack/server/money"
	"fmt"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"go.mongodb.org/mongo-driver/mongo/readconcern"
	"go.mongodb.org/mongo-driver/mongo/readpref"
	"go.mongodb.org/mongo-driver/mongo/writeconcern"
	"time"
)

var (
	MongoClient                                                                                                                    *mongo.Client
	AccountCollection, TransactionCollection, CategoryCollection, SavingCollection, SubscriptionCollection, NotificationCollection *mongo.Collection
)

func InitDB(ctx context.Context, uri, database string) error {
	client, err := mongo.Connect(ctx, options.Client().ApplyURI(uri).
		SetMaxPoolSize(50).SetMinPoolSize(0).SetMaxConnIdleTime(5*time.Minute).
		SetConnectTimeout(5*time.Second).SetServerSelectionTimeout(5*time.Second))
	if err != nil {
		return fmt.Errorf("database connection failed")
	}
	if err = client.Ping(ctx, readpref.Primary()); err != nil {
		_ = client.Disconnect(ctx)
		return fmt.Errorf("database readiness check failed")
	}
	MongoClient = client
	db := client.Database(database)
	AccountCollection, TransactionCollection = db.Collection("accounts"), db.Collection("transactions")
	CategoryCollection, SavingCollection = db.Collection("categories"), db.Collection("savings")
	SubscriptionCollection, NotificationCollection = db.Collection("subscriptions"), db.Collection("notifications")
	// Align equality + range/sort with actual per-user synchronization queries.
	// Existing indexes are not dropped; perform an explain-plan review before retiring them.
	for _, item := range []struct {
		collection *mongo.Collection
		tenant     string
	}{
		{AccountCollection, "owner"}, {TransactionCollection, "creator"}, {CategoryCollection, "owner"},
		{SavingCollection, "owner"}, {SubscriptionCollection, "creator"}, {NotificationCollection, "owner"},
	} {
		_, err := item.collection.Indexes().CreateOne(ctx, mongo.IndexModel{
			Keys:    bson.D{{Key: item.tenant, Value: 1}, {Key: "last_update", Value: -1}, {Key: "_id", Value: -1}},
			Options: options.Index().SetName("tenant_sync_v1"),
		})
		if err != nil {
			return fmt.Errorf("database index creation failed for %s", item.collection.Name())
		}
	}
	_, err = TransactionCollection.Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys:    bson.D{{Key: "creator", Value: 1}, {Key: "request_key", Value: 1}},
		Options: options.Index().SetName("transaction_request_key_v1").SetUnique(true).SetPartialFilterExpression(bson.M{"request_key": bson.M{"$exists": true}}),
	})
	if err != nil {
		return errors.New("transaction idempotency index creation failed")
	}
	return ledgerIndexes(ctx)
}

// TenantFilter never falls back to an unscoped query, even if the context is missing.
func TenantFilter(ctx context.Context, field string, id primitive.ObjectID) bson.M {
	user, _ := ctx.Value(UserIdKey).(string)
	filter := bson.M{"_id": id, field: user, "is_deleted": bson.M{"$ne": true}}
	if user == "" {
		filter["_id"] = bson.M{"$exists": false}
	}
	return filter
}

func AdjustBalance(sc mongo.SessionContext, id primitive.ObjectID, amount money.Amount) (int64, error) {
	if id.IsZero() {
		return 0, nil
	}
	currency := money.Currency(sc)
	if err := money.Validate(amount, currency); err != nil {
		return 0, err
	}
	filter := TenantFilter(sc, "owner", id)
	filter["currency"] = currency
	for _, collection := range []*mongo.Collection{AccountCollection, SavingCollection} {
		var row struct {
			Balance money.Amount `bson:"balance"`
		}
		err := collection.FindOne(sc, filter).Decode(&row)
		if errors.Is(err, mongo.ErrNoDocuments) {
			continue
		}
		if err != nil {
			return 0, err
		}
		if _, err := money.Add(row.Balance, amount); err != nil {
			return 0, err
		}
		result, err := collection.UpdateOne(sc, filter, bson.M{"$inc": bson.M{"balance": amount}, "$set": bson.M{"last_update": time.Now().UTC()}})
		if err != nil {
			return 0, err
		}
		if result.MatchedCount != 1 {
			return 0, mongo.ErrNoDocuments
		}
		return result.ModifiedCount, nil
	}
	return 0, errors.New("account is missing, deleted, in a different currency, or not owned")
}

// StartLedgerSession pins financial transactions to durable majority writes and
// snapshot reads even when an operator supplies a weaker default URI setting.
func StartLedgerSession() (mongo.Session, error) {
	return MongoClient.StartSession(options.Session().SetDefaultReadConcern(readconcern.Snapshot()).SetDefaultWriteConcern(writeconcern.Majority()).SetDefaultReadPreference(readpref.Primary()))
}
