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
// Category
//////////////////

func AddCategory(c *gin.Context) {
    tmp, _ := c.Get("category")
    category := tmp.(model.Category)

    // Set the last_update field to the current time
    category.LastUpdate = time.Now()

    ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
    defer cancel()

    result, err := util.CategoryCollection.InsertOne(ctx, category)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Error adding category"})
        return
    }

    c.JSON(http.StatusOK, gin.H{
        "message": "Category added successfully",
        "id": result.InsertedID,
    })
}

func GetCategories(c *gin.Context) {
    filter := bson.M{"owner": c.GetString("username")}

    ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
    defer cancel()

    cursor, err := util.CategoryCollection.Find(ctx, filter)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Error fetching categories"})
        return
    }
    defer cursor.Close(ctx)

    c.Header("Content-Type", "application/json")
    c.Status(http.StatusOK)

    c.Stream(func(w io.Writer) bool {
        if cursor.Next(ctx) {
            var category model.Category
            if err := cursor.Decode(&category); err != nil {
                fmt.Println("Error decoding category:", err)
                return false
            }
            json.NewEncoder(w).Encode(category)
            return true
        }
        return false
    })
}

func GetCategoriesSince(c *gin.Context) {
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

    cursor, err := util.CategoryCollection.Find(ctx, filter, opts)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Error fetching categories"})
        return
    }
    defer cursor.Close(ctx)

    c.Header("Content-Type", "application/json")
    c.Status(http.StatusOK)

    c.Stream(func(w io.Writer) bool {
        if cursor.Next(ctx) {
            var category model.Category
            if err := cursor.Decode(&category); err != nil {
                fmt.Println("Error decoding category:", err)
                return false
            }
            json.NewEncoder(w).Encode(category)
            return true
        }
        return false
    })
}

func UpdateCategory(c *gin.Context) {
    tmp, _ := c.Get("category")
    category := tmp.(model.Category)
    id, err := primitive.ObjectIDFromHex(c.Param("id"))
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid category ID"})
        return
    }

    // Set the last_update field to the current time
    category.LastUpdate = time.Now()

    filter := bson.M{"_id": id}

    ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
    defer cancel()

    _, err = util.CategoryCollection.UpdateOne(ctx, filter, bson.M{"$set": category})
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Error updating category"})
        return
    }

    c.JSON(http.StatusOK, gin.H{"message": "Category updated successfully"})
}

func DeleteCategory(c *gin.Context) {
    id, err := primitive.ObjectIDFromHex(c.Param("id"))
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid category ID"})
        return
    }

    ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
    defer cancel()

    // Set the last_update field to the current time on soft delete
    update := bson.M{"$set": bson.M{"is_deleted": true, "last_update": time.Now()}}

    _, err = util.CategoryCollection.UpdateOne(ctx, bson.M{"_id": id}, update)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Error performing soft delete"})
        return
    }

    c.JSON(http.StatusOK, gin.H{"message": "Category soft deleted successfully"})
}

