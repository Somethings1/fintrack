package util

import (
    "context"
    "log"
    "time"

    "go.mongodb.org/mongo-driver/bson"
    "go.mongodb.org/mongo-driver/mongo"
    "go.mongodb.org/mongo-driver/mongo/options"
    "go.mongodb.org/mongo-driver/bson/primitive"
)

var (
    MongoClient           *mongo.Client
    UserCollection        *mongo.Collection
    AccountCollection     *mongo.Collection
    TransactionCollection *mongo.Collection
    CategoryCollection    *mongo.Collection
    SavingCollection      *mongo.Collection
)

func InitDB() {
    clientOptions := options.Client().ApplyURI("mongodb://localhost:27017")
    client, err := mongo.Connect(context.Background(), clientOptions)
    if err != nil {
        log.Fatal(err)
    }
    MongoClient = client

    db := client.Database("finance_db")

    UserCollection = db.Collection("users")
    AccountCollection = db.Collection("accounts")
    TransactionCollection = db.Collection("transactions")
    CategoryCollection = db.Collection("categories")
    SavingCollection = db.Collection("savings")

    if err := createUserIndex(); err != nil {
        log.Fatal("Failed to create user index:", err)
    }
    if err := createTransactionIndex(); err != nil {
        log.Fatal("Failed to create transaction index:", err)
    }
    if err := createAccountIndex(); err != nil {
        log.Fatal("Failed to create account index:", err)
    }
    if err := createSavingIndex(); err != nil {
        log.Fatal("Failed to create saving index:", err)
    }
    if err := createCategoryIndex(); err != nil {
        log.Fatal("Failed to create category index:", err)
    }
}

func createUserIndex() error {
    ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
    defer cancel()

    indexModel := mongo.IndexModel{
        Keys:    bson.M{"username": 1}, // Ascending index on "username"
        Options: options.Index().SetUnique(true),
    }

    _, err := UserCollection.Indexes().CreateOne(ctx, indexModel)
    return err
}

func createTransactionIndex() error {
    ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
    defer cancel()

    indexModel := mongo.IndexModel{
        Keys: bson.M{"last_update": 1}, // Index on last_update for efficient syncing
    }

    _, err := TransactionCollection.Indexes().CreateOne(ctx, indexModel)
    return err
}

func createAccountIndex() error {
    ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
    defer cancel()

    indexModel := mongo.IndexModel{
        Keys: bson.M{"last_update": 1}, // Index on last_update for fast updates
    }

    _, err := AccountCollection.Indexes().CreateOne(ctx, indexModel)
    return err
}

func createSavingIndex() error {
    ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
    defer cancel()

    indexModel := mongo.IndexModel{
        Keys: bson.M{"last_update": 1}, // Index on last_update for better performance
    }

    _, err := SavingCollection.Indexes().CreateOne(ctx, indexModel)
    return err
}

func createCategoryIndex() error {
    ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
    defer cancel()

    indexModel := mongo.IndexModel{
        Keys: bson.M{"last_update": 1}, // Index on last_update for quick lookups
    }

    _, err := CategoryCollection.Indexes().CreateOne(ctx, indexModel)
    return err
}

func AdjustBalance(sc mongo.SessionContext, id primitive.ObjectID, amount float64) (int64, error) {
    now := time.Now()

    // Try to update in account collection
    res, err := AccountCollection.UpdateOne(
        sc,
        bson.M{"_id": id},
        bson.M{
            "$inc": bson.M{"balance": amount},
            "$set": bson.M{"last_update": now},
        },
    )
    if err != nil {
        return 0, err
    }

    if res.MatchedCount == 0 {
        // If not an account, try saving
        res, err = SavingCollection.UpdateOne(
            sc,
            bson.M{"_id": id},
            bson.M{
                "$inc": bson.M{"balance": amount},
                "$set": bson.M{"last_update": now},
            },
        )
        if err != nil {
            return 0, err
        }
    }

    return res.ModifiedCount, nil
}

