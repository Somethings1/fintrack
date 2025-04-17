package model

import (
    "go.mongodb.org/mongo-driver/bson/primitive"
    "time"
)

type User struct {
	ID       primitive.ObjectID `bson:"_id,omitempty" json:"_id"`
	Username string             `bson:"username" json:"username"`
	Name     string             `bson:"name" json:"name"`
	Password string             `bson:"password" json:"password"`
	Token    string             `bson:"token" json:"token"`
}

func (user User) ToString() string {
	return "Username: " + user.Username + ", Name: " + user.Name
}

type Transaction struct {
    ID                 primitive.ObjectID `bson:"_id,omitempty" json:"_id,omitempty"`
    Creator            string             `bson:"creator" json:"creator"`
    Amount             float64            `bson:"amount" json:"amount"`
    DateTime           time.Time          `bson:"date_time" json:"dateTime"`
    Type               string             `bson:"type" json:"type"`
    SourceAccount      primitive.ObjectID `bson:"source_account,omitempty" json:"sourceAccount,omitempty"`
    DestinationAccount primitive.ObjectID `bson:"destination_account,omitempty" json:"destinationAccount,omitempty"`
    Category           primitive.ObjectID `bson:"category,omitempty" json:"category,omitempty"`
    Note               string             `bson:"note" json:"note"`
    LastUpdate         time.Time          `bson:"last_update" json:"lastUpdate,omitempty"`
    IsDeleted          bool               `bson:"is_deleted" json:"isDeleted"`
}

type Account struct {
    ID         primitive.ObjectID `bson:"_id,omitempty" json:"_id,omitempty"`
    Owner      string             `bson:"owner" json:"owner"`
    Balance    float64            `bson:"balance" json:"balance"`
    Icon       string             `bson:"icon" json:"icon"`
    Name       string             `bson:"name" json:"name"`
    LastUpdate time.Time          `bson:"last_update" json:"lastUpdate,omitempty"`
    IsDeleted  bool               `bson:"is_deleted" json:"isDeleted"`
}

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
