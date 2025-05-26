package service

import (
	"context"
	"errors"
	"time"

	"fintrack/server/model"
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

	return res.InsertedID, nil
}

func UpdateSubscription(ctx context.Context, id primitive.ObjectID, subscription model.Subscription) error {
	filter := bson.M{"_id": id}
	newSubscription := bson.M{"$set": subscription}
	subscription.LastUpdate = time.Now()

	_, err := util.SubscriptionCollection.UpdateOne(ctx, filter, newSubscription)
	return err
}

func DeleteSubscription(ctx context.Context, id primitive.ObjectID) error {
    subscriptionUpdate := bson.M{
        "$set": bson.M{
            "is_deleted": true,
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

    return nil
}
