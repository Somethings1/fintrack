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

func GetTransactionByID(id string) (model.Transaction, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	objectID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return model.Transaction{}, err
	}

	var transaction model.Transaction

	err = util.TransactionCollection.FindOne(ctx, bson.M{"_id": objectID}).Decode(&transaction)
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
			"$gt": since,
		},
		"creator": username,
	}

	opts := options.Find().SetSort(bson.D{
		{Key: "last_update", Value: -1},
	})

	return util.TransactionCollection.Find(ctx, filter, opts)
}

func addTransactionInternal(ctx context.Context, transaction model.Transaction) (interface{}, error) {
	session, err := util.MongoClient.StartSession()
	if err != nil {
		return nil, fmt.Errorf("Failed to start session: %w", err)
	}
	defer session.EndSession(ctx)

	transaction.LastUpdate = time.Now()

	result, err := session.WithTransaction(ctx, func(sc mongo.SessionContext) (interface{}, error) {
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
	newTx.LastUpdate = time.Now()
	err := util.MongoClient.UseSession(ctx, func(sc mongo.SessionContext) error {
		if err := sc.StartTransaction(); err != nil {
			return err
		}

		var oldTx model.Transaction
		err := util.TransactionCollection.FindOne(sc, bson.M{"_id": id}).Decode(&oldTx)
		if err != nil {
			_ = sc.AbortTransaction(sc)
			return err
		}

		// Reverse old transaction
		_, err = util.AdjustBalance(sc, oldTx.SourceAccount, oldTx.Amount)
		if err != nil {
			_ = sc.AbortTransaction(sc)
			return err
		}
		_, err = util.AdjustBalance(sc, oldTx.DestinationAccount, -oldTx.Amount)
		if err != nil {
			_ = sc.AbortTransaction(sc)
			return err
		}

		// Apply new transaction
		_, err = util.AdjustBalance(sc, newTx.SourceAccount, -newTx.Amount)
		if err != nil {
			_ = sc.AbortTransaction(sc)
			return err
		}
		_, err = util.AdjustBalance(sc, newTx.DestinationAccount, newTx.Amount)
		if err != nil {
			_ = sc.AbortTransaction(sc)
			return err
		}

		// Update transaction record
		_, err = util.TransactionCollection.UpdateOne(
			sc,
			bson.M{"_id": id},
			bson.M{"$set": newTx},
		)
		if err != nil {
			_ = sc.AbortTransaction(sc)
			return err
		}

		return sc.CommitTransaction(sc)
	})

	if err != nil {
		return err
	}

	socket.BroadcastFromContext(ctx, map[string]interface{}{
		"collection": "transactions",
		"action":     "update",
		"detail":     newTx,
	})

	return nil
}

func DeleteTransaction(ctx context.Context, id primitive.ObjectID) error {
	err := util.MongoClient.UseSession(ctx, func(sc mongo.SessionContext) error {
		if err := sc.StartTransaction(); err != nil {
			return err
		}

		var tx model.Transaction
		err := util.TransactionCollection.FindOne(sc, bson.M{"_id": id}).Decode(&tx)
		if err != nil {
			_ = sc.AbortTransaction(sc)
			return err
		}

		// Reverse balance effect
		_, err = util.AdjustBalance(sc, tx.SourceAccount, tx.Amount)
		if err != nil {
			_ = sc.AbortTransaction(sc)
			return err
		}
		_, err = util.AdjustBalance(sc, tx.DestinationAccount, -tx.Amount)
		if err != nil {
			_ = sc.AbortTransaction(sc)
			return err
		}

		// Soft delete the transaction
		update := bson.M{
			"$set": bson.M{
				"is_deleted":  true,
				"last_update": time.Now(),
			},
		}
		_, err = util.TransactionCollection.UpdateOne(sc, bson.M{"_id": id}, update)
		if err != nil {
			_ = sc.AbortTransaction(sc)
			return err
		}

		return sc.CommitTransaction(sc)
	})

	if err != nil {
		return err
	}

	socket.BroadcastFromContext(ctx, map[string]interface{}{
		"collection": "transactions",
		"action":     "delete",
		"detail":     id,
	})

	return nil
}
