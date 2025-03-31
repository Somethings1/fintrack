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
// Account
//////////////////

func AddAccount(c *gin.Context) {
    tmp, _ := c.Get("account")
    account := tmp.(model.Account)

    ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
    defer cancel()

    result, err := util.AccountCollection.InsertOne(ctx, account)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Error adding account"})
        return
    }

    c.JSON(http.StatusOK, gin.H{
        "message": "Account added successfully",
        "id": result.InsertedID,
    })
}

func GetAccounts(c *gin.Context) {
    filter := bson.M{"owner": c.GetString("username")}

    ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
    defer cancel()

    cursor, err := util.AccountCollection.Find(ctx, filter)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Error fetching accounts"})
        return
    }
    defer cursor.Close(ctx)

    c.Header("Content-Type", "application/json")
    c.Status(http.StatusOK)

    c.Stream(func(w io.Writer) bool {
        if cursor.Next(ctx) {
            var account model.Account
            if err := cursor.Decode(&account); err != nil {
                fmt.Println("Error decoding account:", err)
                return false
            }
            json.NewEncoder(w).Encode(account)
            return true
        }
        return false
    })
}

func GetAccountsSince(c *gin.Context) {
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

    cursor, err := util.AccountCollection.Find(ctx, filter, opts)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Error fetching accounts"})
        return
    }
    defer cursor.Close(ctx)

    c.Header("Content-Type", "application/json")
    c.Status(http.StatusOK)

    c.Stream(func(w io.Writer) bool {
        if cursor.Next(ctx) {
            var account model.Account
            if err := cursor.Decode(&account); err != nil {
                fmt.Println("Error decoding account:", err)
                return false
            }
            json.NewEncoder(w).Encode(account)
            return true
        }
        return false
    })
}


func UpdateAccount(c *gin.Context) {
    tmp, _ := c.Get("account")
    account := tmp.(model.Account)
    id, err := primitive.ObjectIDFromHex(c.Param("id"))
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid account ID"})
        return
    }
    filter := bson.M{"_id": id}
    fmt.Println(account.Name)

    ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
    defer cancel()

    _, err = util.AccountCollection.UpdateOne(ctx, filter, bson.M{"$set": account})
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Error updating account"})
        return
    }

    c.JSON(http.StatusOK, gin.H{"message": "Account updated successfully"})
}

func DeleteAccount(c *gin.Context) {
    id, err := primitive.ObjectIDFromHex(c.Param("id"))
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid account ID"})
        return
    }

    ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
    defer cancel()

    update := bson.M{"$set": bson.M{"is_deleted": true, "last_update": time.Now()}}

    _, err = util.AccountCollection.UpdateOne(ctx, bson.M{"_id": id}, update)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Error performing soft delete"})
        return
    }

    c.JSON(http.StatusOK, gin.H{"message": "Account soft deleted successfully"})
}

