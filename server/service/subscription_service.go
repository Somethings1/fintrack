package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"fintrack/server/model"
	"fintrack/server/socket"
	"fintrack/server/util"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

func GetSubscriptionById(id string) (model.Subscription, error) {
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

func FetchSubscriptionsSince(ctx context.Context, username string, since time.Time) (*mongo.Cursor, error) {
	filter := bson.M{
		"last_update": bson.M{
			"$gt": since,
		},
		"creator": username,
	}

	opts := options.Find().SetSort(bson.D{
		{Key: "last_update", Value: -1},
	})

	return util.SubscriptionCollection.Find(ctx, filter, opts)
}

func AddSubscription(ctx context.Context, subscription model.Subscription) (interface{}, error) {
	subscription.LastUpdate = time.Now()

	res, err := util.SubscriptionCollection.InsertOne(ctx, subscription)
	if err != nil {
		return nil, err
	}

	socket.BroadcastFromContext(ctx, map[string]interface{}{
		"collection": "subscriptions",
		"action":     "create",
		"detail":     subscription,
	})

	return res.InsertedID, nil
}

func UpdateSubscription(ctx context.Context, id primitive.ObjectID, subscription model.Subscription) error {
	filter := bson.M{"_id": id}
	newSubscription := bson.M{"$set": subscription}
	subscription.LastUpdate = time.Now()

	_, err := util.SubscriptionCollection.UpdateOne(ctx, filter, newSubscription)
	if err != nil {
		return err
	}

	socket.BroadcastFromContext(ctx, map[string]interface{}{
		"collection": "subscriptions",
		"action":     "update",
		"detail":     subscription,
	})

	return nil
}

func OnNotificationCreated(ctx context.Context, id primitive.ObjectID) error {
	update := bson.M{
		"$set": bson.M{
			"notify_at": time.Time{},
		},
	}

	_, err := util.SubscriptionCollection.UpdateByID(ctx, id, update)
	if err != nil {
		return fmt.Errorf("failed to clear notify_at after notification: %w", err)
	}

	return nil
}

func OnTransactionCreated(ctx context.Context, id primitive.ObjectID) error {
	sub, err := GetSubscriptionById(id.Hex())
	if err != nil {
		return err
	}

	newInterval := sub.CurrentInterval + 1

	isActive := true
	if sub.MaxInterval > 0 && newInterval > sub.MaxInterval {
		isActive = false
	}

	var nextActive time.Time
	switch sub.Interval {
	case "test":
		nextActive = sub.StartDate.Add(time.Duration(newInterval) * time.Minute)
	case "week":
		nextActive = sub.StartDate.AddDate(0, 0, newInterval*7)
	case "month":
		nextActive = sub.StartDate.AddDate(0, newInterval, 0)
	case "year":
		nextActive = sub.StartDate.AddDate(newInterval, 0, 0)
	default:
		return fmt.Errorf("unknown interval type: %s", sub.Interval)
	}

	notifyAt := nextActive.AddDate(0, 0, -sub.RemindBefore)
	now := time.Now()

	update := bson.M{
		"$set": bson.M{
			"current_interval": newInterval,
			"next_active":      nextActive,
			"is_active":        isActive,
			"notify_at":        notifyAt,
			"last_update":      now,
		},
	}

	_, err = util.SubscriptionCollection.UpdateByID(ctx, id, update)
	if err != nil {
		return fmt.Errorf("failed to update subscription: %w", err)
	}

	socket.BroadcastFromContext(ctx, map[string]interface{}{
		"collection": "subscriptions",
		"action":     "renew",
		"detail":     "",
	})

	return nil
}

func DeleteSubscription(ctx context.Context, id primitive.ObjectID) error {
	subscriptionUpdate := bson.M{
		"$set": bson.M{
			"is_deleted":  true,
			"last_update": time.Now(),
		},
	}

	filter := bson.M{
		"_id": id,
	}

	_, err := util.SubscriptionCollection.UpdateOne(ctx, filter, subscriptionUpdate)
	if err != nil {
		return err
	}

	socket.BroadcastFromContext(ctx, map[string]interface{}{
		"collection": "subscriptions",
		"action":     "delete",
		"detail":     id,
	})

	return nil
}
