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

func GetAccountByID(parent context.Context, id string) (model.Account, error) {
	ctx, cancel := context.WithTimeout(parent, 10*time.Second)
	defer cancel()

	objectID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return model.Account{}, err
	}

	var account model.Account

	err = util.AccountCollection.FindOne(ctx, util.TenantFilter(ctx, "owner", objectID)).Decode(&account)
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
			"$gte": since,
		},
		"owner": username,
	}

	opts := options.Find().SetSort(bson.D{
		{Key: "last_update", Value: 1}, {Key: "_id", Value: 1},
	})

	return util.AccountCollection.Find(ctx, filter, opts)
}

func AddAccount(ctx context.Context, account model.Account) (interface{}, error) {
	account.Owner, _ = ctx.Value(util.UserIdKey).(string)
	if account.Owner == "" {
		return nil, errors.New("missing authenticated owner")
	}
	currency, err := money.Resolve(ctx, account.Currency)
	if err != nil {
		return nil, err
	}
	account.Currency = currency
	if err := money.Validate(account.Balance, currency); err != nil {
		return nil, err
	}
	account.OpeningBalance = account.Balance

	account.LastUpdate = time.Now()
	result, err := util.AccountCollection.InsertOne(ctx, account)

	if err != nil {
		return nil, err
	}

	socket.BroadcastFromContext(ctx, map[string]interface{}{
		"collection": "accounts",
		"action":     "create",
		"detail":     account,
	})

	return result.InsertedID, nil
}

func UpdateAccount(ctx context.Context, id primitive.ObjectID, account model.Account) error {
	if _, err := money.Resolve(ctx, account.Currency); err != nil {
		return err
	}
	if err := money.Validate(account.Balance, money.Currency(ctx)); err != nil {
		return err
	}

	filter := util.TenantFilter(ctx, "owner", id)
	account.LastUpdate = time.Now()
	updateAccount := bson.M{"$set": bson.M{"name": account.Name, "icon": account.Icon, "last_update": account.LastUpdate}}

	_, err := util.AccountCollection.UpdateOne(ctx, filter, updateAccount)
	if err != nil {
		return err
	}

	socket.BroadcastFromContext(ctx, map[string]interface{}{
		"collection": "accounts",
		"action":     "update",
		"detail":     account,
	})

	return nil
}

func DeleteAccount(ctx context.Context, id primitive.ObjectID) error {
	return archiveUnreferenced(ctx, util.AccountCollection, "accounts", id)
}
