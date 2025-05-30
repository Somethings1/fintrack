package service

import (
    "time"
    "context"
    "errors"

    "fintrack/server/model"
    "fintrack/server/util"

    "go.mongodb.org/mongo-driver/bson"
    "go.mongodb.org/mongo-driver/bson/primitive"
    "go.mongodb.org/mongo-driver/mongo"
)


func GetNotificationById (id string) (model.Notification, error) {
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
