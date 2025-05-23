package controller

import (
    "io"
    "fmt"
    "time"
    "context"
    "net/http"
    "encoding/json"

    "fintrack/server/util"
    "fintrack/server/model"

    "github.com/gin-gonic/gin"
    "go.mongodb.org/mongo-driver/bson"
    "go.mongodb.org/mongo-driver/mongo/options"
    "go.mongodb.org/mongo-driver/bson/primitive"
)

//////////////////
// Subscription Handlers
//////////////////

func GetSubscriptionsSince(c *gin.Context) {
    sinceStr := c.Param("time")
    sinceTime, err := time.Parse(time.RFC3339, sinceStr)
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid time format"})
        return
    }

    filter := bson.M{
        "last_update": bson.M{
            "$gt": sinceTime,
        },
        "creator": c.GetString("username"),
    }

    ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
    defer cancel()

    opts := options.Find().SetSort(bson.D{
        {Key: "last_update", Value: -1},
    })

    cursor, err := util.SubscriptionCollection.Find(ctx, filter, opts)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Error fetching subscriptions"})
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
    subscription.LastUpdate = time.Now()

    ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
    defer cancel()

    result, err := util.SubscriptionCollection.InsertOne(ctx, subscription);

    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Error adding new subscription"})
        return
    }

    c.JSON(http.StatusOK, gin.H{
        "message": "Subscription added successfully",
        "id": result,
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
    newTx.LastUpdate = time.Now()
    filter := bson.M{"_id": id}

    ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
    defer cancel()

    _, err = util.SubscriptionCollection.UpdateOne(ctx, filter, bson.M{"$set": newTx})
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Error updating subscription"})
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

    subscriptionUpdate := bson.M{
        "$set": bson.M{
            "is_deleted": true,
            "last_update": time.Now(),
        },
    }

    filter := bson.M{
        "_id": id,
    }

    ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
    defer cancel()

    _, err = util.SubscriptionCollection.UpdateOne(ctx, filter, subscriptionUpdate)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Error deleting subscription", "details": err.Error()})
        return
    }

    c.JSON(http.StatusOK, gin.H{"message": "Subscription deleted successfully"})
}

