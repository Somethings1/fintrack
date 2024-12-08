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

func InitDB() {
	clientOptions := options.Client().ApplyURI("mongodb://localhost:27017")
	client, err := mongo.Connect(context.Background(), clientOptions)
	if err != nil {
		log.Fatal(err)
	}

	UserCollection = client.Database("finance_db").Collection("users")
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
