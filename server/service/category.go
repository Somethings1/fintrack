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

func GetCategoryByID(id string) (model.Category, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	objectID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return model.Category{}, err
	}

	var category model.Category

	err = util.CategoryCollection.FindOne(ctx, bson.M{"_id": objectID}).Decode(&category)
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
			"$gt": since,
		},
		"owner": username,
	}

	opts := options.Find().SetSort(bson.D{
		{Key: "last_update", Value: -1},
	})
	return util.CategoryCollection.Find(ctx, filter, opts)
}

func AddCategory(ctx context.Context, category model.Category) (interface{}, error) {
	category.LastUpdate = time.Now()
	return util.CategoryCollection.InsertOne(ctx, category)
}

func UpdateCategory(ctx context.Context, id primitive.ObjectID, category model.Category) error {
    category.LastUpdate = time.Now()

    filter := bson.M{"_id": id}
    _, err := util.CategoryCollection.UpdateOne(ctx, filter, bson.M{"$set": category})

    return err
}

func DeleteCategory(ctx context.Context, id primitive.ObjectID) error {
	categoryUpdate := bson.M{
		"$set": bson.M{
			"is_deleted":  true,
			"last_update": time.Now(),
		},
	}
    _, err := util.CategoryCollection.UpdateOne(ctx, bson.M{"_id": id}, categoryUpdate)
	if err != nil {
        return fmt.Errorf("Error deleting category: %w", err)
	}

	transactionUpdate := bson.M{
		"$set": bson.M{
			"is_deleted":  true,
			"last_update": time.Now(),
		},
	}
	_, err = util.TransactionCollection.UpdateMany(ctx, bson.M{"category": id}, transactionUpdate)
    if err != nil {
        return fmt.Errorf("Error deleting related transactions: %w", err)
    }

    return err
}
