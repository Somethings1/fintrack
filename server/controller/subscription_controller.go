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
// Subscription Handlers
//////////////////

func GetSubscriptionsSince(c *gin.Context) {
	streamSince[model.Subscription](c, util.SubscriptionCollection, "creator")
}

func AddSubscription(c *gin.Context) {
	tx, _ := c.Get("subscription")
	subscription := tx.(model.Subscription)

	result, err := service.AddSubscription(c.Request.Context(), subscription)

	if err != nil {
		if errors.Is(err, service.ErrReferenced) || errors.Is(err, service.ErrIdempotencyConflict) {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Error adding new subscription",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Subscription added successfully",
		"id":      result,
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

	err = service.UpdateSubscription(c.Request.Context(), id, newTx)
	if err != nil {
		if errors.Is(err, service.ErrReferenced) || errors.Is(err, service.ErrIdempotencyConflict) {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Error updating subscription",
		})
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

	err = service.DeleteSubscription(c.Request.Context(), id)
	if err != nil {
		if errors.Is(err, service.ErrReferenced) || errors.Is(err, service.ErrIdempotencyConflict) {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Error deleting subscription",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Subscription deleted successfully"})
}
