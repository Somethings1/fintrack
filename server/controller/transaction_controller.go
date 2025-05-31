package controller

import (
    "io"
    "fmt"
    "time"
    "net/http"
    "encoding/json"

    "fintrack/server/model"
    "fintrack/server/service"

    "github.com/gin-gonic/gin"
    "go.mongodb.org/mongo-driver/bson/primitive"
)

//////////////////
// Transaction Handlers
//////////////////

func GetTransactionsSince(c *gin.Context) {
    sinceStr := c.Param("time")
    sinceTime, err := time.Parse(time.RFC3339, sinceStr)
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid time format"})
        return
    }

    ctx := c.Request.Context()

    cursor, err := service.FetchTransactionsSince(ctx, c.GetString("username"), sinceTime)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{
            "error": "Error fetching transactions",
            "detail": err.Error(),
        })
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

func AddTransaction(c *gin.Context) {
    tx, _ := c.Get("transaction")
    transaction := tx.(model.Transaction)

    result, err := service.AddTransaction(c.Request.Context(), transaction)

    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{
            "error": "Transaction failed",
            "detail": err.Error(),
        })
        return
    }

    c.JSON(http.StatusOK, gin.H{
        "message": "Transaction added successfully",
        "id": result,
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

    err = service.UpdateTransaction(c.Request.Context(), id, newTx)

    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{
            "error": "Error updating transaction with balance adjustment",
            "detail": err.Error(),
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

    err = service.DeleteTransaction(c.Request.Context(), id)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{
            "error": "Error deleting transaction",
            "details": err.Error(),
        })
        return
    }

    c.JSON(http.StatusOK, gin.H{"message": "Transaction deleted successfully"})
}

