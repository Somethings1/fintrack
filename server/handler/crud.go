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
// Transaction
//////////////////

func AddTransaction(c *gin.Context) {
    tx, _ := c.Get("transaction")
    transaction := tx.(model.Transaction)

    ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
    defer cancel()

    result, err := util.TransactionCollection.InsertOne(ctx, transaction)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Error adding transaction"})
        return
    }

    c.JSON(http.StatusOK, gin.H{
        "message": "Transaction added successfully",
        "id": result.InsertedID,
    })
}

func GetTransactionsByYear(c *gin.Context) {
    year := c.Param("year")
    parsedYear, err := time.Parse("2006", year)
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid year format"})
        return
    }

    startOfYear := time.Date(parsedYear.Year(), time.January, 1, 0, 0, 0, 0, time.UTC)
    endOfYear := time.Date(parsedYear.Year()+1, time.January, 1, 0, 0, 0, 0, time.UTC)

    filter := bson.M{
        "date_time": bson.M{
            "$gte": startOfYear,
            "$lt":  endOfYear,
        },
        "creator": c.GetString("username"),
    }

    ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
    defer cancel()

    opts := options.Find().SetSort(bson.D{
        {Key: "date", Value: -1},
    })

    cursor, err := util.TransactionCollection.Find(ctx, filter, opts)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Error fetching transactions"})
        return
    }
    defer cursor.Close(ctx)

    c.Header("Content-Type", "application/json")
    c.Status(http.StatusOK)

    c.Stream(func(w io.Writer) bool {
        if cursor.Next(ctx) {
            var transaction model.Transaction
            if err := cursor.Decode(&transaction); err != nil {
                fmt.Println("Error decoding transaction:", err)
                return false
            }
            fmt.Println(transaction)
            json.NewEncoder(w).Encode(transaction)
            return true
        }
        return false
    })
}

func UpdateTransaction(c *gin.Context) {
    tx, _ := c.Get("transaction")
    transaction := tx.(model.Transaction)

    id, err := primitive.ObjectIDFromHex(c.Param("id"))
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid transaction ID"})
        return
    }

    filter := bson.M{"_id": id}

    ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
    defer cancel()

    _, err = util.TransactionCollection.UpdateOne(ctx, filter, bson.M{"$set": transaction})
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Error updating transaction"})
        return
    }

    c.JSON(http.StatusOK, gin.H{"message": "Transaction updated successfully"})
}

func DeleteTransaction(c *gin.Context) {
    transactionID, err := primitive.ObjectIDFromHex(c.Param("id"))
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid transaction ID"})
        return
    }

    ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
    defer cancel()

    _, err = util.TransactionCollection.DeleteOne(ctx, bson.M{"_id": transactionID})
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Error deleting transaction"})
        return
    }

    c.JSON(http.StatusOK, gin.H{"message": "Transaction deleted successfully"})
}

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

    ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
    defer cancel()

    _, err = util.AccountCollection.DeleteOne(ctx, bson.M{"_id": id})
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Error deleting account"})
        return
    }

    c.JSON(http.StatusOK, gin.H{"message": "Account deleted successfully"})
}

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

    _, err = util.SavingCollection.DeleteOne(ctx, bson.M{"_id": id})
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Error deleting saving"})
        return
    }

    c.JSON(http.StatusOK, gin.H{"message": "Saving deleted successfully"})
}


//////////////////
// Category
//////////////////

func AddCategory(c *gin.Context) {
    tmp, _ := c.Get("category")
    category := tmp.(model.Category)

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

func UpdateCategory(c *gin.Context) {
    tmp, _ := c.Get("category")
    category := tmp.(model.Category)

    id, err := primitive.ObjectIDFromHex(c.Param("id"))
    filter := bson.M{"_id": id}

    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid category ID"})
        return
    }

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

    _, err = util.CategoryCollection.DeleteOne(ctx, bson.M{"_id": id})
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Error deleting category"})
        return
    }

    c.JSON(http.StatusOK, gin.H{"message": "Category deleted successfully"})
}
