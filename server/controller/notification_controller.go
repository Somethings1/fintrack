package controller

import (
    "context"
    "encoding/json"
    "fmt"
    "io"
    "net/http"
    "time"

    "github.com/gin-gonic/gin"
    "go.mongodb.org/mongo-driver/bson/primitive"
    "fintrack/server/model"
    "fintrack/server/service"
)

func AddNotification(c *gin.Context) {
    var notif model.Notification
    tmp, _ := c.Get("notification")
    notif = tmp.(model.Notification)

    ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
    defer cancel()

    result, err := service.AddNotification(ctx, notif)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{
            "error": "Failed to add notification",
            "detail": err.Error(),
        })
        return
    }

    c.JSON(http.StatusOK, gin.H{
        "message": "Notification added successfully",
        "id": result,
    })
}

func GetNotificationsSince(c *gin.Context) {
    sinceStr := c.Param("time")
    sinceTime, err := time.Parse(time.RFC3339, sinceStr)
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid time format"})
        return
    }

    ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
    defer cancel()

    cursor, err := service.FetchNotificationSince(ctx, c.GetString("username"), sinceTime)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{
            "error": "Error fetching notifications",
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

    ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
    defer cancel()

    if err := service.MarkAsRead(ctx, notifID); err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to mark notification as read"})
        return
    }

    c.Status(http.StatusNoContent)
}

