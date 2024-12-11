package service

import (
    "time"
    "errors"
    "context"

    "fintrack/server/model"
    "fintrack/server/util"

    "go.mongodb.org/mongo-driver/bson"
    "go.mongodb.org/mongo-driver/bson/primitive"
    "go.mongodb.org/mongo-driver/mongo"
)

func GetCategoryByID (id string) (model.Category, error) {
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
