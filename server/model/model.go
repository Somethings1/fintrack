package model

import (
    "go.mongodb.org/mongo-driver/bson/primitive"
    "time"
    "errors"
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
    ID                primitive.ObjectID `bson:"_id,omitempty" json:"_id"`
    Creator           string             `bson:"creator" json:"creator"`
    Amount            float64            `bson:"amount" json:"amount"`
    DateTime          time.Time          `bson:"date_time" json:"dateTime"`
    Type              string             `bson:"type" json:"type"` // income, expense, transfer
    SourceAccount     primitive.ObjectID `bson:"source_account,omitempty" json:"sourceAccount,omitempty"`
    DestinationAccount primitive.ObjectID `bson:"destination_account,omitempty" json:"destinationAccount,omitempty"`
    Category          primitive.ObjectID `bson:"category,omitempty" json:"category,omitempty"`
    Note              string             `bson:"note" json:"note"`
    LastUpdate        time.Time          `bson:"last_update" json:"lastUpdate"`
}

type Account struct {
    ID                primitive.ObjectID `bson:"_id,omitempty" json:"_id"`
    Owner             string             `bson:"owner" json:"owner"`
    Balance           float64            `bson:"balance" json:"balance"`
    Icon              string             `bson:"icon" json:"icon"`
    Name              string             `bson:"name" json:"name"`
    LastUpdate        time.Time          `bson:"last_update" json:"lastUpdate"`
}

type Saving struct {
    ID                primitive.ObjectID `bson:"_id,omitempty" json:"_id"`
    Owner             string             `bson:"owner" json:"owner"`
    Balance           float64            `bson:"balance" json:"balance"`
    Icon              string             `bson:"icon" json:"icon"`
    Name              string             `bson:"name" json:"name"`
    Goal              float64            `bson:"goal,omitempty" json:"goal,omitempty"`
    CreatedDate       time.Time          `bson:"created_date" json:"createdDate"`
    GoalDate          time.Time          `bson:"goal_date" json:"goalDate"`
    LastUpdate        time.Time          `bson:"last_update" json: "lastUpdate"`
}

type Category struct {
    ID                primitive.ObjectID `bson:"_id,omitempty" json:"_id"`
    Owner             string             `bson:"owner" json:"owner"`
    Type              string             `bson:"type" json:"type"`
    Icon              string             `bson:"icon" json:"icon"`
    Name              string             `bson:"name" json:"name"`
    Budget            float64            `bson:"budget,omitempty" json:"budget,omitempty"`
    LastUpdate        time.Time          `bson:"last_update" json:"lastUpdate"`
}

func (category Category) FormatCheck() error {
    if category.Type != "income" && category.Type != "expense" {
        return errors.New("Invalid category type")
    }

    if category.Name == "" {
        return errors.New("Name cannot be empty")
    }

    return nil
}
