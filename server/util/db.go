package util

import (
	"context"
    "time"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo/options"
	"log"
)
type RealMongoCollection struct {
	collection *mongo.Collection
}

func (r *RealMongoCollection) InsertOne(ctx context.Context, document interface{}) (*mongo.InsertOneResult, error) {
	return r.collection.InsertOne(ctx, document)
}

func (r *RealMongoCollection) FindOne(ctx context.Context, filter interface{}) *mongo.SingleResult {
	return r.collection.FindOne(ctx, filter)
}

func (r *RealMongoCollection) Indexes() mongo.IndexView {
	return r.collection.Indexes()
}

// Global variable to hold the actual MongoDB collection
var UserCollection DBCollection

// InitDB initializes the actual MongoDB connection (production)
func InitDB() {
	// Replace this with your actual database URI and other connection logic
	clientOptions := options.Client().ApplyURI("mongodb://localhost:27017")
	client, err := mongo.Connect(context.Background(), clientOptions)
	if err != nil {
		log.Fatal(err)
	}

	// Initialize the real MongoDB collection
	collection := client.Database("finance_db").Collection("users")
	UserCollection = &RealMongoCollection{collection}
    CreateUserIndex()
}

func CreateUserIndex() error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Define the unique index on the username field
	indexModel := mongo.IndexModel{
		Keys:    bson.M{"username": 1}, // Ascending index on "username"
		Options: options.Index().SetUnique(true),
	}

	// Create the index
	_, err := UserCollection.Indexes().CreateOne(ctx, indexModel)
	return err
}
