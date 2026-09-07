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
// Category
//////////////////

func GetCategoriesSince(c *gin.Context) {
	streamSince[model.Category](c, util.CategoryCollection, "owner")
}

func AddCategory(c *gin.Context) {
	tmp, _ := c.Get("category")
	category := tmp.(model.Category)

	result, err := service.AddCategory(c.Request.Context(), category)
	if err != nil {
		if errors.Is(err, service.ErrReferenced) || errors.Is(err, service.ErrIdempotencyConflict) {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Error adding category",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Category added successfully",
		"id":      result,
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

	err = service.UpdateCategory(c.Request.Context(), id, category)
	if err != nil {
		if errors.Is(err, service.ErrReferenced) || errors.Is(err, service.ErrIdempotencyConflict) {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Error updating category",
		})
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

	err = service.DeleteCategory(c.Request.Context(), id)
	if err != nil {
		if errors.Is(err, service.ErrReferenced) || errors.Is(err, service.ErrIdempotencyConflict) {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Cannot delete category",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Category and related transactions deleted successfully"})
}
