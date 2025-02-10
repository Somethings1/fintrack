package util

import (
	"context"
    "time"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo/options"
	"log"
)

var UserCollection *mongo.Collection
var AccountCollection *mongo.Collection
var TransactionCollection *mongo.Collection
var CategoryCollection *mongo.Collection
var SavingCollection *mongo.Collection

func InitDB() {
	clientOptions := options.Client().ApplyURI("mongodb://localhost:27017")
	client, err := mongo.Connect(context.Background(), clientOptions)
	if err != nil {
		log.Fatal(err)
	}

	UserCollection = client.Database("finance_db").Collection("users")
    AccountCollection = client.Database("finance_db").Collection("accounts")
    TransactionCollection = client.Database("finance_db").Collection("transactions")
	CategoryCollection = client.Database("finance_db").Collection("categories")
    SavingCollection = client.Database("finance_db").Collection("savings")

    createUserIndex()
}

func createUserIndex() error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	indexModel := mongo.IndexModel{
		Keys:    bson.M{"username": 1}, // Ascending index on "username"
		Options: options.Index().SetUnique(true),
	}

	_, err := UserCollection.Indexes().CreateOne(ctx, indexModel)
	return err
}
