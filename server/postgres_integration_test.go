//go:build integration

package main

import(
	"context"
	"fintrack/server/model"
	"fintrack/server/money"
	"fintrack/server/service"
	"fintrack/server/util"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"sync"
	"testing"
	"time"
)
func TestPostgresExactMoneyAndConcurrentOccurrence(t *testing.T){resetTestDatabase(t);defer util.CloseDB();ctx:=money.WithCurrency(context.WithValue(context.Background(),util.UserIdKey,"owner-a"),"USD");a,err:=service.AddAccount(ctx,model.Account{Name:"Wallet",Balance:money.Must("100")});if err!=nil{t.Fatal(err)};account:=a.(primitive.ObjectID);c,err:=service.AddCategory(ctx,model.Category{Name:"Food",Type:"expense"});if err!=nil{t.Fatal(err)};category:=c.(primitive.ObjectID);start:=time.Date(2026,1,31,12,0,0,0,time.UTC);s,err:=service.AddSubscription(ctx,model.Subscription{Name:"Monthly",Amount:money.Must("0.1"),SourceAccount:account,Category:category,StartDate:start,Interval:"month",MaxInterval:2});if err!=nil{t.Fatal(err)};id:=s.(primitive.ObjectID);var wg sync.WaitGroup;errs:=make(chan error,16);for i:=0;i<16;i++{wg.Add(1);go func(){defer wg.Done();_,err:=service.ProcessOccurrence(context.Background(),id,start,start,"USD");errs<-err}()};wg.Wait();close(errs);for err:=range errs{if err!=nil{t.Fatal(err)}};var count int;if err:=util.DB.QueryRow(`SELECT count(*) FROM transactions WHERE subscription_id=$1`,id.Hex()).Scan(&count);err!=nil{t.Fatal(err)};var balance int64;if err:=util.DB.QueryRow(`SELECT balance_micros FROM financial_accounts WHERE id=$1`,account.Hex()).Scan(&balance);err!=nil{t.Fatal(err)};if count!=1||money.Amount(balance)!=money.Must("99.9"){t.Fatalf("duplicate occurrence or inexact balance: count=%d balance=%d",count,balance)};var next time.Time;var current int;if err:=util.DB.QueryRow(`SELECT current_interval,next_active FROM subscriptions WHERE id=$1`,id.Hex()).Scan(&current,&next);err!=nil{t.Fatal(err)};if current!=1||next.Format("2006-01-02")!="2026-02-28"{t.Fatalf("wrong recurrence state current=%d next=%s",current,next)} }
