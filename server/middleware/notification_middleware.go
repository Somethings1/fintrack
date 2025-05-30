package middleware

import (
	"fintrack/server/model"
	"fintrack/server/service"
	"fmt"
	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"net/http"
	"time"
)

func NotificationOwnershipMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		username := c.GetString("username")
		notif, err := service.GetNotificationById(c.Param("id"))

		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Notification not found"})
			return
		}

		if string(notif.Owner) != username {
			c.JSON(http.StatusForbidden, gin.H{"error": "You are not the creator of this Notification"})
			return
		}

		c.Next()
	}
}

func NotificationFormat() gin.HandlerFunc {
	return func(c *gin.Context) {
		type Notification struct {
            Owner       string                      `json:"owner"`
            Type        model.NotificationType      `json:"type"`
            ReferenceId string                      `json:"referenceId"`
            Title       string                      `json:"title"`
            Message     string                      `json:"message"`
            ScheduledAt string                      `json:"scheduledAt"`
		}
		var _notification Notification

		// Overall format
		if err := c.ShouldBindJSON(&_notification); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

        if _notification.Type != model.TypeTransaction {
            c.JSON(http.StatusBadRequest, gin.H{
                "error": "New notification insertion via http can only be transactional",
            })
            return
        }

        referenceId, err := primitive.ObjectIDFromHex(_notification.ReferenceId)
        if err != nil {
            c.JSON(http.StatusBadRequest, gin.H{
                "error": "Invalid referenceId",
                "detail": err.Error(),
            })
            return
        }

        transaction, err := service.GetTransactionByID(_notification.ReferenceId)
        if err != nil {
            c.JSON(http.StatusBadRequest, gin.H{
                "error": "Transaction not found",
                "detail": err.Error(),
            })
            return
        }
        if transaction.Creator != _notification.Owner {
            c.JSON(http.StatusBadRequest, gin.H{
                "error": "Youare not the owner of the transaction",
            })
            return
        }

		// StartDate
		ScheduledAt, err := time.Parse(time.RFC3339, _notification.ScheduledAt)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "Invalid date format on `scheduledAt`",
			})
			return
		}

		notification := model.Notification{
            Owner:          _notification.Owner,
            Type:           _notification.Type,
            ReferenceId:    referenceId,
            Title:          _notification.Title,
            Message:        _notification.Message,
            Read:           false,
            Delivered:      false,
            ScheduledAt:    ScheduledAt,
            LastUpdate:     time.Now(),
            IsDeleted:      false,
		}

		c.Set("notification", notification)
		c.Next()

	}
}

