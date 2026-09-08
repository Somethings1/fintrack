package controller

import (
	"errors"
	"fintrack/server/util"
	"github.com/gin-gonic/gin"
)

func preconditionFailed(c *gin.Context, err error) bool {
	if !errors.Is(err, util.ErrPrecondition) {
		return false
	}
	c.JSON(412, gin.H{"error": "The record changed. Refresh and review before submitting again."})
	return true
}
