package controller

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"fintrack/server/model"
	"fintrack/server/service"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

//////////////////
// Account Handlers
//////////////////

func AddAccount(c *gin.Context) {
    tmp, _ := c.Get("account")
    account := tmp.(model.Account)

    result, err := service.AddAccount(c.Request.Context(), account)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{
            "error": "Error adding account",
            "detail": err.Error(),
        })
        return
    }

    c.JSON(http.StatusOK, gin.H{
        "message": "Account added successfully",
        "id": result,
    })
}

func GetAccountsSince(c *gin.Context) {
    sinceStr := c.Param("time")
    sinceTime, err := time.Parse(time.RFC3339, sinceStr)
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid time format"})
        return
    }

    ctx := c.Request.Context()

    cursor, err := service.FetchAccountsSince(ctx, c.GetString("username"), sinceTime)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{
            "error": "Error fetching accounts",
            "detail": err.Error(),
        })
        return
    }
    defer cursor.Close(ctx)

    c.Header("Content-Type", "application/json")
    c.Status(http.StatusOK)

    c.Stream(func(w io.Writer) bool {
        if cursor.Next(ctx) {
            var account model.Account
            if err := cursor.Decode(&account); err != nil {
                fmt.Println("Error decoding account:", err)
                return false
            }
            json.NewEncoder(w).Encode(account)
            return true
        }
        return false
    })
}

func UpdateAccount(c *gin.Context) {
    tmp, _ := c.Get("account")
    account := tmp.(model.Account)
    id, err := primitive.ObjectIDFromHex(c.Param("id"))
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid account ID"})
        return
    }

    err = service.UpdateAccount(c.Request.Context(), id, account)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{
            "error": "Error updating account",
            "detail": err.Error(),
        })
        return
    }

    c.JSON(http.StatusOK, gin.H{"message": "Account updated successfully"})
}

func DeleteAccount(c *gin.Context) {
	id, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid account ID"})
		return
	}

    err = service.DeleteAccount(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
            "error": "Error deleting account",
            "detail": err.Error(),
        })
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Account and related transactions soft deleted successfully"})
}

