package util

import (
	"context"
	"go.mongodb.org/mongo-driver/mongo"
)

// Define a general interface for the MongoDB collection
type DBCollection interface {
	InsertOne(ctx context.Context, document interface{}) (*mongo.InsertOneResult, error)
	FindOne(ctx context.Context, filter interface{}) *mongo.SingleResult
    Indexes() mongo.IndexView
}

