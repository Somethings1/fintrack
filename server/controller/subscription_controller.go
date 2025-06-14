package controller

import (
	"fmt"
	"io"
	"net/http"
	"time"
    "encoding/json"

	"fintrack/server/model"
	"fintrack/server/service"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

//////////////////
// Subscription Handlers
//////////////////

func GetSubscriptionsSince(c *gin.Context) {
	sinceStr := c.Param("time")
	username := c.GetString("username")

	sinceTime, err := time.Parse(time.RFC3339, sinceStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid time format"})
		return
	}

    ctx := c.Request.Context()

	cursor, err := service.FetchSubscriptionsSince(ctx, username, sinceTime)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":  "Error fetching subscriptions",
			"detail": err.Error(),
		})
		return
	}
	defer cursor.Close(ctx)

	c.Header("Content-Type", "application/json")
	c.Status(http.StatusOK)

	c.Stream(func(w io.Writer) bool {
		if cursor.Next(ctx) {
			var subscription model.Subscription
			if err := cursor.Decode(&subscription); err != nil {
				fmt.Println("Error decoding subscription:", err)
				return false
			}
			json.NewEncoder(w).Encode(subscription)
			return true
		}
		return false
	})
}

func AddSubscription(c *gin.Context) {
	tx, _ := c.Get("subscription")
	subscription := tx.(model.Subscription)

	result, err := service.AddSubscription(c.Request.Context(), subscription)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":  "Error adding new subscription",
			"detail": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Subscription added successfully",
		"id":      result,
	})
}

func UpdateSubscription(c *gin.Context) {
	id, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid subscription ID"})
		return
	}

	tx, _ := c.Get("subscription")
	newTx := tx.(model.Subscription)

	err = service.UpdateSubscription(c.Request.Context(), id, newTx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":  "Error updating subscription",
			"detail": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Subscription updated successfully"})
}

func DeleteSubscription(c *gin.Context) {
	id, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid subscription ID"})
		return
	}

	err = service.DeleteSubscription(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":  "Error deleting subscription",
			"detail": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Subscription deleted successfully"})
}
