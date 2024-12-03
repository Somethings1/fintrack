package service

import (
	"golang.org/x/crypto/bcrypt"
    "go.mongodb.org/mongo-driver/bson"
    "go.mongodb.org/mongo-driver/mongo"
    "fintrack/server/model"
    "fintrack/server/util"
    "errors"
    "context"
    "time"
)

func HashPassword(password string) (string, error) {
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	return string(hashedPassword), nil
}

func ValidatePassword(storedPassword, enteredPassword string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(storedPassword), []byte(enteredPassword))
	return err == nil
}

func VerifyUser (user model.User) error {
    ctx, close := context.WithTimeout(context.Background(), 10*time.Second)
    defer close()
    filter := bson.M{"username": user.Username}
    result := util.UserCollection.FindOne(ctx, filter)

    // Check if user exists
    if result.Err() != nil {
        if result.Err() == mongo.ErrNoDocuments {
            return errors.New("User not found")
        }
        return result.Err()
    }
    var dbUser model.User
    err := result.Decode(&dbUser)

    if err != nil {
        return err
    }

    if !ValidatePassword(dbUser.Password, user.Password) {
        return errors.New("Invalid password")
    }
    return nil
}
