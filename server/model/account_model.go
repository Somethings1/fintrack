package model

import (
	"fintrack/server/money"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"time"
)

type Account struct {
	OpeningBalance money.Amount       `bson:"opening_balance" json:"-"`
	Currency       string             `bson:"currency" json:"currency"`
	ID             primitive.ObjectID `bson:"_id,omitempty" json:"_id,omitempty"`
	Owner          string             `bson:"owner" json:"owner"`
	Balance        money.Amount       `bson:"balance" json:"balance"`
	Icon           string             `bson:"icon" json:"icon"`
	Name           string             `bson:"name" json:"name"`
	LastUpdate     time.Time          `bson:"last_update" json:"lastUpdate,omitempty"`
	IsDeleted      bool               `bson:"is_deleted" json:"isDeleted"`
}
