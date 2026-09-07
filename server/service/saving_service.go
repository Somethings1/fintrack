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

const savingCols = `id,owner,currency,opening_balance_micros,balance_micros,icon,name,goal_micros,created_date,goal_date,last_update,is_deleted`
func nullTime(t time.Time) any { if t.IsZero(){return nil}; return t }
func nullString(s string) any { if s==""{return nil}; return s }

func GetSavingByID(ctx context.Context,id string)(model.Saving,error){if _,err:=primitive.ObjectIDFromHex(id);err!=nil{return model.Saving{},err};return scanSaving(util.DB.QueryRowContext(ctx,`SELECT `+savingCols+` FROM financial_accounts WHERE id=$1 AND owner=$2 AND kind='saving' AND is_deleted=false`,id,util.UserID(ctx)))}
func AddSaving(ctx context.Context,v model.Saving)(interface{},error){
	v.Owner=util.UserID(ctx);if v.Owner==""{return nil,errors.New("missing authenticated owner")};currency,err:=money.Resolve(ctx,v.Currency);if err!=nil{return nil,err};v.Currency=currency
	if err:=money.Validate(v.Balance,currency);err!=nil{return nil,err};if err:=money.Validate(v.Goal,currency);err!=nil{return nil,err};if v.Goal<0{return nil,errors.New("negative goal")}
	v.ID=primitive.NewObjectID();v.OpeningBalance=v.Balance;v.LastUpdate=time.Now().UTC();_,err=util.DB.ExecContext(ctx,`INSERT INTO financial_accounts(id,owner,kind,currency,opening_balance_micros,balance_micros,icon,name,goal_micros,created_date,goal_date,last_update,is_deleted) VALUES($1,$2,'saving',$3,$4,$5,$6,$7,$8,$9,$10,$11,false)`,v.ID.Hex(),v.Owner,v.Currency,int64(v.OpeningBalance),int64(v.Balance),v.Icon,v.Name,int64(v.Goal),nullTime(v.CreatedDate),nullTime(v.GoalDate),v.LastUpdate);if err!=nil{return nil,err};socket.BroadcastFromContext(ctx,map[string]interface{}{"collection":"savings","action":"create","detail":v});return v.ID,nil
}
func UpdateSaving(ctx context.Context,id primitive.ObjectID,v model.Saving)error{if _,err:=money.Resolve(ctx,v.Currency);err!=nil{return err};if err:=money.Validate(v.Goal,money.Currency(ctx));err!=nil{return err};res,err:=util.DB.ExecContext(ctx,`UPDATE financial_accounts SET name=$1,icon=$2,goal_micros=$3,goal_date=$4,last_update=now() WHERE id=$5 AND owner=$6 AND kind='saving' AND is_deleted=false`,v.Name,v.Icon,int64(v.Goal),nullTime(v.GoalDate),id.Hex(),util.UserID(ctx));if err!=nil{return err};n,_:=res.RowsAffected();if n!=1{return sql.ErrNoRows};socket.BroadcastFromContext(ctx,map[string]interface{}{"collection":"savings","action":"update"});return nil}
func DeleteSaving(ctx context.Context,id primitive.ObjectID)error{return archiveFinancialAccount(ctx,"saving","savings",id)}
func SyncSavings(ctx context.Context,user string,since,after time.Time,afterID primitive.ObjectID,limit int)([]model.Saving,bool,error){after,id:=afterArgs(after,afterID);rows,err:=util.DB.QueryContext(ctx,`SELECT `+savingCols+` FROM financial_accounts WHERE owner=$1 AND kind='saving' AND last_update >= $2 AND ($3::timestamptz IS NULL OR (last_update,id)>($3,$4)) ORDER BY last_update,id LIMIT $5`,user,since,nullTime(after),nullString(id),limit+1);if err!=nil{return nil,false,err};defer rows.Close();out:=make([]model.Saving,0,limit+1);for rows.Next(){v,e:=scanSaving(rows);if e!=nil{return nil,false,e};out=append(out,v)};if err:=rows.Err();err!=nil{return nil,false,err};more:=len(out)>limit;if more{out=out[:limit]};return out,more,nil}
