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
	saving.LastUpdate = time.Now()
	filter := util.TenantFilter(ctx, "owner", id)
	updateSaving := bson.M{"$set": saving}

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
