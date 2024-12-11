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

func GetAccountByID (id string) (model.Account, error) {
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
