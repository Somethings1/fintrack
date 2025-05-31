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

//////////////////
// Saving
//////////////////

func AddSaving(c *gin.Context) {
	tmp, _ := c.Get("saving")
	saving := tmp.(model.Saving)

	result, err := service.AddSaving(c.Request.Context(), saving)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":  "Error adding saving",
			"detail": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Saving added successfully",
		"id":      result,
	})
}

func GetSavingsSince(c *gin.Context) {
	sinceStr := c.Param("time")
	sinceTime, err := time.Parse(time.RFC3339, sinceStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid time format"})
		return
	}

	ctx := c.Request.Context()

	cursor, err := service.FetchSavingsSince(ctx, c.GetString("username"), sinceTime)
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

	err = service.UpdateSaving(c.Request.Context(), id, saving)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":  "Error updating saving",
			"detail": err.Error(),
		})
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

	err = service.DeleteSaving(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":  "Error soft deleting related transactions",
			"detail": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Saving and related transactions soft deleted successfully"})
}
