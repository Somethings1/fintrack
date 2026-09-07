package service

import(
	"context"
	"database/sql"
	"errors"
	"fintrack/server/model"
	"fintrack/server/socket"
	"fintrack/server/util"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"strings"
	"time"
)
const notificationCols=`id,owner,type,reference_id,title,message,read,scheduled_at,COALESCE(occurrence_key,''),last_update,is_deleted`
func GetNotificationById(ctx context.Context,id string)(model.Notification,error){if _,err:=primitive.ObjectIDFromHex(id);err!=nil{return model.Notification{},err};return scanNotification(util.DB.QueryRowContext(ctx,`SELECT `+notificationCols+` FROM notifications WHERE id=$1 AND owner=$2 AND is_deleted=false`,id,util.UserID(ctx)))}
func AddNotification(ctx context.Context,v model.Notification)(interface{},error){v.Owner=util.UserID(ctx);if v.Owner==""{return nil,errors.New("missing authenticated owner")};v.ID=primitive.NewObjectID();v.LastUpdate=time.Now().UTC();_,err:=util.DB.ExecContext(ctx,`INSERT INTO notifications(id,owner,type,reference_id,title,message,read,scheduled_at,occurrence_key,last_update,is_deleted) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,false)`,v.ID.Hex(),v.Owner,string(v.Type),v.ReferenceId.Hex(),v.Title,v.Message,v.Read,v.ScheduledAt,nullString(v.OccurrenceKey),v.LastUpdate);if err!=nil{return nil,err};socket.BroadcastFromContext(ctx,map[string]interface{}{"collection":"notifications","action":"create","detail":v});return v.ID,nil}
func MarkAsRead(ctx context.Context,ids []primitive.ObjectID)error{if len(ids)==0{return nil};args:=make([]any,0,len(ids)+1);args=append(args,util.UserID(ctx));marks:=make([]string,len(ids));for i,id:=range ids{args=append(args,id.Hex());marks[i]="$"+itoa(i+2)};_,err:=util.DB.ExecContext(ctx,`UPDATE notifications SET read=true,last_update=now() WHERE owner=$1 AND id IN (`+strings.Join(marks,",")+\`)`,args...);if err==nil{socket.BroadcastFromContext(ctx,map[string]interface{}{"collection":"notifications","action":"mark"})};return err}
func itoa(n int)string{const digits="0123456789";if n<10{return string(digits[n])};return string(digits[n/10])+string(digits[n%10])}
func UpdateNotification(ctx context.Context,id primitive.ObjectID,v model.Notification)error{res,err:=util.DB.ExecContext(ctx,`UPDATE notifications SET type=$1,reference_id=$2,title=$3,message=$4,read=$5,scheduled_at=$6,last_update=now() WHERE id=$7 AND owner=$8 AND is_deleted=false`,string(v.Type),v.ReferenceId.Hex(),v.Title,v.Message,v.Read,v.ScheduledAt,id.Hex(),util.UserID(ctx));if err!=nil{return err};n,_:=res.RowsAffected();if n!=1{return sql.ErrNoRows};socket.BroadcastFromContext(ctx,map[string]interface{}{"collection":"notifications","action":"update"});return nil}
func DeleteNotification(ctx context.Context,id primitive.ObjectID)error{res,err:=util.DB.ExecContext(ctx,`UPDATE notifications SET is_deleted=true,last_update=now() WHERE id=$1 AND owner=$2 AND is_deleted=false`,id.Hex(),util.UserID(ctx));if err!=nil{return err};n,_:=res.RowsAffected();if n!=1{return sql.ErrNoRows};socket.BroadcastFromContext(ctx,map[string]interface{}{"collection":"notifications","action":"delete"});return nil}
func SyncNotifications(ctx context.Context,user string,since,after time.Time,afterID primitive.ObjectID,limit int)([]model.Notification,bool,error){after,id:=afterArgs(after,afterID);rows,err:=util.DB.QueryContext(ctx,`SELECT `+notificationCols+` FROM notifications WHERE owner=$1 AND last_update >= $2 AND ($3::timestamptz IS NULL OR (last_update,id)>($3,$4)) ORDER BY last_update,id LIMIT $5`,user,since,nullTime(after),nullString(id),limit+1);if err!=nil{return nil,false,err};defer rows.Close();out:=make([]model.Notification,0,limit+1);for rows.Next(){v,e:=scanNotification(rows);if e!=nil{return nil,false,e};out=append(out,v)};if err:=rows.Err();err!=nil{return nil,false,err};more:=len(out)>limit;if more{out=out[:limit]};return out,more,nil}
