package model

import (
	"go.mongodb.org/mongo-driver/bson/primitive"
	"time"
)

type Subscription struct {
	ID                 primitive.ObjectID `bson:"_id,omitempty" json:"_id,omitempty"`
	Creator            string             `bson:"creator" json:"creator"`
	Amount             float64            `bson:"amount" json:"amount"`
    SourceAccount      primitive.ObjectID `bson:"source_account,omitempty" json:"sourceAccount,omitempty"`
    Category           primitive.ObjectID `bson:"category,omitempty" json:"category,omitempty"`

	StartDate          time.Time          `bson:"start_date" json:"startDate"`
    Interval           string             `bson:"interval" json:"interval"` // day, week, month, year
    MaxInterval        int                `bson:"max_interval,omitempty" json:"maxInterval,omitempty"` // number of interval to repeat
    CurrentInterval    int                `bson:"current_interval" json:"currentInterval"`

	LastUpdate         time.Time          `bson:"last_update" json:"lastUpdate,omitempty"`
	IsDeleted          bool               `bson:"is_deleted" json:"isDeleted"`
}

