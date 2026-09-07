package service

import (
	"context"
	"database/sql"
	"fintrack/server/model"
	"fintrack/server/money"
	"fintrack/server/socket"
	"fintrack/server/util"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"time"
)

const subscriptionCols = `id,creator,currency,schedule_version,name,icon,amount_micros,source_account_id,category_id,start_date,interval_unit,max_interval,current_interval,is_active,remind_before,next_active,notify_at,last_update,is_deleted`

func GetSubscriptionById(ctx context.Context, id string) (model.Subscription, error) {
	if _, err := primitive.ObjectIDFromHex(id); err != nil {
		return model.Subscription{}, err
	}
	return scanSubscription(util.DB.QueryRowContext(ctx, `SELECT `+subscriptionCols+` FROM subscriptions WHERE id=$1 AND creator=$2 AND is_deleted=false`, id, util.UserID(ctx)))
}
func AddSubscription(ctx context.Context, v model.Subscription) (interface{}, error) {
	v.Creator = util.UserID(ctx)
	currency, err := money.Resolve(ctx, v.Currency)
	if err != nil {
		return nil, err
	}
	v.Currency = currency
	if err := validateSubscription(v); err != nil {
		return nil, err
	}
	v.ID = primitive.NewObjectID()
	v.CurrentInterval = 0
	v.ScheduleVersion = 2
	v.StartDate = v.StartDate.UTC().Truncate(time.Millisecond)
	v.NextActive = v.StartDate
	v.NotifyAt = v.StartDate.AddDate(0, 0, -v.RemindBefore)
	v.LastUpdate = time.Now().UTC()
	v.IsActive = true
	tx, err := util.BeginLedgerTx(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()
	if err := touchSubscriptionReferences(ctx, tx, v); err != nil {
		return nil, err
	}
	_, err = tx.ExecContext(ctx, `INSERT INTO subscriptions(id,creator,currency,schedule_version,name,icon,amount_micros,source_account_id,category_id,start_date,interval_unit,max_interval,current_interval,is_active,remind_before,next_active,notify_at,last_update,is_deleted) VALUES($1,$2,$3,2,$4,$5,$6,$7,$8,$9,$10,$11,0,true,$12,$13,$14,$15,false)`, v.ID.Hex(), v.Creator, v.Currency, v.Name, v.Icon, int64(v.Amount), v.SourceAccount.Hex(), v.Category.Hex(), v.StartDate, v.Interval, v.MaxInterval, v.RemindBefore, v.NextActive, nullTime(v.NotifyAt), v.LastUpdate)
	if err != nil {
		return nil, err
	}
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	socket.BroadcastFromContext(ctx, map[string]interface{}{"collection": "subscriptions", "action": "create"})
	return v.ID, nil
}
func UpdateSubscription(ctx context.Context, id primitive.ObjectID, v model.Subscription) error {
	v.Creator = util.UserID(ctx)
	currency, err := money.Resolve(ctx, v.Currency)
	if err != nil {
		return err
	}
	v.Currency = currency
	if err := validateSubscription(v); err != nil {
		return err
	}
	tx, err := util.BeginLedgerTx(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	old, err := scanSubscription(tx.QueryRowContext(ctx, `SELECT `+subscriptionCols+` FROM subscriptions WHERE id=$1 AND creator=$2 AND is_deleted=false FOR UPDATE`, id.Hex(), util.UserID(ctx)))
	if err != nil {
		return err
	}
	if old.ScheduleVersion != 2 || (old.CurrentInterval > 0 && (!old.StartDate.Equal(v.StartDate) || old.Interval != v.Interval)) {
		return ErrScheduleImmutable
	}
	if v.MaxInterval > 0 && v.MaxInterval < old.CurrentInterval {
		return ErrScheduleImmutable
	}
	if err := touchSubscriptionReferences(ctx, tx, v); err != nil {
		return err
	}
	next, err := OccurrenceAt(v.StartDate, v.Interval, old.CurrentInterval)
	if err != nil {
		return err
	}
	active := v.MaxInterval == 0 || old.CurrentInterval < v.MaxInterval
	res, err := tx.ExecContext(ctx, `UPDATE subscriptions SET name=$1,icon=$2,amount_micros=$3,source_account_id=$4,category_id=$5,start_date=$6,interval_unit=$7,max_interval=$8,remind_before=$9,next_active=$10,notify_at=$11,is_active=$12,last_update=now() WHERE id=$13 AND creator=$14 AND is_deleted=false`, v.Name, v.Icon, int64(v.Amount), v.SourceAccount.Hex(), v.Category.Hex(), v.StartDate.UTC(), v.Interval, v.MaxInterval, v.RemindBefore, next, nullTime(next.AddDate(0, 0, -v.RemindBefore)), active, id.Hex(), util.UserID(ctx))
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n != 1 {
		return sql.ErrNoRows
	}
	if err := tx.Commit(); err != nil {
		return err
	}
	socket.BroadcastFromContext(ctx, map[string]interface{}{"collection": "subscriptions", "action": "update"})
	return nil
}
func DeleteSubscription(ctx context.Context, id primitive.ObjectID) error {
	res, err := util.DB.ExecContext(ctx, `UPDATE subscriptions SET is_deleted=true,is_active=false,last_update=now() WHERE id=$1 AND creator=$2 AND is_deleted=false`, id.Hex(), util.UserID(ctx))
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n != 1 {
		return sql.ErrNoRows
	}
	socket.BroadcastFromContext(ctx, map[string]interface{}{"collection": "subscriptions", "action": "delete"})
	return nil
}
func SyncSubscriptions(ctx context.Context, user string, since, after time.Time, afterID primitive.ObjectID, limit int) ([]model.Subscription, bool, error) {
	after, id := afterArgs(after, afterID)
	rows, err := util.DB.QueryContext(ctx, `SELECT `+subscriptionCols+` FROM subscriptions WHERE creator=$1 AND last_update >= $2 AND ($3::timestamptz IS NULL OR (last_update,id)>($3,$4)) ORDER BY last_update,id LIMIT $5`, user, since, nullTime(after), nullString(id), limit+1)
	if err != nil {
		return nil, false, err
	}
	defer rows.Close()
	out := make([]model.Subscription, 0, limit+1)
	for rows.Next() {
		v, e := scanSubscription(rows)
		if e != nil {
			return nil, false, e
		}
		out = append(out, v)
	}
	if err := rows.Err(); err != nil {
		return nil, false, err
	}
	more := len(out) > limit
	if more {
		out = out[:limit]
	}
	return out, more, nil
}
