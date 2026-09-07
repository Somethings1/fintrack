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

const categoryCols = `id,owner,currency,type,icon,name,budget_micros,last_update,is_deleted`

func GetCategoryByID(ctx context.Context, id string) (model.Category, error) {
	if _, err := primitive.ObjectIDFromHex(id); err != nil { return model.Category{}, err }
	return scanCategory(util.DB.QueryRowContext(ctx, `SELECT `+categoryCols+` FROM categories WHERE id=$1 AND owner=$2 AND is_deleted=false`, id, util.UserID(ctx)))
}

func AddCategory(ctx context.Context, c model.Category) (interface{}, error) {
	c.Owner=util.UserID(ctx); if c.Owner==""{return nil,errors.New("missing authenticated owner")}; currency,err:=money.Resolve(ctx,c.Currency);if err!=nil{return nil,err};c.Currency=currency
	if c.Type!="income"&&c.Type!="expense"{return nil,errors.New("invalid category type")}; if err:=money.Validate(c.Budget,currency);err!=nil||c.Budget<0{if err!=nil{return nil,err};return nil,errors.New("negative budget")}
	c.ID=primitive.NewObjectID();c.LastUpdate=time.Now().UTC(); _,err=util.DB.ExecContext(ctx,`INSERT INTO categories(id,owner,currency,type,icon,name,budget_micros,last_update,is_deleted) VALUES($1,$2,$3,$4,$5,$6,$7,$8,false)`,c.ID.Hex(),c.Owner,c.Currency,c.Type,c.Icon,c.Name,int64(c.Budget),c.LastUpdate);if err!=nil{return nil,err}
	socket.BroadcastFromContext(ctx,map[string]interface{}{"collection":"categories","action":"create","detail":c});return c.ID,nil
}

func UpdateCategory(ctx context.Context,id primitive.ObjectID,c model.Category) error{
	if _,err:=money.Resolve(ctx,c.Currency);err!=nil{return err};if err:=money.Validate(c.Budget,money.Currency(ctx));err!=nil{return err}
	res,err:=util.DB.ExecContext(ctx,`UPDATE categories SET name=$1,icon=$2,budget_micros=$3,last_update=now() WHERE id=$4 AND owner=$5 AND is_deleted=false`,c.Name,c.Icon,int64(c.Budget),id.Hex(),util.UserID(ctx));if err!=nil{return err};n,_:=res.RowsAffected();if n!=1{return sql.ErrNoRows};socket.BroadcastFromContext(ctx,map[string]interface{}{"collection":"categories","action":"update"});return nil
}
func DeleteCategory(ctx context.Context,id primitive.ObjectID)error{return archiveCategory(ctx,id)}

func SyncCategories(ctx context.Context,user string,since,after time.Time,afterID primitive.ObjectID,limit int)([]model.Category,bool,error){
	after,id:=afterArgs(after,afterID);rows,err:=util.DB.QueryContext(ctx,`SELECT `+categoryCols+` FROM categories WHERE owner=$1 AND last_update >= $2 AND ($3::timestamptz IS NULL OR (last_update,id)>($3,$4)) ORDER BY last_update,id LIMIT $5`,user,since,nullTime(after),nullString(id),limit+1);if err!=nil{return nil,false,err};defer rows.Close();out:=make([]model.Category,0,limit+1);for rows.Next(){v,e:=scanCategory(rows);if e!=nil{return nil,false,e};out=append(out,v)};if err:=rows.Err();err!=nil{return nil,false,err};more:=len(out)>limit;if more{out=out[:limit]};return out,more,nil
}
