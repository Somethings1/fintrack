package controller

import (
	"errors"
	"fintrack/server/model"
	"fintrack/server/service"
	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"time"
)

func GetCategoriesSince(c *gin.Context) {
	streamSince(c, service.SyncCategories, func(v model.Category) (time.Time, primitive.ObjectID) { return v.LastUpdate, v.ID })
}
func AddCategory(c *gin.Context) {
	v, _ := c.Get("category")
	id, err := service.AddCategory(c.Request.Context(), v.(model.Category))
	if err != nil {
		if errors.Is(err, service.ErrReferenced) {
			c.JSON(409, gin.H{"error": err.Error()})
			return
		}
		c.JSON(500, gin.H{"error": "Error adding category"})
		return
	}
	c.JSON(200, gin.H{"message": "Category added successfully", "id": id})
}
func UpdateCategory(c *gin.Context) {
	v, _ := c.Get("category")
	id, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(400, gin.H{"error": "Invalid category ID"})
		return
	}
	err = service.UpdateCategory(c.Request.Context(), id, v.(model.Category))
	if err != nil {
		c.JSON(500, gin.H{"error": "Error updating category"})
		return
	}
	c.JSON(200, gin.H{"message": "Category updated successfully"})
}
func DeleteCategory(c *gin.Context) {
	id, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(400, gin.H{"error": "Invalid category ID"})
		return
	}
	err = service.DeleteCategory(c.Request.Context(), id)
	if err != nil {
		if errors.Is(err, service.ErrReferenced) {
			c.JSON(409, gin.H{"error": err.Error()})
			return
		}
		c.JSON(500, gin.H{"error": "Cannot delete category"})
		return
	}
	c.JSON(200, gin.H{"message": "Category deleted successfully"})
}
