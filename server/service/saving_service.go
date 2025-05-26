package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"fintrack/server/model"
	"fintrack/server/util"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

func GetSavingByID(id string) (model.Saving, error) {
    ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
    defer cancel()

    objectID, err := primitive.ObjectIDFromHex(id)
    if err != nil {
        return model.Saving{}, err
    }

    var saving model.Saving

    err = util.SavingCollection.FindOne(ctx, bson.M{"_id": objectID}).Decode(&saving)
    if err != nil {
        if err == mongo.ErrNoDocuments {
            return model.Saving{}, errors.New("saving not found")
        }
        return model.Saving{}, err
    }

    return saving, nil
}

func FetchSavingsSince (ctx context.Context, username string, since time.Time) (*mongo.Cursor, error) {
    filter := bson.M{
        "last_update": bson.M{
            "$gt": since,
        },
        "owner": username,
    }

    opts := options.Find().SetSort(bson.D{
        {Key: "last_update", Value: -1},
    })

    return util.SavingCollection.Find(ctx, filter, opts)
}

func AddSaving(ctx context.Context, saving model.Saving) (interface{}, error) {
    saving.LastUpdate = time.Now()

    result, err := util.SavingCollection.InsertOne(ctx, saving)
    if err != nil {
        return nil, err
    }

    return result.InsertedID, nil
}

func UpdateSaving (ctx context.Context, id primitive.ObjectID, saving model.Saving) error {
    saving.LastUpdate = time.Now()
    filter := bson.M{"_id": id}
    updateSaving := bson.M{"$set": saving}

    _, err := util.SavingCollection.UpdateOne(ctx, filter, updateSaving)
    return err
}

func DeleteSaving (ctx context.Context, id primitive.ObjectID) error {
	savingUpdate := bson.M{
		"$set": bson.M{
			"is_deleted":  true,
			"last_update": time.Now(),
		},
	}
    _, err := util.SavingCollection.UpdateOne(ctx, bson.M{"_id": id}, savingUpdate)
	if err != nil {
        return fmt.Errorf("Error deleting saving: %w", err)
	}

	transactionUpdate := bson.M{
		"$set": bson.M{
			"is_deleted":  true,
			"last_update": time.Now(),
		},
	}
	filter := bson.M{
		"$or": []bson.M{
			{"source_account": id},
            {"destination_account": id},
		},
	}
	_, err = util.TransactionCollection.UpdateMany(ctx, filter, transactionUpdate)
	if err != nil {
        return fmt.Errorf("Error deleting related transactions: %w", err)
	}

    return nil
}
