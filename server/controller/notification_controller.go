package controller

import (
	"errors"
	"fintrack/server/model"
	"fintrack/server/service"
	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"time"
)

func AddNotification(c *gin.Context) {
	v, _ := c.Get("notification")
	id, err := service.AddNotification(c.Request.Context(), v.(model.Notification))
	if err != nil {
		c.JSON(500, gin.H{"error": "Failed to add notification"})
		return
	}
	c.JSON(200, gin.H{"message": "Notification added successfully", "id": id})
}
func GetNotificationsSince(c *gin.Context) {
	streamSince(c, service.SyncNotifications, func(v model.Notification) (time.Time, primitive.ObjectID) { return v.LastUpdate, v.ID })
}
func MarkNotificationsRead(c *gin.Context) {
	var body struct {
		IDs []string `json:"ids"`
	}
	if err := c.ShouldBindJSON(&body); err != nil || len(body.IDs) == 0 || len(body.IDs) > 100 {
		c.JSON(400, gin.H{"error": "provide 1 to 100 notification IDs"})
		return
	}
	ids := make([]primitive.ObjectID, 0, len(body.IDs))
	for _, raw := range body.IDs {
		id, err := primitive.ObjectIDFromHex(raw)
		if err != nil {
			c.JSON(400, gin.H{"error": "Invalid notification ID"})
			return
		}
		ids = append(ids, id)
	}
	if err := service.MarkAsRead(c.Request.Context(), ids); err != nil {
		c.JSON(500, gin.H{"error": "Failed to mark notifications as read"})
		return
	}
	c.Status(204)
}
func UpdateNotification(c *gin.Context) {
	v, _ := c.Get("notification")
	id, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(400, gin.H{"error": "Invalid notification ID"})
		return
	}
	if err := service.UpdateNotification(c.Request.Context(), id, v.(model.Notification)); err != nil {
		if errors.Is(err, service.ErrReferenced) {
			c.JSON(409, gin.H{"error": err.Error()})
			return
		}
		c.JSON(500, gin.H{"error": "Error updating notification"})
		return
	}
	c.JSON(200, gin.H{"message": "Notification updated successfully"})
}
func DeleteNotification(c *gin.Context) {
	id, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(400, gin.H{"error": "Invalid notification ID"})
		return
	}
	if err := service.DeleteNotification(c.Request.Context(), id); err != nil {
		c.JSON(500, gin.H{"error": "Error deleting notification"})
		return
	}
	c.JSON(200, gin.H{"message": "Notification deleted successfully"})
}
