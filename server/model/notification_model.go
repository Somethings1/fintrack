package model

import (
	"go.mongodb.org/mongo-driver/bson/primitive"
	"time"
)

type Notification struct {
	ID                 primitive.ObjectID `bson:"_id,omitempty" json:"_id,omitempty"`
	UserId             primitive.ObjectID `bson:"user_id" json:"userId"`
    TransactionId      primitive.ObjectID `bson:"transaction_id" json:"transactionId,omitempty"`
    CategoryId         primitive.ObjectID `bson:"category_id" json:"categoryId,omitempty"`
    SubscriptionId     primitive.ObjectID `bson:"subscription_id" json:"subscriptionId,omitempty"`
	Title              string             `bson:"title" json:"title"`
	Message            string             `bson:"message" json:"message"`
    Read               bool               `bson:"read" json:"read"`
	LastUpdate         time.Time          `bson:"last_update" json:"lastUpdate,omitempty"`
	IsDeleted          bool               `bson:"is_deleted" json:"isDeleted"`
}

