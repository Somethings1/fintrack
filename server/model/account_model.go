package model

import (
	"go.mongodb.org/mongo-driver/bson/primitive"
	"time"
)

type Account struct {
	ID         primitive.ObjectID `bson:"_id,omitempty" json:"_id,omitempty"`
	Owner      string             `bson:"owner" json:"owner"`
	Balance    float64            `bson:"balance" json:"balance"`
	Icon       string             `bson:"icon" json:"icon"`
	Name       string             `bson:"name" json:"name"`
	LastUpdate time.Time          `bson:"last_update" json:"lastUpdate,omitempty"`
	IsDeleted  bool               `bson:"is_deleted" json:"isDeleted"`
}

