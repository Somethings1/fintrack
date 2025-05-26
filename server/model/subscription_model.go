package model

import (
	"go.mongodb.org/mongo-driver/bson/primitive"
	"time"
)

type Subscription struct {
	ID                 primitive.ObjectID `bson:"_id,omitempty" json:"_id,omitempty"`
    Name               string             `bson:"name" json:"name"`
    Icon               string             `bson:"icon" json:"icon"`
	Creator            string             `bson:"creator" json:"creator"`
	Amount             float64            `bson:"amount" json:"amount"`
    SourceAccount      primitive.ObjectID `bson:"source_account,omitempty" json:"sourceAccount"`
    Category           primitive.ObjectID `bson:"category,omitempty" json:"category"`

	StartDate          time.Time          `bson:"start_date" json:"startDate"`
    Interval           string             `bson:"interval" json:"interval"` // day, week, month, year
    MaxInterval        int                `bson:"max_interval,omitempty" json:"maxInterval"` // number of interval to repeat
    CurrentInterval    int                `bson:"current_interval" json:"currentInterval,omitempty"`
    RemindBefore       int                `bson:"remind_before" json:"remindBefore"` // Number of day to remind user before activation day

    NextActive         time.Time          `bson:"next_active" json:"nextActive"`
	LastUpdate         time.Time          `bson:"last_update" json:"lastUpdate,omitempty"`
	IsDeleted          bool               `bson:"is_deleted" json:"isDeleted"`
}

