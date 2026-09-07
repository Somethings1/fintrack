package service

import (
	"context"
	"errors"
	"fintrack/server/money"
	"time"

	"fintrack/server/model"
	"fintrack/server/socket"
	"fintrack/server/util"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

func GetSubscriptionById(parent context.Context, id string) (model.Subscription, error) {
	ctx, cancel := context.WithTimeout(parent, 10*time.Second)
	defer cancel()

	objectID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return model.Subscription{}, err
	}

	var subscription model.Subscription

	err = util.SubscriptionCollection.FindOne(ctx, util.TenantFilter(ctx, "creator", objectID)).Decode(&subscription)
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
			"$gte": since,
		},
		"creator": username,
	}

	opts := options.Find().SetSort(bson.D{
		{Key: "last_update", Value: 1}, {Key: "_id", Value: 1},
	})

	return util.SubscriptionCollection.Find(ctx, filter, opts)
}

func AddSubscription(ctx context.Context, sub model.Subscription) (interface{}, error) {
	sub.Creator, _ = ctx.Value(util.UserIdKey).(string)
	var err error
	sub.Currency, err = money.Resolve(ctx, sub.Currency)
	if err != nil {
		return nil, err
	}
	if err := validateSubscription(sub); err != nil {
		return nil, err
	}
	sub.ID = primitive.NewObjectID()
	sub.CurrentInterval = 0
	sub.ScheduleVersion = 2
	sub.StartDate = sub.StartDate.UTC().Truncate(time.Millisecond)
	sub.NextActive = sub.StartDate
	sub.NotifyAt = sub.StartDate.AddDate(0, 0, -sub.RemindBefore)
	sub.LastUpdate = time.Now().UTC()
	sub.IsDeleted = false
	sub.IsActive = true
	session, err := util.MongoClient.StartSession()
	if err != nil {
		return nil, err
	}
	defer session.EndSession(ctx)
	_, err = session.WithTransaction(ctx, func(sc mongo.SessionContext) (interface{}, error) {
		if err := touchSubscriptionReferences(sc, sub); err != nil {
			return nil, err
		}
		return util.SubscriptionCollection.InsertOne(sc, sub)
	})
	if err != nil {
		return nil, err
	}
	socket.BroadcastFromContext(ctx, map[string]interface{}{"collection": "subscriptions", "action": "create"})
	return sub.ID, nil
}

func UpdateSubscription(ctx context.Context, id primitive.ObjectID, sub model.Subscription) error {
	sub.Creator, _ = ctx.Value(util.UserIdKey).(string)
	var err error
	sub.Currency, err = money.Resolve(ctx, sub.Currency)
	if err != nil {
		return err
	}
	if err := validateSubscription(sub); err != nil {
		return err
	}
	session, err := util.MongoClient.StartSession()
	if err != nil {
		return err
	}
	defer session.EndSession(ctx)
	_, err = session.WithTransaction(ctx, func(sc mongo.SessionContext) (interface{}, error) {
		filter := util.TenantFilter(sc, "creator", id)
		var old model.Subscription
		if err := util.SubscriptionCollection.FindOne(sc, filter).Decode(&old); err != nil {
			return nil, err
		}
		if old.ScheduleVersion != 2 || (old.CurrentInterval > 0 && (!old.StartDate.Equal(sub.StartDate) || old.Interval != sub.Interval)) {
			return nil, ErrScheduleImmutable
		}
		if sub.MaxInterval > 0 && sub.MaxInterval < old.CurrentInterval {
			return nil, ErrScheduleImmutable
		}
		if err := touchSubscriptionReferences(sc, sub); err != nil {
			return nil, err
		}
		next, err := OccurrenceAt(sub.StartDate, sub.Interval, old.CurrentInterval)
		if err != nil {
			return nil, err
		}
		active := sub.MaxInterval == 0 || old.CurrentInterval < sub.MaxInterval
		// Never reset the processed count or mutate previously posted occurrences.
		set := bson.M{"name": sub.Name, "icon": sub.Icon, "amount": sub.Amount, "source_account": sub.SourceAccount, "category": sub.Category, "start_date": sub.StartDate.UTC(), "interval": sub.Interval, "max_interval": sub.MaxInterval, "remind_before": sub.RemindBefore, "next_active": next, "notify_at": next.AddDate(0, 0, -sub.RemindBefore), "is_active": active, "last_update": time.Now().UTC()}
		return util.SubscriptionCollection.UpdateOne(sc, filter, bson.M{"$set": set})
	})
	if err == nil {
		socket.BroadcastFromContext(ctx, map[string]interface{}{"collection": "subscriptions", "action": "update"})
	}
	return err
}

func DeleteSubscription(ctx context.Context, id primitive.ObjectID) error {
	subscriptionUpdate := bson.M{
		"$set": bson.M{
			"is_deleted":  true,
			"last_update": time.Now(),
		},
	}

	filter := util.TenantFilter(ctx, "creator", id)

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
