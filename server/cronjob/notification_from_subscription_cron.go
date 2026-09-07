// Package cronjob runs bounded, cancellable, replica-safe subscription workers.
package cronjob

import (
	"context"
	"errors"
	"fintrack/server/model"
	"fintrack/server/service"
	"fintrack/server/telemetry"
	"fintrack/server/util"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo/options"
	"log/slog"
	"time"
)

// Run drains at most one occurrence per subscription and 100 subscriptions per
// tick. No unbounded catch-up or leases: database transactions arbitrate workers.
func Run(ctx context.Context, currency string) {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()
	for {
		tick, cancel := context.WithTimeout(ctx, 25*time.Second)
		if err := Tick(tick, time.Now().UTC(), currency); err != nil && ctx.Err() == nil {
			slog.Error("recurrence_tick_failed")
		}
		cancel()
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}
func Tick(ctx context.Context, now time.Time, currency string) error {
	var failures error
	var oldest time.Duration
	defer func() { telemetry.WorkerTick(failures, oldest) }()
	for _, field := range []string{"next_active", "notify_at"} {
		retryField := "posting_retry_at"
		if field == "notify_at" {
			retryField = "reminder_retry_at"
		}
		filter := bson.M{"$or": bson.A{bson.M{retryField: bson.M{"$exists": false}}, bson.M{retryField: bson.M{"$lte": now}}}, "schedule_version": 2, "is_active": true, "is_deleted": false, "currency": currency, field: bson.M{"$lte": now, "$gt": time.Time{}}}
		cursor, err := util.SubscriptionCollection.Find(ctx, filter, options.Find().SetSort(bson.D{{Key: field, Value: 1}, {Key: "_id", Value: 1}}).SetLimit(100))
		if err != nil {
			failures = err
			return err
		}
		var subs []model.Subscription
		err = cursor.All(ctx, &subs)
		cursor.Close(ctx)
		if err != nil {
			failures = err
			return err
		}
		for _, sub := range subs {
			if ctx.Err() != nil {
				failures = ctx.Err()
				return ctx.Err()
			}
			due := sub.NextActive
			if field == "notify_at" {
				due = sub.NotifyAt
			}
			oldest = max(oldest, now.Sub(due))
			// Failed references/invalid records do not starve the rest of the batch.
			if field == "next_active" {
				_, err = service.ProcessOccurrence(ctx, sub.ID, sub.NextActive, now, currency)
			} else {
				_, err = service.ProcessReminder(ctx, sub.ID, sub.NotifyAt, now, currency)
			}
			if err != nil {
				slog.Error("recurrence_occurrence_failed", "phase", field)
				failures = errors.Join(failures, err)
				// Quarantine a poison occurrence briefly, not the whole due queue.
				// Match its observed schedule so a successful concurrent worker's
				// newer occurrence is never delayed. Financial data is unchanged.
				_, backoffErr := util.SubscriptionCollection.UpdateOne(ctx, bson.M{"_id": sub.ID, field: due}, bson.M{"$set": bson.M{retryField: now.Add(5 * time.Minute)}})
				failures = errors.Join(failures, backoffErr)
			}
		}
	}
	return failures
}
