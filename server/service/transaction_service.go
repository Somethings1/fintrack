package service

import (
	"context"
	"database/sql"
	"errors"
	"fintrack/server/model"
	"fintrack/server/money"
	"fintrack/server/socket"
	"fintrack/server/util"
	"github.com/jackc/pgx/v5/pgconn"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"time"
)

const transactionCols = `id,creator,currency,amount_micros,date_time,type,source_account_id,destination_account_id,category_id,note,COALESCE(request_key,''),COALESCE(request_hash,''),subscription_id,occurrence_at,last_update,is_deleted`

func GetTransactionByID(ctx context.Context, id string) (model.Transaction, error) {
	if _, err := primitive.ObjectIDFromHex(id); err != nil {
		return model.Transaction{}, err
	}
	return scanTransaction(util.DB.QueryRowContext(ctx, `SELECT `+transactionCols+` FROM transactions WHERE id=$1 AND creator=$2 AND is_deleted=false`, id, util.UserID(ctx)))
}

func addTransactionInternal(ctx context.Context, v model.Transaction) (interface{}, error) {
	v.Creator = util.UserID(ctx)
	v.IsDeleted = false
	currency, err := money.Resolve(ctx, v.Currency)
	if err != nil {
		return nil, err
	}
	v.Currency = currency
	if err := validateTransaction(v); err != nil {
		return nil, err
	}
	v.ID = primitive.NewObjectID()
	v.RequestKey, _ = ctx.Value(util.RequestKey).(string)
	v.RequestHash = transactionDigest(v)
	if v.RequestKey != "" {
		if id, e := replayTransaction(ctx, v.RequestKey, v.RequestHash); e == nil {
			return id, nil
		} else if !errors.Is(e, sql.ErrNoRows) {
			return nil, e
		}
	}
	tx, err := util.BeginLedgerTx(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()
	if err := validateCategory(ctx, tx, v); err != nil {
		return nil, err
	}
	// Lock all affected accounts in a stable order before acquiring FK locks.
	// Opposite-direction transfers must not deadlock while upgrading locks.
	if err := lockTransactionAccounts(ctx, tx, v.SourceAccount, v.DestinationAccount); err != nil {
		return nil, err
	}
	v.LastUpdate = time.Now().UTC()
	_, err = tx.ExecContext(ctx, `INSERT INTO transactions(id,creator,currency,amount_micros,date_time,type,source_account_id,destination_account_id,category_id,note,request_key,request_hash,subscription_id,occurrence_at,last_update,is_deleted) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,false)`, v.ID.Hex(), v.Creator, v.Currency, int64(v.Amount), v.DateTime, v.Type, nullID(v.SourceAccount), nullID(v.DestinationAccount), nullID(v.Category), v.Note, nullString(v.RequestKey), nullString(v.RequestHash), nullID(v.SubscriptionID), nullTime(v.OccurrenceAt), v.LastUpdate)
	if err == nil && !v.SourceAccount.IsZero() {
		_, err = util.AdjustBalance(ctx, tx, v.SourceAccount, -v.Amount)
	}
	if err == nil && !v.DestinationAccount.IsZero() {
		_, err = util.AdjustBalance(ctx, tx, v.DestinationAccount, v.Amount)
	}
	if err != nil {
		// Release this connection and its locks before a replay lookup. Only the
		// request-key constraint is an idempotent race, not arbitrary DB errors.
		_ = tx.Rollback()
		var duplicate *pgconn.PgError
		if v.RequestKey != "" && errors.As(err, &duplicate) && duplicate.Code == "23505" && duplicate.ConstraintName == "transactions_request_key_idx" {
			return replayTransaction(ctx, v.RequestKey, v.RequestHash)
		}
		return nil, err
	}
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return v.ID, nil
}
func AddTransactionSilent(ctx context.Context, v model.Transaction) (interface{}, error) {
	return addTransactionInternal(ctx, v)
}
func AddTransaction(ctx context.Context, v model.Transaction) (interface{}, error) {
	id, err := addTransactionInternal(ctx, v)
	if err == nil {
		socket.BroadcastFromContext(ctx, map[string]interface{}{"collection": "transactions", "action": "create"})
	}
	return id, err
}

func UpdateTransaction(ctx context.Context, id primitive.ObjectID, v model.Transaction) error {
	v.Creator = util.UserID(ctx)
	v.ID = id
	v.IsDeleted = false
	currency, err := money.Resolve(ctx, v.Currency)
	if err != nil {
		return err
	}
	v.Currency = currency
	if err := validateTransaction(v); err != nil {
		return err
	}
	tx, err := util.BeginLedgerTx(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	old, err := scanTransaction(tx.QueryRowContext(ctx, `SELECT `+transactionCols+` FROM transactions WHERE id=$1 AND creator=$2 AND is_deleted=false FOR UPDATE`, id.Hex(), util.UserID(ctx)))
	if err != nil {
		return err
	}
	if err := util.CheckVersion(ctx, old.LastUpdate); err != nil {
		return err
	}
	if err := validateCategory(ctx, tx, v); err != nil {
		return err
	}
	if err := lockTransactionAccounts(ctx, tx, old.SourceAccount, old.DestinationAccount, v.SourceAccount, v.DestinationAccount); err != nil {
		return err
	}
	for _, change := range []struct {
		id     primitive.ObjectID
		amount money.Amount
	}{{old.SourceAccount, old.Amount}, {old.DestinationAccount, -old.Amount}, {v.SourceAccount, -v.Amount}, {v.DestinationAccount, v.Amount}} {
		if !change.id.IsZero() {
			if _, err := util.AdjustBalance(ctx, tx, change.id, change.amount); err != nil {
				return err
			}
		}
	}
	v.LastUpdate = time.Now().UTC()
	res, err := tx.ExecContext(ctx, `UPDATE transactions SET currency=$1,amount_micros=$2,date_time=$3,type=$4,source_account_id=$5,destination_account_id=$6,category_id=$7,note=$8,last_update=$9 WHERE id=$10 AND creator=$11 AND is_deleted=false`, v.Currency, int64(v.Amount), v.DateTime, v.Type, nullID(v.SourceAccount), nullID(v.DestinationAccount), nullID(v.Category), v.Note, v.LastUpdate, id.Hex(), util.UserID(ctx))
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
	socket.BroadcastFromContext(ctx, map[string]interface{}{"collection": "transactions", "action": "update"})
	return nil
}
func DeleteTransaction(ctx context.Context, id primitive.ObjectID) error {
	tx, err := util.BeginLedgerTx(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	v, err := scanTransaction(tx.QueryRowContext(ctx, `SELECT `+transactionCols+` FROM transactions WHERE id=$1 AND creator=$2 AND is_deleted=false FOR UPDATE`, id.Hex(), util.UserID(ctx)))
	if err != nil {
		return err
	}
	if err := util.CheckVersion(ctx, v.LastUpdate); err != nil {
		return err
	}
	if err := lockTransactionAccounts(ctx, tx, v.SourceAccount, v.DestinationAccount); err != nil {
		return err
	}
	for _, change := range []struct {
		id     primitive.ObjectID
		amount money.Amount
	}{{v.SourceAccount, v.Amount}, {v.DestinationAccount, -v.Amount}} {
		if !change.id.IsZero() {
			if _, err := util.AdjustBalance(ctx, tx, change.id, change.amount); err != nil {
				return err
			}
		}
	}
	res, err := tx.ExecContext(ctx, `UPDATE transactions SET is_deleted=true,last_update=now() WHERE id=$1 AND creator=$2 AND is_deleted=false`, id.Hex(), util.UserID(ctx))
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
	socket.BroadcastFromContext(ctx, map[string]interface{}{"collection": "transactions", "action": "delete"})
	return nil
}
func SyncTransactions(ctx context.Context, user string, since, after time.Time, afterID primitive.ObjectID, limit int) ([]model.Transaction, bool, error) {
	after, id := afterArgs(after, afterID)
	rows, err := util.DB.QueryContext(ctx, `SELECT `+transactionCols+` FROM transactions WHERE creator=$1 AND last_update >= $2 AND ($3::timestamptz IS NULL OR (last_update,id)>($3,$4)) ORDER BY last_update,id LIMIT $5`, user, since, nullTime(after), nullString(id), limit+1)
	if err != nil {
		return nil, false, err
	}
	defer rows.Close()
	out := make([]model.Transaction, 0, limit+1)
	for rows.Next() {
		v, e := scanTransaction(rows)
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
