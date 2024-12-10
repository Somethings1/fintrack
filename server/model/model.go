package model

import (
    "go.mongodb.org/mongo-driver/bson/primitive"
    "time"
    "errors"
)

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
    Category        *primitive.ObjectID `bson:"category,omitempty"`
    Note            string             `bson:"note"`
}

func (t Transaction) FormatCheck() error {
    if t.Type != "income" && t.Type != "expense" && t.Type != "transfer" {
        return errors.New("Invalid transaction type")
    }

    if t.Amount < 0 {
        return errors.New("Amount cannot be negative")
    }

    if t.SourceAccount == nil {
        return errors.New("Source account is required")
    }

    if t.Type == "income" || t.Type == "expense" {
        if (t.Category == nil) {
            return errors.New("Category is required for income or expense transactions")
        }
        if (t.DestinationAccount != nil) {
            return errors.New("Destination account is not required for income or expense transactions")
        }
    } else {
        if t.Category != nil {
            return errors.New("Category is not required for transfer transactions")
        }
        if (t.DestinationAccount == nil) {
            return errors.New("Destination account is required for transfer transactions")
        }
        if (t.SourceAccount == t.DestinationAccount) {
            return errors.New("Source and destination accounts cannot be the same")
        }
    }

    return nil
}

type Account struct {
    ID      primitive.ObjectID `bson:"_id,omitempty"`
    Owner   string             `bson:"owner"`
    Balance float64            `bson:"balance"`
    Icon    string             `bson:"icon"`
    Name    string             `bson:"name"`
    Goal    *float64           `bson:"goal,omitempty"`
}

func (account Account) FormatCheck() error {
    if account.Balance < 0 {
        return errors.New("Balance cannot be negative")
    }

    if account.Name == "" {
        return errors.New("Name cannot be empty")
    }

    return nil
}

type Category struct {
    ID      primitive.ObjectID `bson:"_id,omitempty"`
    Owner   string             `bson:"owner"`
    Type    string             `bson:"type"` // income or expense
    Icon    string             `bson:"icon"`
    Name    string             `bson:"name"`
    Budget  *float64           `bson:"budget,omitempty"`
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
