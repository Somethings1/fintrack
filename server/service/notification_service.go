package service

import (
    "time"
    "context"

    "fintrack/server/model"
    "fintrack/server/util"

    "go.mongodb.org/mongo-driver/bson"
    "go.mongodb.org/mongo-driver/bson/primitive"
)

func AddNotification(ctx context.Context, notif model.Notification) (interface{}, error) {
    notif.LastUpdate = time.Now()
    notif.Delivered = false
    result, err := util.NotificationCollection.InsertOne(ctx, notif)

    if err != nil {
        return nil, err
    }

    return result.InsertedID, nil
}

func MarkAsRead(ctx context.Context, notifID primitive.ObjectID) error {
    update := bson.M{
        "$set": bson.M{
            "read": true,
            "last_update": time.Now(),
        },
    }

    _, err := util.NotificationCollection.UpdateByID(ctx, notifID, update)

    return err
}
