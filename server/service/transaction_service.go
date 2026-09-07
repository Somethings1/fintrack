package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"fintrack/server/model"
	"fintrack/server/socket"
	"fintrack/server/util"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

func GetTransactionByID(parent context.Context, id string) (model.Transaction, error) {
	ctx, cancel := context.WithTimeout(parent, 10*time.Second)
	defer cancel()

	objectID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return model.Transaction{}, err
	}

	var transaction model.Transaction

	err = util.TransactionCollection.FindOne(ctx, util.TenantFilter(ctx, "creator", objectID)).Decode(&transaction)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return model.Transaction{}, errors.New("transaction not found")
		}
		return model.Transaction{}, err
	}

	return transaction, nil
}

func FetchTransactionsSince(ctx context.Context, username string, since time.Time) (*mongo.Cursor, error) {
	filter := bson.M{
		"last_update": bson.M{
			"$gte": since,
		},
		"creator": username,
	}

	opts := options.Find().SetSort(bson.D{
		{Key: "last_update", Value: 1}, {Key: "_id", Value: 1},
	})

	return util.TransactionCollection.Find(ctx, filter, opts)
}

func addTransactionInternal(ctx context.Context, transaction model.Transaction) (interface{}, error) {
	transaction.Creator, _ = ctx.Value(util.UserIdKey).(string)
	transaction.IsDeleted = false
	if err := validateTransaction(transaction); err != nil {
		return nil, err
	}
	transaction.ID = primitive.NewObjectID()
	transaction.RequestKey, _ = ctx.Value(util.RequestKey).(string)
	transaction.RequestHash = transactionDigest(transaction)
	if transaction.RequestKey != "" {
		id, err := replayTransaction(ctx, transaction.RequestKey, transaction.RequestHash)
		if err == nil {
			return id, nil
		}
		if !errors.Is(err, mongo.ErrNoDocuments) {
			return nil, err
		}
	}
	session, err := util.MongoClient.StartSession()
	if err != nil {
		return nil, fmt.Errorf("Failed to start session: %w", err)
	}
	defer session.EndSession(ctx)

	transaction.LastUpdate = time.Now()

	result, err := session.WithTransaction(ctx, func(sc mongo.SessionContext) (interface{}, error) {
		if err := validateCategory(sc, transaction); err != nil {
			return nil, err
		}
		res, err := util.TransactionCollection.InsertOne(sc, transaction)
		if err != nil {
			return nil, fmt.Errorf("Failed to insert transaction: %w", err)
		}

		if transaction.SourceAccount != primitive.NilObjectID {
			if _, err := util.AdjustBalance(sc, transaction.SourceAccount, -transaction.Amount); err != nil {
				return nil, fmt.Errorf("Failed to adjust source account balance: %w", err)
			}
		}

		if transaction.DestinationAccount != primitive.NilObjectID {
			if _, err := util.AdjustBalance(sc, transaction.DestinationAccount, transaction.Amount); err != nil {
				return nil, fmt.Errorf("Failed to adjust destination account balance: %w", err)
			}
		}

		return res.InsertedID, nil
	})

	if err != nil && transaction.RequestKey != "" && mongo.IsDuplicateKeyError(err) {
		return replayTransaction(ctx, transaction.RequestKey, transaction.RequestHash)
	}
	return result, err
}

func AddTransactionSilent(ctx context.Context, transaction model.Transaction) (interface{}, error) {
	return addTransactionInternal(ctx, transaction)
}

func AddTransaction(ctx context.Context, transaction model.Transaction) (interface{}, error) {
	result, err := addTransactionInternal(ctx, transaction)
	if err != nil {
		return nil, err
	}

	socket.BroadcastFromContext(ctx, map[string]interface{}{
		"collection": "transactions",
		"action":     "create",
		"detail":     transaction,
	})

	return result, nil
}

func UpdateTransaction(ctx context.Context, id primitive.ObjectID, newTx model.Transaction) error {
	newTx.Creator, _ = ctx.Value(util.UserIdKey).(string)
	newTx.ID = id
	newTx.IsDeleted = false
	if err := validateTransaction(newTx); err != nil {
		return err
	}
	session, err := util.MongoClient.StartSession()
	if err != nil {
		return err
	}
	defer session.EndSession(ctx)
	_, err = session.WithTransaction(ctx, func(sc mongo.SessionContext) (interface{}, error) {
		var old model.Transaction
		if err := util.TransactionCollection.FindOne(sc, util.TenantFilter(sc, "creator", id)).Decode(&old); err != nil {
			return nil, err
		}
		if err := validateCategory(sc, newTx); err != nil {
			return nil, err
		}
		for _, change := range []struct {
			id     primitive.ObjectID
			amount float64
		}{{old.SourceAccount, old.Amount}, {old.DestinationAccount, -old.Amount}, {newTx.SourceAccount, -newTx.Amount}, {newTx.DestinationAccount, newTx.Amount}} {
			if _, err := util.AdjustBalance(sc, change.id, change.amount); err != nil {
				return nil, err
			}
		}
		newTx.LastUpdate = time.Now().UTC()
		// BSON omitempty excludes inapplicable references from $set. Explicitly
		// clear the old side when changing expense/income/transfer types so a
		// later reversal cannot use stale source, destination or category IDs.
		update := bson.M{"$set": newTx}
		unset := bson.M{}
		for field, ref := range map[string]primitive.ObjectID{"source_account": newTx.SourceAccount, "destination_account": newTx.DestinationAccount, "category": newTx.Category} {
			if ref.IsZero() {
				unset[field] = ""
			}
		}
		if len(unset) > 0 {
			update["$unset"] = unset
		}
		result, err := util.TransactionCollection.UpdateOne(sc, util.TenantFilter(sc, "creator", id), update)
		if err != nil {
			return nil, err
		}
		if result.MatchedCount != 1 {
			return nil, mongo.ErrNoDocuments
		}
		return nil, nil
	})
	if err == nil {
		socket.BroadcastFromContext(ctx, map[string]interface{}{"collection": "transactions", "action": "update"})
	}
	return err
}

func DeleteTransaction(ctx context.Context, id primitive.ObjectID) error {
	session, err := util.MongoClient.StartSession()
	if err != nil {
		return err
	}
	defer session.EndSession(ctx)
	_, err = session.WithTransaction(ctx, func(sc mongo.SessionContext) (interface{}, error) {
		var tx model.Transaction
		if err := util.TransactionCollection.FindOne(sc, util.TenantFilter(sc, "creator", id)).Decode(&tx); err != nil {
			return nil, err
		}
		for _, change := range []struct {
			id     primitive.ObjectID
			amount float64
		}{{tx.SourceAccount, tx.Amount}, {tx.DestinationAccount, -tx.Amount}} {
			if _, err := util.AdjustBalance(sc, change.id, change.amount); err != nil {
				return nil, err
			}
		}
		result, err := util.TransactionCollection.UpdateOne(sc, util.TenantFilter(sc, "creator", id), bson.M{"$set": bson.M{"is_deleted": true, "last_update": time.Now().UTC()}})
		if err != nil {
			return nil, err
		}
		if result.MatchedCount != 1 {
			return nil, mongo.ErrNoDocuments
		}
		return nil, nil
	})
	if err == nil {
		socket.BroadcastFromContext(ctx, map[string]interface{}{"collection": "transactions", "action": "delete"})
	}
	return err
}
