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

func getNotificationById (id string) (model.Notification, error) {
    ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

    objectID, err := primitive.ObjectIDFromHex(id)
    if err != nil {
        return model.Notification{}, err
    }

    var notification model.Notification

    err = util.NotificationCollection.FindOne(ctx, bson.M{"_id": objectID}).Decode(&notification)
    if err != nil {
        if err == mongo.ErrNoDocuments {
            return model.Notification{}, errors.New("transaction not found")
        }
        return model.Notification{}, err
    }

    return notification, nil
}
