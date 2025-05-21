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

func GetSubscriptionById (id string) (model.Subscription, error) {
    ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

    objectID, err := primitive.ObjectIDFromHex(id)
    if err != nil {
        return model.Subscription{}, err
    }

    var subscription model.Subscription

    err = util.SubscriptionCollection.FindOne(ctx, bson.M{"_id": objectID}).Decode(&subscription)
    if err != nil {
        if err == mongo.ErrNoDocuments {
            return model.Subscription{}, errors.New("Subscription not found")
        }
        return model.Subscription{}, err
    }

    return subscription, nil
}
