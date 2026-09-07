// Package cronjob runs bounded, cancellable, replica-safe subscription workers.
package cronjob

import (
	"context"
	"errors"
	"fintrack/server/service"
	"fintrack/server/telemetry"
	"log/slog"
	"time"
)

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
		subs, err := service.DueSubscriptions(ctx, field, now, currency, 100)
		if err != nil {
			return err
		}
		for _, sub := range subs {
			if ctx.Err() != nil {
				return ctx.Err()
			}
			due := sub.NextActive
			if field == "notify_at" {
				due = sub.NotifyAt
			}
			oldest = max(oldest, now.Sub(due))
			if field == "next_active" {
				_, err = service.ProcessOccurrence(ctx, sub.ID, sub.NextActive, now, currency)
			} else {
				_, err = service.ProcessReminder(ctx, sub.ID, sub.NotifyAt, now, currency)
			}
			if err != nil {
				slog.Error("recurrence_occurrence_failed", "phase", field)
				failures = errors.Join(failures, err)
				failures = errors.Join(failures, service.BackoffSubscription(ctx, sub.ID, field, due, now.Add(5*time.Minute)))
			}
		}
	}
	return failures
}
