package service

import (
	"fintrack/server/model"
	"fintrack/server/money"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"testing"
	"time"
)

func TestMonetaryWriteValidation(t *testing.T) {
	tx := model.Transaction{Creator: "owner", Currency: "USD", Amount: money.Must("10"), DateTime: time.Now().UTC(), Type: "expense", SourceAccount: primitive.NewObjectID(), Category: primitive.NewObjectID()}
	if err := validateTransaction(tx); err != nil {
		t.Fatal(err)
	}
	first := transactionDigest(tx)
	tx.LastUpdate = time.Now()
	tx.ID = primitive.NewObjectID()
	tx.RequestKey = "test"
	if transactionDigest(tx) != first {
		t.Fatal("non-business fields changed request digest")
	}
	tx.Amount = money.Must("11")
	if transactionDigest(tx) == first {
		t.Fatal("changed amount retained digest")
	}
	tx.Amount = 0
	if validateTransaction(tx) == nil {
		t.Fatal("zero amount accepted")
	}
	tx.Amount = money.Must("10")
	tx.DestinationAccount = primitive.NewObjectID()
	if validateTransaction(tx) == nil {
		t.Fatal("expense with destination accepted")
	}
}
