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
// Account Handlers
//////////////////

func AddAccount(c *gin.Context) {
	tmp, _ := c.Get("account")
	account := tmp.(model.Account)

	result, err := service.AddAccount(c.Request.Context(), account)
	if err != nil {
		if errors.Is(err, service.ErrReferenced) || errors.Is(err, service.ErrIdempotencyConflict) {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Error adding account",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Account added successfully",
		"id":      result,
	})
}

func GetAccountsSince(c *gin.Context) { streamSince[model.Account](c, util.AccountCollection, "owner") }

func UpdateAccount(c *gin.Context) {
	tmp, _ := c.Get("account")
	account := tmp.(model.Account)
	id, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid account ID"})
		return
	}

	err = service.UpdateAccount(c.Request.Context(), id, account)
	if err != nil {
		if errors.Is(err, service.ErrReferenced) || errors.Is(err, service.ErrIdempotencyConflict) {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Error updating account",
		})
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

	err = service.DeleteAccount(c.Request.Context(), id)
	if err != nil {
		if errors.Is(err, service.ErrReferenced) || errors.Is(err, service.ErrIdempotencyConflict) {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Error deleting account",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Account and related transactions soft deleted successfully"})
}
