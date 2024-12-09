package model

import "go.mongodb.org/mongo-driver/bson/primitive"
import "time"

// User represents a user in the system
type User struct {
	ID       primitive.ObjectID `bson:"_id,omitempty"`
	Username string             `bson:"username"`
	Name     string             `bson:"name"`
	Password string             `bson:"password"`
	Token    string             `bson:"token"`
}

func (user User) ToString() string {
	return "Username: " + user.Username + ", Name: " + user.Name
}

type Transaction struct {
    ID              primitive.ObjectID `bson:"_id,omitempty"`
    Creator         string             `bson:"creator"`
    Amount          float64            `bson:"amount"`
    DateTime        time.Time          `bson:"date_time"`
    Type            string             `bson:"type"` // income, expense, transfer
    SourceAccount   *primitive.ObjectID `bson:"source_account,omitempty"`
    DestinationAccount *primitive.ObjectID `bson:"destination_account,omitempty"`
    Category        primitive.ObjectID `bson:"category"`
}

type Account struct {
    ID      primitive.ObjectID `bson:"_id,omitempty"`
    Owner   string             `bson:"owner"`
    Balance float64            `bson:"balance"`
    Icon    string             `bson:"icon"`
    Name    string             `bson:"name"`
    Goal    *float64           `bson:"goal,omitempty"`
}

type Category struct {
    ID      primitive.ObjectID `bson:"_id,omitempty"`
    Owner   string             `bson:"owner"`
    Type    string             `bson:"type"` // income or expense
    Icon    string             `bson:"icon"`
    Name    string             `bson:"name"`
    Budget  *float64           `bson:"budget,omitempty"`
}
