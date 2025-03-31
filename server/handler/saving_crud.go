package handler

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
// Saving
//////////////////

func AddSaving(c *gin.Context) {
    tmp, _ := c.Get("saving")
    saving := tmp.(model.Saving)

    ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
    defer cancel()

    result, err := util.SavingCollection.InsertOne(ctx, saving)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Error adding saving"})
        return
    }

    c.JSON(http.StatusOK, gin.H{
        "message": "Saving added successfully",
        "id": result.InsertedID,
    })
}

func GetSavings(c *gin.Context) {
    filter := bson.M{"owner": c.GetString("username")}

    ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
    defer cancel()

    cursor, err := util.SavingCollection.Find(ctx, filter)
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

func GetSavingsSince(c *gin.Context) {
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
        "owner": c.GetString("username"),
    }

    ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
    defer cancel()

    opts := options.Find().SetSort(bson.D{
        {Key: "last_update", Value: -1},
    })

    cursor, err := util.SavingCollection.Find(ctx, filter, opts)
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
    filter := bson.M{"_id": id}
    fmt.Println(saving.Name)

    ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
    defer cancel()

    _, err = util.SavingCollection.UpdateOne(ctx, filter, bson.M{"$set": saving})
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Error updating saving"})
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

    update := bson.M{"$set": bson.M{"is_deleted": true, "last_update": time.Now()}}

    _, err = util.SavingCollection.UpdateOne(ctx, bson.M{"_id": id}, update)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Error performing soft delete"})
        return
    }

    c.JSON(http.StatusOK, gin.H{"message": "Saving soft deleted successfully"})
}

