package controller

import (
	"errors"
	"fintrack/server/model"
	"fintrack/server/service"
	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"time"
)

func GetSubscriptionsSince(c *gin.Context) {
	streamSince(c, service.SyncSubscriptions, func(v model.Subscription) (time.Time, primitive.ObjectID) { return v.LastUpdate, v.ID })
}
func AddSubscription(c *gin.Context) {
	v, _ := c.Get("subscription")
	id, err := service.AddSubscription(c.Request.Context(), v.(model.Subscription))
	if err != nil {
		if errors.Is(err, service.ErrScheduleImmutable) {
			c.JSON(409, gin.H{"error": err.Error()})
			return
		}
		c.JSON(500, gin.H{"error": "Error adding new subscription"})
		return
	}
	c.JSON(200, gin.H{"message": "Subscription added successfully", "id": id})
}
func UpdateSubscription(c *gin.Context) {
	id, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(400, gin.H{"error": "Invalid subscription ID"})
		return
	}
	v, _ := c.Get("subscription")
	err = service.UpdateSubscription(c.Request.Context(), id, v.(model.Subscription))
	if err != nil {
		if errors.Is(err, service.ErrScheduleImmutable) {
			c.JSON(409, gin.H{"error": err.Error()})
			return
		}
		c.JSON(500, gin.H{"error": "Error updating subscription"})
		return
	}
	c.JSON(200, gin.H{"message": "Subscription updated successfully"})
}
func DeleteSubscription(c *gin.Context) {
	id, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(400, gin.H{"error": "Invalid subscription ID"})
		return
	}
	if err := service.DeleteSubscription(c.Request.Context(), id); err != nil {
		c.JSON(500, gin.H{"error": "Error deleting subscription"})
		return
	}
	c.JSON(200, gin.H{"message": "Subscription deleted successfully"})
}
