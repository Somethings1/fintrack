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

//////////////////
// Saving
//////////////////

func AddSaving(c *gin.Context) {
	tmp, _ := c.Get("saving")
	saving := tmp.(model.Saving)

	result, err := service.AddSaving(c.Request.Context(), saving)
	if err != nil {
		if errors.Is(err, service.ErrReferenced) || errors.Is(err, service.ErrIdempotencyConflict) {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Error adding saving",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Saving added successfully",
		"id":      result,
	})
}

func GetSavingsSince(c *gin.Context) { streamSince[model.Saving](c, util.SavingCollection, "owner") }

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
		if errors.Is(err, service.ErrReferenced) || errors.Is(err, service.ErrIdempotencyConflict) {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Error updating saving",
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
		if errors.Is(err, service.ErrReferenced) || errors.Is(err, service.ErrIdempotencyConflict) {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Error soft deleting related transactions",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Saving and related transactions soft deleted successfully"})
}
