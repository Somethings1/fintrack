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
