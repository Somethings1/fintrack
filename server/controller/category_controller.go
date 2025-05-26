package controller

import (
	"context"
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

//////////////////
// Category
//////////////////

func GetCategoriesSince(c *gin.Context) {
    sinceStr := c.Param("time")
    sinceTime, err := time.Parse(time.RFC3339, sinceStr)
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid time format"})
        return
    }

    ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
    defer cancel()


    cursor, err := service.FetchCategoriesSince(ctx, c.GetString("username"), sinceTime)
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

func AddCategory(c *gin.Context) {
    tmp, _ := c.Get("category")
    category := tmp.(model.Category)

    ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
    defer cancel()

    result, err := service.AddCategory(ctx, category)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{
            "error": "Error adding category",
            "detail": err.Error(),
        })
        return
    }

    c.JSON(http.StatusOK, gin.H{
        "message": "Category added successfully",
        "id": result,
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

    ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
    defer cancel()

    err = service.UpdateCategory(ctx, id, category)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{
            "error": "Error updating category",
            "detail": err.Error(),
        })
        return
    }

    c.JSON(http.StatusOK, gin.H{"message": "Category updated successfully"})
}

// DeleteCategory performs a soft delete by marking the category and its related transactions as deleted
func DeleteCategory(c *gin.Context) {
	id, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid category ID"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

    err = service.DeleteCategory(ctx, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
            "error": "Cannot delete category",
            "detail": err.Error(),
        })
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Category and related transactions deleted successfully"})
}

