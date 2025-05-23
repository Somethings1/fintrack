package model

import (
	"go.mongodb.org/mongo-driver/bson/primitive"
	"time"
)

type Saving struct {
	ID          primitive.ObjectID `bson:"_id,omitempty" json:"_id,omitempty"`
	Owner       string             `bson:"owner" json:"owner"`
	Balance     float64            `bson:"balance" json:"balance"`
	Icon        string             `bson:"icon" json:"icon"`
	Name        string             `bson:"name" json:"name"`
	Goal        float64            `bson:"goal,omitempty" json:"goal,omitempty"`
	CreatedDate time.Time          `bson:"created_date" json:"createdDate"`
	GoalDate    time.Time          `bson:"goal_date" json:"goalDate"`
	LastUpdate  time.Time          `bson:"last_update" json:"lastUpdate,omitempty"`
	IsDeleted   bool               `bson:"is_deleted" json:"isDeleted"`
}
