package controller

import (
	"errors"
	"fintrack/server/model"
	"fintrack/server/service"
	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"time"
)

func GetTransactionsSince(c *gin.Context) {
	streamSince(c, service.SyncTransactions, func(v model.Transaction) (time.Time, primitive.ObjectID) { return v.LastUpdate, v.ID })
}
func AddTransaction(c *gin.Context) {
	v, _ := c.Get("transaction")
	id, err := service.AddTransaction(c.Request.Context(), v.(model.Transaction))
	if err != nil {
		if errors.Is(err, service.ErrReferenced) || errors.Is(err, service.ErrIdempotencyConflict) {
			c.JSON(409, gin.H{"error": err.Error()})
			return
		}
		c.JSON(500, gin.H{"error": "Transaction failed"})
		return
	}
	c.JSON(200, gin.H{"message": "Transaction added successfully", "id": id})
}
func UpdateTransaction(c *gin.Context) {
	id, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(400, gin.H{"error": "Invalid transaction ID"})
		return
	}
	v, _ := c.Get("transaction")
	err = service.UpdateTransaction(c.Request.Context(), id, v.(model.Transaction))
	if preconditionFailed(c, err) {
		return
	}
	if err != nil {
		if errors.Is(err, service.ErrIdempotencyConflict) {
			c.JSON(409, gin.H{"error": err.Error()})
			return
		}
		c.JSON(500, gin.H{"error": "Error updating transaction with balance adjustment"})
		return
	}
	c.JSON(200, gin.H{"message": "Transaction updated successfully"})
}
func DeleteTransaction(c *gin.Context) {
	id, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(400, gin.H{"error": "Invalid transaction ID"})
		return
	}
	err = service.DeleteTransaction(c.Request.Context(), id)
	if preconditionFailed(c, err) {
		return
	}
	if err != nil {
		c.JSON(500, gin.H{"error": "Error deleting transaction"})
		return
	}
	c.JSON(200, gin.H{"message": "Transaction deleted successfully"})
}
