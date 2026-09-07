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

func GetCategoryByID(parent context.Context, id string) (model.Category, error) {
	ctx, cancel := context.WithTimeout(parent, 10*time.Second)
	defer cancel()

	objectID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return model.Category{}, err
	}

	var category model.Category

	err = util.CategoryCollection.FindOne(ctx, util.TenantFilter(ctx, "owner", objectID)).Decode(&category)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return model.Category{}, errors.New("transaction not found")
		}
		return model.Category{}, err
	}

	return category, nil
}

func FetchCategoriesSince(ctx context.Context, username string, since time.Time) (*mongo.Cursor, error) {
	filter := bson.M{
		"last_update": bson.M{
			"$gte": since,
		},
		"owner": username,
	}

	opts := options.Find().SetSort(bson.D{
		{Key: "last_update", Value: 1}, {Key: "_id", Value: 1},
	})
	return util.CategoryCollection.Find(ctx, filter, opts)
}

func AddCategory(ctx context.Context, category model.Category) (interface{}, error) {
	category.Owner, _ = ctx.Value(util.UserIdKey).(string)
	if category.Owner == "" {
		return nil, errors.New("missing authenticated owner")
	}
	currency, err := money.Resolve(ctx, category.Currency)
	if err != nil {
		return nil, err
	}
	category.Currency = currency
	if err := money.Validate(category.Budget, currency); err != nil {
		return nil, err
	}

	category.LastUpdate = time.Now()

	result, err := util.CategoryCollection.InsertOne(ctx, category)
	if err != nil {
		return nil, err
	}

	socket.BroadcastFromContext(ctx, map[string]interface{}{
		"collection": "categories",
		"action":     "create",
		"detail":     category,
	})

	return result.InsertedID, nil
}

func UpdateCategory(ctx context.Context, id primitive.ObjectID, category model.Category) error {
	if _, err := money.Resolve(ctx, category.Currency); err != nil {
		return err
	}
	if err := money.Validate(category.Budget, money.Currency(ctx)); err != nil {
		return err
	}

	category.LastUpdate = time.Now()

	filter := util.TenantFilter(ctx, "owner", id)
	_, err := util.CategoryCollection.UpdateOne(ctx, filter, bson.M{"$set": bson.M{"name": category.Name, "icon": category.Icon, "budget": category.Budget, "last_update": category.LastUpdate}})

	if err != nil {
		return err
	}

	socket.BroadcastFromContext(ctx, map[string]interface{}{
		"collection": "categories",
		"action":     "update",
		"detail":     category,
	})

	return nil
}

func DeleteCategory(ctx context.Context, id primitive.ObjectID) error {
	return archiveUnreferenced(ctx, util.CategoryCollection, "categories", id)
}
