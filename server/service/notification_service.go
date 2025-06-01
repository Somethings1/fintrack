package service

import (
	"context"
	"errors"
	"time"

	"fintrack/server/model"
	"fintrack/server/socket"
	"fintrack/server/util"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

func GetNotificationById(id string) (model.Notification, error) {
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

func FetchNotificationSince(ctx context.Context, username string, since time.Time) (*mongo.Cursor, error) {
	filter := bson.M{
		"last_update": bson.M{
			"$gt": since,
		},
		"owner": username,
	}

	opts := options.Find().SetSort(bson.D{
		{Key: "last_update", Value: -1},
	})

	return util.NotificationCollection.Find(ctx, filter, opts)
}

func AddNotification(ctx context.Context, notif model.Notification) (interface{}, error) {
	notif.LastUpdate = time.Now()
	result, err := util.NotificationCollection.InsertOne(ctx, notif)

	if err != nil {
		return nil, err
	}

	socket.BroadcastFromContext(ctx, map[string]interface{}{
		"collection": "notifications",
		"action":     "create",
		"detail":     notif,
	})

	return result.InsertedID, nil
}

func MarkAsRead(ctx context.Context, notifIDs []primitive.ObjectID) error {
    filter := bson.M{
        "_id": bson.M{
            "$in": notifIDs,
        },
    }
	update := bson.M{
		"$set": bson.M{
			"read":        true,
			"last_update": time.Now(),
		},
	}

	_, err := util.NotificationCollection.UpdateMany(ctx, filter, update)

	if err != nil {
		return err
	}

	socket.BroadcastFromContext(ctx, map[string]interface{}{
		"collection": "notifications",
		"action":     "mark",
		"detail":     notifIDs,
	})

	return nil
}

func UpdateNotification(ctx context.Context, id primitive.ObjectID, notif model.Notification) error {
	filter := bson.M{"_id": id}
	notif.LastUpdate = time.Now()
	update := bson.M{"$set": notif}

	_, err := util.NotificationCollection.UpdateOne(ctx, filter, update)
	if err != nil {
		return err
	}

	socket.BroadcastFromContext(ctx, map[string]interface{}{
		"collection": "notifications",
		"action":     "update",
		"detail":     "",
	})

	return nil
}

func DeleteNotification(ctx context.Context, id primitive.ObjectID) error {
	filter := bson.M{"_id": id}
	update := bson.M{
		"$set": bson.M{
			"is_deleted":  true,
			"last_update": time.Now(),
		},
	}

	_, err := util.NotificationCollection.UpdateOne(ctx, filter, update)
	if err != nil {
		return err
	}

	socket.BroadcastFromContext(ctx, map[string]interface{}{
		"collection": "notifications",
		"action":     "delete",
		"detail":     id,
	})

	return nil
}
