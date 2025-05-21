package controller

import (
    "io"
    "fmt"
    "time"
    "context"
    "net/http"
    "encoding/json"

    "fintrack/server/util"
    "fintrack/server/model"

    "github.com/gin-gonic/gin"
    "go.mongodb.org/mongo-driver/bson"
    "go.mongodb.org/mongo-driver/mongo"
    "go.mongodb.org/mongo-driver/mongo/options"
    "go.mongodb.org/mongo-driver/bson/primitive"
)

//////////////////
// Transaction Handlers
//////////////////

func AddTransaction(c *gin.Context) {
    tx, _ := c.Get("transaction")
    transaction := tx.(model.Transaction)
    transaction.LastUpdate = time.Now()

    ctx := context.Background()
    session, err := util.MongoClient.StartSession()
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to start session"})
        return
    }
    defer session.EndSession(ctx)

    result, err := session.WithTransaction(ctx, func(sc mongo.SessionContext) (interface{}, error) {
        // Insert transaction
        res, err := util.TransactionCollection.InsertOne(sc, transaction)
        if err != nil {
            return nil, err
        }

        // Adjust source balance
        if transaction.SourceAccount != primitive.NilObjectID {
            if _, err := util.AdjustBalance(sc, transaction.SourceAccount, -transaction.Amount); err != nil {
                return nil, err
            }
        }

        // Adjust destination balance
        if transaction.DestinationAccount != primitive.NilObjectID {
            if _, err := util.AdjustBalance(sc, transaction.DestinationAccount, transaction.Amount); err != nil {
                return nil, err
            }
        }

        return res.InsertedID, nil
    })

    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Transaction failed", "details": err.Error()})
        return
    }

    c.JSON(http.StatusOK, gin.H{
        "message": "Transaction added successfully",
        "id": result,
    })
}

// GetTransactionsByYear fetches all transactions for a given year
func GetTransactionsByYear(c *gin.Context) {
    year := c.Param("year")
    parsedYear, err := time.Parse("2006", year)
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid year format"})
        return
    }

    startOfYear := time.Date(parsedYear.Year(), time.January, 1, 0, 0, 0, 0, time.UTC)
    endOfYear := time.Date(parsedYear.Year()+1, time.January, 1, 0, 0, 0, 0, time.UTC)

    filter := bson.M{
        "date_time": bson.M{
            "$gte": startOfYear,
            "$lt":  endOfYear,
        },
        "creator": c.GetString("username"),
    }

    ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
    defer cancel()

    opts := options.Find().SetSort(bson.D{
        {Key: "date", Value: -1},
    })

    cursor, err := util.TransactionCollection.Find(ctx, filter, opts)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Error fetching transactions"})
        return
    }
    defer cursor.Close(ctx)

    c.Header("Content-Type", "application/json")
    c.Status(http.StatusOK)

    c.Stream(func(w io.Writer) bool {
        if cursor.Next(ctx) {
            var transaction model.Transaction
            if err := cursor.Decode(&transaction); err != nil {
                fmt.Println("Error decoding transaction:", err)
                return false
            }
            json.NewEncoder(w).Encode(transaction)
            return true
        }
        return false
    })
}

// GetTransactionsSince fetches all transactions updated after a specific timestamp
func GetTransactionsSince(c *gin.Context) {
    sinceStr := c.Param("time")
    sinceTime, err := time.Parse(time.RFC3339, sinceStr)
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid time format"})
        return
    }

    filter := bson.M{
        "last_update": bson.M{
            "$gt": sinceTime,
        },
        "creator": c.GetString("username"),
    }

    ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
    defer cancel()

    opts := options.Find().SetSort(bson.D{
        {Key: "last_update", Value: -1},
    })

    cursor, err := util.TransactionCollection.Find(ctx, filter, opts)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Error fetching transactions"})
        return
    }
    defer cursor.Close(ctx)

    c.Header("Content-Type", "application/json")
    c.Status(http.StatusOK)

    c.Stream(func(w io.Writer) bool {
        if cursor.Next(ctx) {
            var transaction model.Transaction
            if err := cursor.Decode(&transaction); err != nil {
                fmt.Println("Error decoding transaction:", err)
                return false
            }
            json.NewEncoder(w).Encode(transaction)
            return true
        }
        return false
    })
}

func UpdateTransaction(c *gin.Context) {
    id, err := primitive.ObjectIDFromHex(c.Param("id"))
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid transaction ID"})
        return
    }

    tx, _ := c.Get("transaction")
    newTx := tx.(model.Transaction)
    newTx.LastUpdate = time.Now()

    ctx := context.Background()
    err = util.MongoClient.UseSession(ctx, func(sc mongo.SessionContext) error {
        if err := sc.StartTransaction(); err != nil {
            return err
        }

        var oldTx model.Transaction
        err := util.TransactionCollection.FindOne(sc, bson.M{"_id": id}).Decode(&oldTx)
        if err != nil {
            _ = sc.AbortTransaction(sc)
            return err
        }

        // Reverse old transaction
        _, err = util.AdjustBalance(sc, oldTx.SourceAccount, oldTx.Amount)
        if err != nil {
            _ = sc.AbortTransaction(sc)
            return err
        }
        _, err = util.AdjustBalance(sc, oldTx.DestinationAccount, -oldTx.Amount)
        if err != nil {
            _ = sc.AbortTransaction(sc)
            return err
        }

        // Apply new transaction
        _, err = util.AdjustBalance(sc, newTx.SourceAccount, -newTx.Amount)
        if err != nil {
            _ = sc.AbortTransaction(sc)
            return err
        }
        _, err = util.AdjustBalance(sc, newTx.DestinationAccount, newTx.Amount)
        if err != nil {
            _ = sc.AbortTransaction(sc)
            return err
        }

        // Update transaction record
        _, err = util.TransactionCollection.UpdateOne(
            sc,
            bson.M{"_id": id},
            bson.M{"$set": newTx},
        )
        if err != nil {
            _ = sc.AbortTransaction(sc)
            return err
        }

        return sc.CommitTransaction(sc)
    })

    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{
            "error": "Error updating transaction with balance adjustment",
            "details": err.Error(),
        })
        return
    }

    c.JSON(http.StatusOK, gin.H{"message": "Transaction updated successfully"})
}

func DeleteTransaction(c *gin.Context) {
    id, err := primitive.ObjectIDFromHex(c.Param("id"))
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid transaction ID"})
        return
    }

    ctx := context.Background()
    err = util.MongoClient.UseSession(ctx, func(sc mongo.SessionContext) error {
        if err := sc.StartTransaction(); err != nil {
            return err
        }

        var tx model.Transaction
        err := util.TransactionCollection.FindOne(sc, bson.M{"_id": id}).Decode(&tx)
        if err != nil {
            _ = sc.AbortTransaction(sc)
            return err
        }

        // Reverse balance effect
        _, err = util.AdjustBalance(sc, tx.SourceAccount, tx.Amount)
        if err != nil {
            _ = sc.AbortTransaction(sc)
            return err
        }
        _, err = util.AdjustBalance(sc, tx.DestinationAccount, -tx.Amount)
        if err != nil {
            _ = sc.AbortTransaction(sc)
            return err
        }

        // Soft delete the transaction
        update := bson.M{
            "$set": bson.M{
                "is_deleted":  true,
                "last_update": time.Now(),
            },
        }
        _, err = util.TransactionCollection.UpdateOne(sc, bson.M{"_id": id}, update)
        if err != nil {
            _ = sc.AbortTransaction(sc)
            return err
        }

        return sc.CommitTransaction(sc)
    })

    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Error deleting transaction", "details": err.Error()})
        return
    }

    c.JSON(http.StatusOK, gin.H{"message": "Transaction deleted successfully"})
}

