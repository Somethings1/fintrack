package model

import (
	"go.mongodb.org/mongo-driver/bson/primitive"
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
