package service

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fintrack/server/model"
	"fintrack/server/util"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"math"
	"time"
)

func validateTransaction(tx model.Transaction) error {
	if tx.Creator == "" || tx.DateTime.IsZero() || tx.Amount <= 0 || tx.Amount > 1e12 || math.IsNaN(tx.Amount) || math.IsInf(tx.Amount, 0) || len(tx.Note) > 500 {
		return errors.New("invalid transaction")
	}
	switch tx.Type {
	case "income":
		if !tx.SourceAccount.IsZero() || tx.DestinationAccount.IsZero() || tx.Category.IsZero() {
			return errors.New("invalid income references")
		}
	case "expense":
		if tx.SourceAccount.IsZero() || !tx.DestinationAccount.IsZero() || tx.Category.IsZero() {
			return errors.New("invalid expense references")
		}
	case "transfer":
		if tx.SourceAccount.IsZero() || tx.DestinationAccount.IsZero() || tx.SourceAccount == tx.DestinationAccount || !tx.Category.IsZero() {
			return errors.New("invalid transfer references")
		}
	default:
		return errors.New("invalid transaction type")
	}
	return nil
}
func transactionDigest(tx model.Transaction) string {
	tx.ID = primitive.NilObjectID
	tx.LastUpdate = time.Time{}
	tx.RequestKey = ""
	tx.RequestHash = ""
	tx.IsDeleted = false
	raw, _ := json.Marshal(tx)
	hash := sha256.Sum256(raw)
	return hex.EncodeToString(hash[:])
}
func validateCategory(sc mongo.SessionContext, tx model.Transaction) error {
	if tx.Type == "transfer" {
		return nil
	}
	filter := util.TenantFilter(sc, "owner", tx.Category)
	filter["type"] = tx.Type
	result, err := util.CategoryCollection.UpdateOne(sc, filter, bson.M{"$inc": bson.M{"reference_version": 1}})
	if err != nil {
		return err
	}
	if result.MatchedCount != 1 {
		return errors.New("category is missing, deleted or not owned")
	}
	return nil
}
func replayTransaction(ctx context.Context, key, hash string) (primitive.ObjectID, error) {
	var previous model.Transaction
	user, _ := ctx.Value(util.UserIdKey).(string)
	if user == "" {
		return primitive.NilObjectID, errors.New("missing authenticated user")
	}
	err := util.TransactionCollection.FindOne(ctx, bson.M{"creator": user, "request_key": key}).Decode(&previous)
	if err != nil {
		return primitive.NilObjectID, err
	}
	if previous.RequestHash != hash {
		return primitive.NilObjectID, ErrIdempotencyConflict
	}
	return previous.ID, nil
}
