package service

import (
	"context"
	"errors"
	"time"
    "fmt"

	"fintrack/server/model"
	"fintrack/server/util"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

func GetAccountByID(id string) (model.Account, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	objectID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return model.Account{}, err
	}

	var account model.Account

	err = util.AccountCollection.FindOne(ctx, bson.M{"_id": objectID}).Decode(&account)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return model.Account{}, errors.New("transaction not found")
		}
		return model.Account{}, err
	}

	return account, nil
}

func FetchAccountsSince(ctx context.Context, username string, since time.Time) (*mongo.Cursor, error) {
	filter := bson.M{
		"last_update": bson.M{
			"$gt": since,
		},
		"owner": username,
	}

	opts := options.Find().SetSort(bson.D{
		{Key: "last_update", Value: -1},
	})

    return util.AccountCollection.Find(ctx, filter, opts)
}

func UpdateAccount(ctx context.Context, id primitive.ObjectID, account model.Account) error {
    filter := bson.M{"_id": id}
    account.LastUpdate = time.Now()
    updateAccount := bson.M{"$set": account}

    _, err := util.AccountCollection.UpdateOne(ctx, filter, updateAccount)
    return err
}

func DeleteAccount(ctx context.Context, id primitive.ObjectID) error {
	accountUpdate := bson.M{
		"$set": bson.M{
			"is_deleted":  true,
			"last_update": time.Now(),
		},
	}
    _, err := util.AccountCollection.UpdateOne(ctx, bson.M{"_id": id}, accountUpdate)
	if err != nil {
        return fmt.Errorf("Error deleting account: %w", err)
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
