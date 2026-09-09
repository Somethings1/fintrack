package controller

import (
	"errors"
	"fintrack/server/model"
	"fintrack/server/service"
	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"net/http"
	"time"
)

func AddAccount(c *gin.Context) {
	v, _ := c.Get("account")
	id, err := service.AddAccount(c.Request.Context(), v.(model.Account))
	if err != nil {
		if errors.Is(err, service.ErrReferenced) || errors.Is(err, service.ErrIdempotencyConflict) {
			c.JSON(409, gin.H{"error": err.Error()})
			return
		}
		c.JSON(500, gin.H{"error": "Error adding account"})
		return
	}
	c.JSON(200, gin.H{"message": "Account added successfully", "id": id})
}
func GetAccountsSince(c *gin.Context) {
	streamSince(c, service.SyncAccounts, func(v model.Account) (time.Time, primitive.ObjectID) { return v.LastUpdate, v.ID })
}
func UpdateAccount(c *gin.Context) {
	v, _ := c.Get("account")
	id, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(400, gin.H{"error": "Invalid account ID"})
		return
	}
	err = service.UpdateAccount(c.Request.Context(), id, v.(model.Account))
	if preconditionFailed(c, err) {
		return
	}
	if err != nil {
		if errors.Is(err, service.ErrReferenced) || errors.Is(err, service.ErrIdempotencyConflict) {
			c.JSON(409, gin.H{"error": err.Error()})
			return
		}
		c.JSON(500, gin.H{"error": "Error updating account"})
		return
	}
	c.JSON(200, gin.H{"message": "Account updated successfully"})
}
func DeleteAccount(c *gin.Context) {
	id, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(400, gin.H{"error": "Invalid account ID"})
		return
	}
	err = service.DeleteAccount(c.Request.Context(), id)
	if preconditionFailed(c, err) {
		return
	}
	if err != nil {
		if errors.Is(err, service.ErrReferenced) {
			c.JSON(409, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error deleting account"})
		return
	}
	c.JSON(200, gin.H{"message": "Account deleted successfully"})
}
