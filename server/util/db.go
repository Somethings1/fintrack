package util

import (
	"context"
	"log"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

var (
	MongoClient            *mongo.Client
	AccountCollection      *mongo.Collection
	TransactionCollection  *mongo.Collection
	CategoryCollection     *mongo.Collection
	SavingCollection       *mongo.Collection
	SubscriptionCollection *mongo.Collection
	NotificationCollection *mongo.Collection
)

func InitDB() {
	clientOptions := options.Client().ApplyURI("mongodb://localhost:27017")
	client, err := mongo.Connect(context.Background(), clientOptions)
	if err != nil {
		log.Fatal(err)
	}
	MongoClient = client

	db := client.Database("finance_db")

	AccountCollection = db.Collection("accounts")
	TransactionCollection = db.Collection("transactions")
	CategoryCollection = db.Collection("categories")
	SavingCollection = db.Collection("savings")
	SubscriptionCollection = db.Collection("subscriptions")
	NotificationCollection = db.Collection("notifications")

	if err := createTransactionIndex(); err != nil {
		log.Fatal("Failed to create transaction index:", err)
	}
	if err := createAccountIndex(); err != nil {
		log.Fatal("Failed to create account index:", err)
	}
	if err := createSavingIndex(); err != nil {
		log.Fatal("Failed to create saving index:", err)
	}
	if err := createCategoryIndex(); err != nil {
		log.Fatal("Failed to create category index:", err)
	}
	if err := createSubscriptionIndex(); err != nil {
		log.Fatal("Failed to create subscription index:", err)
	}
	if err := createNotificationIndex(); err != nil {
		log.Fatal("Failed to create notification index:", err)
	}
}

func createTransactionIndex() error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	indexModel := []mongo.IndexModel{
		{Keys: bson.M{"creator": 1}},
		{Keys: bson.M{"last_update": 1}},
	}

	_, err := TransactionCollection.Indexes().CreateMany(ctx, indexModel)
	return err
}

func createAccountIndex() error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	indexModel := []mongo.IndexModel{
		{Keys: bson.M{"owner": 1}},
		{Keys: bson.M{"last_update": 1}},
	}

	_, err := AccountCollection.Indexes().CreateMany(ctx, indexModel)
	return err
}

func createSavingIndex() error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	indexModel := []mongo.IndexModel{
		{Keys: bson.M{"owner": 1}},
		{Keys: bson.M{"last_update": 1}},
	}

	_, err := SavingCollection.Indexes().CreateMany(ctx, indexModel)
	return err
}

func createCategoryIndex() error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	indexModel := []mongo.IndexModel{
		{Keys: bson.M{"owner": 1}},
		{Keys: bson.M{"last_update": 1}},
	}

	_, err := CategoryCollection.Indexes().CreateMany(ctx, indexModel)
	return err
}

func createSubscriptionIndex() error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	indexModel := []mongo.IndexModel{
		{Keys: bson.M{"last_update": 1}},
		{Keys: bson.M{"creator": 1}},
		{Keys: bson.M{"notify_at": 1}},
	}

	_, err := SubscriptionCollection.Indexes().CreateMany(ctx, indexModel)
	return err
}

func createNotificationIndex() error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	indexModel := []mongo.IndexModel{
		{Keys: bson.M{"owner": 1}},
		{Keys: bson.M{"scheduled_at": 1}},
		{Keys: bson.M{"last_update": 1}},
	}

	_, err := NotificationCollection.Indexes().CreateMany(ctx, indexModel)
	return err
}

func AdjustBalance(sc mongo.SessionContext, id primitive.ObjectID, amount float64) (int64, error) {
	now := time.Now()

	// Try to update in account collection
	res, err := AccountCollection.UpdateOne(
		sc,
		bson.M{"_id": id},
		bson.M{
			"$inc": bson.M{"balance": amount},
			"$set": bson.M{"last_update": now},
		},
	)
	if err != nil {
		return 0, err
	}

	if res.MatchedCount == 0 {
		// If not an account, try saving
		res, err = SavingCollection.UpdateOne(
			sc,
			bson.M{"_id": id},
			bson.M{
				"$inc": bson.M{"balance": amount},
				"$set": bson.M{"last_update": now},
			},
		)
		if err != nil {
			return 0, err
		}
	}

	return res.ModifiedCount, nil
}
