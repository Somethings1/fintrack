package service

import (
    "time"
    "errors"
    "context"

    "fintrack/server/model"
    "fintrack/server/util"

    "go.mongodb.org/mongo-driver/bson"
    "go.mongodb.org/mongo-driver/bson/primitive"
    "go.mongodb.org/mongo-driver/mongo"
)

func GetTransactionByID (id string) (model.Transaction, error) {
    ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

    objectID, err := primitive.ObjectIDFromHex(id)
    if err != nil {
        return model.Transaction{}, err
    }

    var transaction model.Transaction

    err = util.TransactionCollection.FindOne(ctx, bson.M{"_id": objectID}).Decode(&transaction)
    if err != nil {
        if err == mongo.ErrNoDocuments {
            return model.Transaction{}, errors.New("transaction not found")
        }
        return model.Transaction{}, err
    }

    return transaction, nil
}
