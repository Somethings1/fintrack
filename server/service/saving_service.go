package service

import (
	"context"
	"errors"
	"time"

	"fintrack/server/model"
	"fintrack/server/money"
	"fintrack/server/socket"
	"fintrack/server/util"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

func GetSavingByID(parent context.Context, id string) (model.Saving, error) {
	ctx, cancel := context.WithTimeout(parent, 10*time.Second)
	defer cancel()

	objectID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return model.Saving{}, err
	}

	var saving model.Saving

	err = util.SavingCollection.FindOne(ctx, util.TenantFilter(ctx, "owner", objectID)).Decode(&saving)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return model.Saving{}, errors.New("saving not found")
		}
		return model.Saving{}, err
	}

	return saving, nil
}

func FetchSavingsSince(ctx context.Context, username string, since time.Time) (*mongo.Cursor, error) {
	filter := bson.M{
		"last_update": bson.M{
			"$gte": since,
		},
		"owner": username,
	}

	opts := options.Find().SetSort(bson.D{
		{Key: "last_update", Value: 1}, {Key: "_id", Value: 1},
	})

	return util.SavingCollection.Find(ctx, filter, opts)
}

func AddSaving(ctx context.Context, saving model.Saving) (interface{}, error) {
	saving.Owner, _ = ctx.Value(util.UserIdKey).(string)
	if saving.Owner == "" {
		return nil, errors.New("missing authenticated owner")
	}
	currency, err := money.Resolve(ctx, saving.Currency)
	if err != nil {
		return nil, err
	}
	saving.Currency = currency
	if err := money.Validate(saving.Balance, currency); err != nil {
		return nil, err
	}
	if err := money.Validate(saving.Goal, currency); err != nil {
		return nil, err
	}
	saving.OpeningBalance = saving.Balance

	saving.LastUpdate = time.Now()

	result, err := util.SavingCollection.InsertOne(ctx, saving)
	if err != nil {
		return nil, err
	}

	socket.BroadcastFromContext(ctx, map[string]interface{}{
		"collection": "savings",
		"action":     "create",
		"detail":     saving,
	})

	return result.InsertedID, nil
}

func UpdateSaving(ctx context.Context, id primitive.ObjectID, saving model.Saving) error {
	if _, err := money.Resolve(ctx, saving.Currency); err != nil {
		return err
	}
	if err := money.Validate(saving.Balance, money.Currency(ctx)); err != nil {
		return err
	}
	if err := money.Validate(saving.Goal, money.Currency(ctx)); err != nil {
		return err
	}

	saving.LastUpdate = time.Now()
	filter := util.TenantFilter(ctx, "owner", id)
	updateSaving := bson.M{"$set": bson.M{"name": saving.Name, "icon": saving.Icon, "goal": saving.Goal, "goal_date": saving.GoalDate, "last_update": saving.LastUpdate}}

	_, err := util.SavingCollection.UpdateOne(ctx, filter, updateSaving)
	if err != nil {
		return err
	}

	socket.BroadcastFromContext(ctx, map[string]interface{}{
		"collection": "savings",
		"action":     "update",
		"detail":     saving,
	})

	return nil
}

func DeleteSaving(ctx context.Context, id primitive.ObjectID) error {
	return archiveUnreferenced(ctx, util.SavingCollection, "savings", id)
}
