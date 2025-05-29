package model

import (
	"go.mongodb.org/mongo-driver/bson/primitive"
	"time"
)

type NotificationType string

const (
    TypeTransaction     NotificationType = "transaction"
    TypeOverBudget      NotificationType = "over_budget"
    TypeFinishIncome    NotificationType = "finish_income"
    TypeSubscription    NotificationType = "subscription"
)

type Notification struct {
	ID                 primitive.ObjectID `bson:"_id,omitempty" json:"_id,omitempty"`
	UserId             primitive.ObjectID `bson:"user_id" json:"userId"`
    Type               NotificationType   `bson:"type" json:"type"`
    ReferenceId        primitive.ObjectID `bson:"reference_id" json:"referenceId"`
	Title              string             `bson:"title" json:"title"`
	Message            string             `bson:"message" json:"message"`
    Read               bool               `bson:"read" json:"read"`
    DeliveredViaSocket bool               `bson:"delivered_via_socket"`
    ScheduledAt        time.Time          `bson:"scheduled_at" json:"scheduledAt"`
	LastUpdate         time.Time          `bson:"last_update" json:"lastUpdate,omitempty"`
	IsDeleted          bool               `bson:"is_deleted" json:"isDeleted"`
}

