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

func AddNotification(c *gin.Context) {
	var notif model.Notification
	tmp, _ := c.Get("notification")
	notif = tmp.(model.Notification)

	result, err := service.AddNotification(c.Request.Context(), notif)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":  "Failed to add notification",
			"detail": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Notification added successfully",
		"id":      result,
	})
}

func GetNotificationsSince(c *gin.Context) {
	sinceStr := c.Param("time")
	sinceTime, err := time.Parse(time.RFC3339, sinceStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid time format"})
		return
	}

	ctx := c.Request.Context()

	cursor, err := service.FetchNotificationSince(ctx, c.GetString("username"), sinceTime)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":  "Error fetching notifications",
			"detail": err.Error(),
		})
		return
	}
	defer cursor.Close(ctx)

	c.Header("Content-Type", "application/json")
	c.Status(http.StatusOK)

	c.Stream(func(w io.Writer) bool {
		if cursor.Next(ctx) {
			var notification model.Notification
			if err := cursor.Decode(&notification); err != nil {
				fmt.Println("Error decoding notification:", err)
				return false
			}
			json.NewEncoder(w).Encode(notification)
			return true
		}
		return false
	})
}

func MarkNotificationRead(c *gin.Context) {
	idStr := c.Param("id")
	notifID, err := primitive.ObjectIDFromHex(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid notification ID"})
		return
	}

	if err := service.MarkAsRead(c.Request.Context(), notifID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to mark notification as read"})
		return
	}

	c.Status(http.StatusNoContent)
}

func UpdateNotification(c *gin.Context) {
	tmp, _ := c.Get("notification")
	notification := tmp.(model.Notification)
	id, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid notification ID"})
		return
	}

	err = service.UpdateNotification(c.Request.Context(), id, notification)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":  "Error updating notification",
			"detail": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Notification updated successfully"})
}

func DeleteNotification(c *gin.Context) {
	id, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid notification ID"})
		return
	}

	err = service.DeleteNotification(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":  "Error deleting notification",
			"detail": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Notification deleted successfully"})
}
