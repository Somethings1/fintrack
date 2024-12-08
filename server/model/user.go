package model

import "go.mongodb.org/mongo-driver/bson/primitive"

// User represents a user in the system
type User struct {
	ID             primitive.ObjectID `bson:"_id,omitempty"`
	Username       string             `bson:"username"`
	Name           string             `bson:"name"`
	Password       string             `bson:"password"`
	Token          string             `bson:"token"`
}

func (user User) ToString() string {
    return "Username: " + user.Username + ", Name: " + user.Name
}
