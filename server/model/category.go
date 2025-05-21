package model

import (
	"go.mongodb.org/mongo-driver/bson/primitive"
	"time"
)

type Category struct {
	ID         primitive.ObjectID `bson:"_id,omitempty" json:"_id,omitempty"`
	Owner      string             `bson:"owner" json:"owner"`
	Type       string             `bson:"type" json:"type"`
	Icon       string             `bson:"icon" json:"icon"`
	Name       string             `bson:"name" json:"name"`
	Budget     float64            `bson:"budget,omitempty" json:"budget,omitempty"`
	LastUpdate time.Time          `bson:"last_update" json:"lastUpdate,omitempty"`
	IsDeleted  bool               `bson:"is_deleted" json:"isDeleted"`
}


