package service

import(
	"context"
	"database/sql"
	"errors"
	"fintrack/server/socket"
	"fintrack/server/util"
	"go.mongodb.org/mongo-driver/bson/primitive"
)
var ErrReferenced=errors.New("record is referenced by active financial records; remove or reassign those records explicitly first")
var ErrIdempotencyConflict=errors.New("idempotency key was already used for another transaction")

func archiveFinancialAccount(ctx context.Context,kind,collection string,id primitive.ObjectID)error{tx,err:=util.BeginLedgerTx(ctx);if err!=nil{return err};defer tx.Rollback();var one int;err=tx.QueryRowContext(ctx,`SELECT 1 FROM financial_accounts WHERE id=$1 AND owner=$2 AND kind=$3 AND is_deleted=false FOR UPDATE`,id.Hex(),util.UserID(ctx),kind).Scan(&one);if err!=nil{return err};var referenced bool;err=tx.QueryRowContext(ctx,`SELECT EXISTS(SELECT 1 FROM transactions WHERE creator=$1 AND is_deleted=false AND (source_account_id=$2 OR destination_account_id=$2)) OR EXISTS(SELECT 1 FROM subscriptions WHERE creator=$1 AND is_deleted=false AND source_account_id=$2)`,util.UserID(ctx),id.Hex()).Scan(&referenced);if err!=nil{return err};if referenced{return ErrReferenced};res,err:=tx.ExecContext(ctx,`UPDATE financial_accounts SET is_deleted=true,last_update=now() WHERE id=$1 AND owner=$2 AND kind=$3 AND is_deleted=false`,id.Hex(),util.UserID(ctx),kind);if err!=nil{return err};n,_:=res.RowsAffected();if n!=1{return sql.ErrNoRows};if err:=tx.Commit();err!=nil{return err};socket.BroadcastFromContext(ctx,map[string]interface{}{"collection":collection,"action":"delete"});return nil}
func archiveCategory(ctx context.Context,id primitive.ObjectID)error{tx,err:=util.BeginLedgerTx(ctx);if err!=nil{return err};defer tx.Rollback();var one int;err=tx.QueryRowContext(ctx,`SELECT 1 FROM categories WHERE id=$1 AND owner=$2 AND is_deleted=false FOR UPDATE`,id.Hex(),util.UserID(ctx)).Scan(&one);if err!=nil{return err};var referenced bool;err=tx.QueryRowContext(ctx,`SELECT EXISTS(SELECT 1 FROM transactions WHERE creator=$1 AND is_deleted=false AND category_id=$2) OR EXISTS(SELECT 1 FROM subscriptions WHERE creator=$1 AND is_deleted=false AND category_id=$2)`,util.UserID(ctx),id.Hex()).Scan(&referenced);if err!=nil{return err};if referenced{return ErrReferenced};res,err:=tx.ExecContext(ctx,`UPDATE categories SET is_deleted=true,last_update=now() WHERE id=$1 AND owner=$2 AND is_deleted=false`,id.Hex(),util.UserID(ctx));if err!=nil{return err};n,_:=res.RowsAffected();if n!=1{return sql.ErrNoRows};if err:=tx.Commit();err!=nil{return err};socket.BroadcastFromContext(ctx,map[string]interface{}{"collection":"categories","action":"delete"});return nil}
