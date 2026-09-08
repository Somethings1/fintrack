package service

import (
	"context"
	"database/sql"
	"errors"
	"fintrack/server/model"
	"fintrack/server/money"
	"fintrack/server/socket"
	"fintrack/server/util"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"time"
)

const accountCols = `id,owner,currency,opening_balance_micros,balance_micros,icon,name,last_update,is_deleted`

func GetAccountByID(ctx context.Context, id string) (model.Account, error) {
	if _, err := primitive.ObjectIDFromHex(id); err != nil {
		return model.Account{}, err
	}
	return scanAccount(util.DB.QueryRowContext(ctx, `SELECT `+accountCols+` FROM financial_accounts WHERE id=$1 AND owner=$2 AND kind='account' AND is_deleted=false`, id, util.UserID(ctx)))
}

func AddAccount(ctx context.Context, a model.Account) (interface{}, error) {
	a.Owner = util.UserID(ctx)
	if a.Owner == "" {
		return nil, errors.New("missing authenticated owner")
	}
	currency, err := money.Resolve(ctx, a.Currency)
	if err != nil {
		return nil, err
	}
	a.Currency = currency
	if err := money.Validate(a.Balance, currency); err != nil {
		return nil, err
	}
	a.ID = primitive.NewObjectID()
	a.OpeningBalance = a.Balance
	a.LastUpdate = time.Now().UTC()
	a.IsDeleted = false
	_, err = util.DB.ExecContext(ctx, `INSERT INTO financial_accounts(id,owner,kind,currency,opening_balance_micros,balance_micros,icon,name,last_update,is_deleted) VALUES($1,$2,'account',$3,$4,$5,$6,$7,$8,false)`, a.ID.Hex(), a.Owner, a.Currency, int64(a.OpeningBalance), int64(a.Balance), a.Icon, a.Name, a.LastUpdate)
	if err != nil {
		return nil, err
	}
	socket.BroadcastFromContext(ctx, map[string]interface{}{"collection": "accounts", "action": "create", "detail": a})
	return a.ID, nil
}

func UpdateAccount(ctx context.Context, id primitive.ObjectID, a model.Account) error {
	if _, err := money.Resolve(ctx, a.Currency); err != nil {
		return err
	}
	if err := money.Validate(a.Balance, money.Currency(ctx)); err != nil {
		return err
	}
	res, err := conditionalUpdate(ctx, `UPDATE financial_accounts SET name=$1,icon=$2,last_update=now() WHERE id=$3 AND owner=$4 AND kind='account' AND is_deleted=false`, a.Name, a.Icon, id.Hex(), util.UserID(ctx))
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n != 1 {
		return sql.ErrNoRows
	}
	socket.BroadcastFromContext(ctx, map[string]interface{}{"collection": "accounts", "action": "update"})
	return nil
}

func DeleteAccount(ctx context.Context, id primitive.ObjectID) error {
	return archiveFinancialAccount(ctx, "account", "accounts", id)
}

func SyncAccounts(ctx context.Context, user string, since, after time.Time, afterID primitive.ObjectID, limit int) ([]model.Account, bool, error) {
	after, id := afterArgs(after, afterID)
	rows, err := util.DB.QueryContext(ctx, `SELECT `+accountCols+` FROM financial_accounts WHERE owner=$1 AND kind='account' AND last_update >= $2 AND ($3::timestamptz IS NULL OR (last_update,id)>($3,$4)) ORDER BY last_update,id LIMIT $5`, user, since, nullTime(after), nullString(id), limit+1)
	if err != nil {
		return nil, false, err
	}
	defer rows.Close()
	out := make([]model.Account, 0, limit+1)
	for rows.Next() {
		v, e := scanAccount(rows)
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
