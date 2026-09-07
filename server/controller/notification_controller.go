package controller

import (
	"errors"
	"fintrack/server/util"
	"net/http"

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
		if errors.Is(err, service.ErrReferenced) || errors.Is(err, service.ErrIdempotencyConflict) {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to add notification",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Notification added successfully",
		"id":      result,
	})
}

func GetNotificationsSince(c *gin.Context) {
	streamSince[model.Notification](c, util.NotificationCollection, "owner")
}

func MarkNotificationsRead(c *gin.Context) {
	var body struct {
		IDs []string `json:"ids"`
	}

	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	if len(body.IDs) == 0 || len(body.IDs) > 100 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "provide 1 to 100 notification IDs"})
		return
	}
	var notifIDs []primitive.ObjectID
	for _, idStr := range body.IDs {
		id, err := primitive.ObjectIDFromHex(idStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid notification ID: " + idStr})
			return
		}
		notifIDs = append(notifIDs, id)
	}

	if err := service.MarkAsRead(c.Request.Context(), notifIDs); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to mark notifications as read"})
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
		if errors.Is(err, service.ErrReferenced) || errors.Is(err, service.ErrIdempotencyConflict) {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Error updating notification",
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
		if errors.Is(err, service.ErrReferenced) || errors.Is(err, service.ErrIdempotencyConflict) {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Error deleting notification",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Notification deleted successfully"})
}
