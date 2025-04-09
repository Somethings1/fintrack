package handler

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
    "go.mongodb.org/mongo-driver/mongo/options"
    "go.mongodb.org/mongo-driver/bson/primitive"
)

//////////////////
// Transaction Handlers
//////////////////

// AddTransaction adds a new transaction and sets the LastUpdate timestamp
func AddTransaction(c *gin.Context) {
    tx, _ := c.Get("transaction")
    transaction := tx.(model.Transaction)

    // Set the LastUpdate field to the current time
    transaction.LastUpdate = time.Now()

    ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
    defer cancel()

    result, err := util.TransactionCollection.InsertOne(ctx, transaction)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Error adding transaction"})
        return
    }

    c.JSON(http.StatusOK, gin.H{
        "message": "Transaction added successfully",
        "id": result.InsertedID,
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

// UpdateTransaction updates an existing transaction and sets the LastUpdate timestamp
func UpdateTransaction(c *gin.Context) {
    tx, _ := c.Get("transaction")
    transaction := tx.(model.Transaction)

    id, err := primitive.ObjectIDFromHex(c.Param("id"))
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid transaction ID"})
        return
    }

    // Set the LastUpdate field to the current time
    transaction.LastUpdate = time.Now()

    filter := bson.M{"_id": id}

    ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
    defer cancel()

    _, err = util.TransactionCollection.UpdateOne(ctx, filter, bson.M{"$set": transaction})
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Error updating transaction"})
        return
    }

    c.JSON(http.StatusOK, gin.H{"message": "Transaction updated successfully"})
}

// DeleteTransaction performs a soft delete by marking the transaction as deleted and updating the LastUpdate field
func DeleteTransaction(c *gin.Context) {
    transactionID, err := primitive.ObjectIDFromHex(c.Param("id"))
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid transaction ID"})
        return
    }

    ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
    defer cancel()

    // Perform a soft delete by updating the "is_deleted" field and the "last_update" timestamp
    update := bson.M{"$set": bson.M{"is_deleted": true, "last_update": time.Now()}}

    _, err = util.TransactionCollection.UpdateOne(ctx, bson.M{"_id": transactionID}, update)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Error performing soft delete"})
        return
    }

    c.JSON(http.StatusOK, gin.H{"message": "Transaction soft deleted successfully"})
}

