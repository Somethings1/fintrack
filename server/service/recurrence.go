package service

import (
	"context"
	"errors"
	"fintrack/server/model"
	"fintrack/server/money"
	"fintrack/server/socket"
	"fintrack/server/util"
	"fmt"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"time"
)

var ErrScheduleImmutable = errors.New("a posted schedule cannot change its start, interval, or processed count; create a new schedule")

// OccurrenceAt is anchored to the original UTC date, clamping month ends and
// leap days instead of repeatedly adding a month to an already-clamped date.
// Ordinal zero is the first charge. CurrentInterval is the count already posted.
func OccurrenceAt(start time.Time, interval string, ordinal int) (time.Time, error) {
	if start.IsZero() || start.Year() < 1970 || ordinal < 0 || ordinal > 100000 {
		return time.Time{}, errors.New("invalid recurrence range")
	}
	start = start.UTC()
	var result time.Time
	switch interval {
	case "day":
		result = start.AddDate(0, 0, ordinal)
	case "week":
		result = start.AddDate(0, 0, ordinal*7)
	case "month", "year":
		months := ordinal
		if interval == "year" {
			months *= 12
		}
		first := time.Date(start.Year(), start.Month(), 1, start.Hour(), start.Minute(), start.Second(), start.Nanosecond(), time.UTC).AddDate(0, months, 0)
		last := time.Date(first.Year(), first.Month()+1, 0, 0, 0, 0, 0, time.UTC).Day()
		day := start.Day()
		if day > last {
			day = last
		}
		result = time.Date(first.Year(), first.Month(), day, start.Hour(), start.Minute(), start.Second(), start.Nanosecond(), time.UTC)
	default:
		return time.Time{}, errors.New("unsupported recurrence interval")
	}
	if result.Year() > 9999 {
		return time.Time{}, errors.New("recurrence exceeds supported calendar")
	}
	return result, nil
}
func validateSubscription(sub model.Subscription) error {
	if sub.Creator == "" || sub.Name == "" || len(sub.Name) > 100 || sub.Amount <= 0 || sub.SourceAccount.IsZero() || sub.Category.IsZero() || sub.RemindBefore < 0 || sub.RemindBefore > 366 || sub.MaxInterval < 0 || sub.MaxInterval > 100000 {
		return errors.New("invalid subscription")
	}
	if err := money.Validate(sub.Amount, sub.Currency); err != nil {
		return err
	}
	_, err := OccurrenceAt(sub.StartDate, sub.Interval, 0)
	return err
}
func subscriptionContext(sc mongo.SessionContext, sub model.Subscription) mongo.SessionContext {
	ctx := money.WithCurrency(context.WithValue(sc, util.UserIdKey, sub.Creator), sub.Currency)
	ctx = context.WithValue(ctx, util.ClientIdKey, "")
	return mongo.NewSessionContext(ctx, sc)
}
func touchSubscriptionReferences(sc mongo.SessionContext, sub model.Subscription) error {
	tx := model.Transaction{Type: "expense", Creator: sub.Creator, Currency: sub.Currency, Category: sub.Category}
	if err := validateCategory(sc, tx); err != nil {
		return err
	}
	// A zero increment is an actual metadata write, serializing against archive.
	_, err := util.AdjustBalance(sc, sub.SourceAccount, 0)
	return err
}

// ProcessOccurrence atomically advances the schedule, inserts the unique
// occurrence, and posts its balance effect. Retried/crashed/concurrent workers
// cannot commit only part of an occurrence, and tombstones retain deduplication.
func ProcessOccurrence(ctx context.Context, id primitive.ObjectID, due, now time.Time, currency string) (bool, error) {
	session, err := util.MongoClient.StartSession()
	if err != nil {
		return false, err
	}
	defer session.EndSession(ctx)
	result, err := session.WithTransaction(ctx, func(sc mongo.SessionContext) (interface{}, error) {
		filter := bson.M{"_id": id, "next_active": due, "is_active": true, "is_deleted": false, "schedule_version": 2, "currency": currency}
		var sub model.Subscription
		if err := util.SubscriptionCollection.FindOne(sc, filter).Decode(&sub); err != nil {
			if errors.Is(err, mongo.ErrNoDocuments) {
				return false, nil
			}
			return nil, err
		}
		if due.After(now) {
			return false, nil
		}
		if err := validateSubscription(sub); err != nil {
			return nil, err
		}
		expected, err := OccurrenceAt(sub.StartDate, sub.Interval, sub.CurrentInterval)
		if err != nil || !expected.Equal(due) {
			return nil, errors.New("schedule position does not match its anchor")
		}
		if sub.MaxInterval > 0 && sub.CurrentInterval >= sub.MaxInterval {
			return nil, errors.New("invalid completed schedule")
		}
		sc = subscriptionContext(sc, sub)
		next, err := OccurrenceAt(sub.StartDate, sub.Interval, sub.CurrentInterval+1)
		if err != nil {
			return nil, err
		}
		active := sub.MaxInterval == 0 || sub.CurrentInterval+1 < sub.MaxInterval
		update := bson.M{"current_interval": sub.CurrentInterval + 1, "next_active": next, "notify_at": next.AddDate(0, 0, -sub.RemindBefore), "is_active": active, "last_update": now.UTC()}
		res, err := util.SubscriptionCollection.UpdateOne(sc, filter, bson.M{"$set": update})
		if err != nil {
			return nil, err
		}
		if res.MatchedCount != 1 {
			return false, nil
		}
		tx := model.Transaction{ID: primitive.NewObjectID(), Creator: sub.Creator, Currency: sub.Currency, Amount: sub.Amount, DateTime: due, Type: "expense", SourceAccount: sub.SourceAccount, Category: sub.Category, Note: "Subscription payment for " + sub.Name, LastUpdate: now.UTC(), SubscriptionID: sub.ID, OccurrenceAt: due}
		if err := validateTransaction(tx); err != nil {
			return nil, err
		}
		if err := validateCategory(sc, tx); err != nil {
			return nil, err
		}
		if _, err := util.TransactionCollection.InsertOne(sc, tx); err != nil {
			return nil, err
		}
		if _, err := util.AdjustBalance(sc, sub.SourceAccount, -sub.Amount); err != nil {
			return nil, err
		}
		return true, nil
	})
	posted, _ := result.(bool)
	if posted && err == nil {
		// The worker's outer context intentionally has no user. Broadcast only after
		// commit and from the stored subscription owner, never a supplied payload.
		var sub model.Subscription
		if util.SubscriptionCollection.FindOne(ctx, bson.M{"_id": id, "currency": currency}).Decode(&sub) == nil {
			for _, kind := range []string{"subscriptions", "transactions", "accounts", "savings"} {
				socket.Manager.BroadcastToUserExcept(sub.Creator, "", map[string]string{"collection": kind, "action": "refresh"})
			}
		}
	}
	return posted, err
}

func ProcessReminder(ctx context.Context, id primitive.ObjectID, notifyAt, now time.Time, currency string) (bool, error) {
	session, err := util.MongoClient.StartSession()
	if err != nil {
		return false, err
	}
	defer session.EndSession(ctx)
	result, err := session.WithTransaction(ctx, func(sc mongo.SessionContext) (interface{}, error) {
		filter := bson.M{"_id": id, "notify_at": notifyAt, "is_active": true, "is_deleted": false, "schedule_version": 2, "currency": currency}
		var sub model.Subscription
		if err := util.SubscriptionCollection.FindOne(sc, filter).Decode(&sub); err != nil {
			if errors.Is(err, mongo.ErrNoDocuments) {
				return false, nil
			}
			return nil, err
		}
		if notifyAt.IsZero() || notifyAt.After(now) || !sub.NextActive.After(now) {
			return false, nil
		}
		sc = subscriptionContext(sc, sub)
		key := sub.ID.Hex() + ":" + sub.NextActive.UTC().Format(time.RFC3339Nano)
		// Clearing the due marker and inserting the reminder are one transaction.
		if _, err := util.SubscriptionCollection.UpdateOne(sc, filter, bson.M{"$set": bson.M{"notify_at": time.Time{}, "last_update": now.UTC()}}); err != nil {
			return nil, err
		}
		existing, err := util.NotificationCollection.CountDocuments(sc, bson.M{"owner": sub.Creator, "occurrence_key": key})
		if err != nil {
			return nil, err
		}
		if existing > 0 {
			return false, nil
		}
		n := model.Notification{ID: primitive.NewObjectID(), Owner: sub.Creator, Type: model.TypeSubscription, ReferenceId: sub.ID, Title: "Subscription reminder", Message: fmt.Sprintf("%s is due on %s (UTC)", sub.Name, sub.NextActive.UTC().Format("2006-01-02")), ScheduledAt: now.UTC(), LastUpdate: now.UTC(), OccurrenceKey: key}
		_, err = util.NotificationCollection.InsertOne(sc, n)
		return err == nil, err
	})
	made, _ := result.(bool)
	return made, err
}
