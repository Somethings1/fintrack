package model

import (
	"fintrack/server/money"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"time"
)

type Transaction struct {
	SubscriptionID     primitive.ObjectID `bson:"subscription_id,omitempty" json:"-"`
	OccurrenceAt       time.Time          `bson:"occurrence_at,omitempty" json:"-"`
	Currency           string             `bson:"currency" json:"currency"`
	RequestKey         string             `bson:"request_key,omitempty" json:"-"`
	RequestHash        string             `bson:"request_hash,omitempty" json:"-"`
	ID                 primitive.ObjectID `bson:"_id,omitempty" json:"_id,omitempty"`
	Creator            string             `bson:"creator" json:"creator"`
	Amount             money.Amount       `bson:"amount" json:"amount"`
	DateTime           time.Time          `bson:"date_time" json:"dateTime"`
	Type               string             `bson:"type" json:"type"`
	SourceAccount      primitive.ObjectID `bson:"source_account,omitempty" json:"sourceAccount,omitempty"`
	DestinationAccount primitive.ObjectID `bson:"destination_account,omitempty" json:"destinationAccount,omitempty"`
	Category           primitive.ObjectID `bson:"category,omitempty" json:"category,omitempty"`
	Note               string             `bson:"note" json:"note"`
	LastUpdate         time.Time          `bson:"last_update" json:"lastUpdate,omitempty"`
	IsDeleted          bool               `bson:"is_deleted" json:"isDeleted"`
}
