package controller

import (
	"errors"
	"fintrack/server/model"
	"fintrack/server/service"
	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"time"
)

func AddSaving(c *gin.Context) {
	v, _ := c.Get("saving")
	id, err := service.AddSaving(c.Request.Context(), v.(model.Saving))
	if err != nil {
		c.JSON(500, gin.H{"error": "Error adding saving"})
		return
	}
	c.JSON(200, gin.H{"message": "Saving added successfully", "id": id})
}
func GetSavingsSince(c *gin.Context) {
	streamSince(c, service.SyncSavings, func(v model.Saving) (time.Time, primitive.ObjectID) { return v.LastUpdate, v.ID })
}
func UpdateSaving(c *gin.Context) {
	v, _ := c.Get("saving")
	id, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(400, gin.H{"error": "Invalid saving ID"})
		return
	}
	err = service.UpdateSaving(c.Request.Context(), id, v.(model.Saving))
	if preconditionFailed(c, err) {
		return
	}
	if err != nil {
		c.JSON(500, gin.H{"error": "Error updating saving"})
		return
	}
	c.JSON(200, gin.H{"message": "Saving updated successfully"})
}
func DeleteSaving(c *gin.Context) {
	id, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(400, gin.H{"error": "Invalid saving ID"})
		return
	}
	err = service.DeleteSaving(c.Request.Context(), id)
	if preconditionFailed(c, err) {
		return
	}
	if err != nil {
		if errors.Is(err, service.ErrReferenced) {
			c.JSON(409, gin.H{"error": err.Error()})
			return
		}
		c.JSON(500, gin.H{"error": "Error deleting saving"})
		return
	}
	c.JSON(200, gin.H{"message": "Saving deleted successfully"})
}
