package controller

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"fintrack/server/model"
	"fintrack/server/service"
	"fintrack/server/util"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

//////////////////
// Saving
//////////////////

func AddSaving(c *gin.Context) {
    tmp, _ := c.Get("saving")
    saving := tmp.(model.Saving)

    ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
    defer cancel()

    result, err := service.AddSaving(ctx, saving)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{
            "error": "Error adding saving",
            "detail": err.Error(),
        })
        return
    }

    c.JSON(http.StatusOK, gin.H{
        "message": "Saving added successfully",
        "id": result,
    })
}

func GetSavingsSince(c *gin.Context) {
    sinceStr := c.Param("time")
    sinceTime, err := time.Parse(time.RFC3339, sinceStr)
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid time format"})
        return
    }

    ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
    defer cancel()

    cursor, err := service.FetchSavingsSince(ctx, c.GetString("username"), sinceTime)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Error fetching savings"})
        return
    }
    defer cursor.Close(ctx)

    c.Header("Content-Type", "application/json")
    c.Status(http.StatusOK)

    c.Stream(func(w io.Writer) bool {
        if cursor.Next(ctx) {
            var saving model.Saving
            if err := cursor.Decode(&saving); err != nil {
                fmt.Println("Error decoding saving:", err)
                return false
            }
            json.NewEncoder(w).Encode(saving)
            return true
        }
        return false
    })
}

func UpdateSaving(c *gin.Context) {
    tmp, _ := c.Get("saving")
    saving := tmp.(model.Saving)
    id, err := primitive.ObjectIDFromHex(c.Param("id"))
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid saving ID"})
        return
    }

    ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
    defer cancel()

    err = service.UpdateSaving(ctx, id, saving)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{
            "error": "Error updating saving",
            "detail": err.Error(),
        })
        return
    }

    c.JSON(http.StatusOK, gin.H{"message": "Saving updated successfully"})
}

func DeleteSaving(c *gin.Context) {
	id, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid saving ID"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

    err = service.DeleteSaving(ctx, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
            "error": "Error soft deleting related transactions",
            "detail": err.Error(),
        })
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Saving and related transactions soft deleted successfully"})
}

