package util

import (
	"context"
	"errors"
	"fmt"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"go.mongodb.org/mongo-driver/mongo/readpref"
	"math"
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
	return nil
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

func AdjustBalance(sc mongo.SessionContext, id primitive.ObjectID, amount float64) (int64, error) {
	if id == primitive.NilObjectID {
		return 0, nil
	} // income/expense have one absent side
	if math.IsNaN(amount) || math.IsInf(amount, 0) {
		return 0, errors.New("invalid balance adjustment")
	}
	filter := TenantFilter(sc, "owner", id)
	update := bson.M{"$inc": bson.M{"balance": amount}, "$set": bson.M{"last_update": time.Now().UTC()}}
	for _, collection := range []*mongo.Collection{AccountCollection, SavingCollection} {
		result, err := collection.UpdateOne(sc, filter, update)
		if err != nil {
			return 0, err
		}
		if result.MatchedCount == 1 {
			return result.ModifiedCount, nil
		}
	}
	return 0, errors.New("account is missing, deleted or not owned by the authenticated user")
}
