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
// Transaction Handlers
//////////////////

func GetTransactionsSince(c *gin.Context) {
	streamSince[model.Transaction](c, util.TransactionCollection, "creator")
}

func AddTransaction(c *gin.Context) {
	tx, _ := c.Get("transaction")
	transaction := tx.(model.Transaction)

	result, err := service.AddTransaction(c.Request.Context(), transaction)

	if err != nil {
		if errors.Is(err, service.ErrReferenced) || errors.Is(err, service.ErrIdempotencyConflict) {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Transaction failed",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Transaction added successfully",
		"id":      result,
	})
}

func UpdateTransaction(c *gin.Context) {
	id, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid transaction ID"})
		return
	}

	tx, _ := c.Get("transaction")
	newTx := tx.(model.Transaction)

	err = service.UpdateTransaction(c.Request.Context(), id, newTx)

	if err != nil {
		if errors.Is(err, service.ErrReferenced) || errors.Is(err, service.ErrIdempotencyConflict) {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Error updating transaction with balance adjustment",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Transaction updated successfully"})
}

func DeleteTransaction(c *gin.Context) {
	id, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid transaction ID"})
		return
	}

	err = service.DeleteTransaction(c.Request.Context(), id)
	if err != nil {
		if errors.Is(err, service.ErrReferenced) || errors.Is(err, service.ErrIdempotencyConflict) {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Error deleting transaction",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Transaction deleted successfully"})
}
