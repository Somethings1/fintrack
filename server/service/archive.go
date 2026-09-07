package service

import (
	"context"
	"errors"
	"fintrack/server/socket"
	"fintrack/server/util"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"time"
)

var ErrReferenced = errors.New("record is referenced by active financial records; remove or reassign those records explicitly first")
var ErrIdempotencyConflict = errors.New("idempotency key was already used for another transaction")

// Archive only unreferenced objects. Never cascade-delete ledger entries without
// the balance reversals and explicit user intent required by transaction deletion.
func archiveUnreferenced(ctx context.Context, collection *mongo.Collection, kind string, id primitive.ObjectID) error {
	session, err := util.StartLedgerSession()
	if err != nil {
		return err
	}
	defer session.EndSession(ctx)
	_, err = session.WithTransaction(ctx, func(sc mongo.SessionContext) (interface{}, error) {
		user, _ := ctx.Value(util.UserIdKey).(string)
		txFilter := bson.M{"creator": user, "is_deleted": bson.M{"$ne": true}}
		subFilter := bson.M{"creator": user, "is_deleted": bson.M{"$ne": true}}
		if kind == "categories" {
			txFilter["category"] = id
			subFilter["category"] = id
		} else {
			txFilter["$or"] = bson.A{bson.M{"source_account": id}, bson.M{"destination_account": id}}
			subFilter["source_account"] = id
		}
		for _, target := range []struct {
			c *mongo.Collection
			f bson.M
		}{{util.TransactionCollection, txFilter}, {util.SubscriptionCollection, subFilter}} {
			count, err := target.c.CountDocuments(sc, target.f, options.Count().SetLimit(1))
			if err != nil {
				return nil, err
			}
			if count > 0 {
				return nil, ErrReferenced
			}
		}
		result, err := collection.UpdateOne(sc, util.TenantFilter(sc, "owner", id), bson.M{"$set": bson.M{"is_deleted": true, "last_update": time.Now().UTC()}})
		if err != nil {
			return nil, err
		}
		if result.MatchedCount != 1 {
			return nil, mongo.ErrNoDocuments
		}
		return nil, nil
	})
	if err == nil {
		socket.BroadcastFromContext(ctx, map[string]interface{}{"collection": kind, "action": "delete"})
	}
	return err
}

// This write serializes reference creation against concurrent archival, even
// when the reference itself does not alter a monetary balance.
func touchReference(sc mongo.SessionContext, collection *mongo.Collection, id primitive.ObjectID) error {
	result, err := collection.UpdateOne(sc, util.TenantFilter(sc, "owner", id), bson.M{"$inc": bson.M{"reference_version": 1}})
	if err != nil {
		return err
	}
	if result.MatchedCount != 1 {
		return mongo.ErrNoDocuments
	}
	return nil
}
