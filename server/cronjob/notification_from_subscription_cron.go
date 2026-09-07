// Package cronjob runs bounded, cancellable, replica-safe subscription workers.
package cronjob

import (
	"context"
	"errors"
	"fintrack/server/model"
	"fintrack/server/service"
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
	for _, field := range []string{"next_active", "notify_at"} {
		filter := bson.M{"schedule_version": 2, "is_active": true, "is_deleted": false, "currency": currency, field: bson.M{"$lte": now, "$gt": time.Time{}}}
		cursor, err := util.SubscriptionCollection.Find(ctx, filter, options.Find().SetSort(bson.D{{Key: field, Value: 1}, {Key: "_id", Value: 1}}).SetLimit(100))
		if err != nil {
			return err
		}
		var subs []model.Subscription
		err = cursor.All(ctx, &subs)
		cursor.Close(ctx)
		if err != nil {
			return err
		}
		for _, sub := range subs {
			if ctx.Err() != nil {
				return ctx.Err()
			}
			// Failed references/invalid records do not starve the rest of the batch.
			if field == "next_active" {
				_, err = service.ProcessOccurrence(ctx, sub.ID, sub.NextActive, now, currency)
			} else {
				_, err = service.ProcessReminder(ctx, sub.ID, sub.NotifyAt, now, currency)
			}
			if err != nil {
				slog.Error("recurrence_occurrence_failed", "phase", field)
				failures = errors.Join(failures, err)
			}
		}
	}
	return failures
}
