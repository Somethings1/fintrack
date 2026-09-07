package middleware

import (
	"fintrack/server/model"
	"fintrack/server/service"
	"github.com/gin-gonic/gin"
	"net/http"
	"time"
)

func SavingOwnershipMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		username := c.GetString("username")
		saving, err := service.GetSavingByID(c.Request.Context(), c.Param("id"))

		if err != nil {
			c.AbortWithStatus(http.StatusNotFound)
			return
		}

		if saving.Owner != username {
			c.AbortWithStatus(http.StatusForbidden)
			return
		}

		c.Set("saving", saving)
		c.Next()
	}
}

func SavingFormatMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		type Saving struct {
			Owner       string  `json:"owner"`
			Balance     float64 `json:"balance"`
			Icon        string  `json:"icon"`
			Name        string  `json:"name"`
			Goal        float64 `json:"goal"`
			CreatedDate string  `json:"createdDate"`
			GoalDate    string  `json:"goalDate"`
		}
		var _saving Saving

		if err := c.ShouldBindJSON(&_saving); err != nil {
			c.AbortWithStatus(http.StatusBadRequest)
			return
		}
		_saving.Owner = c.GetString("username")

		if _saving.Balance < 0 {
			c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{
				"error": "Balance cannot be negative",
			})
			return
		}

		if _saving.Name == "" {
			c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{
				"error": "Name cannot be empty",
			})
			return
		}

		CreatedDate, err := time.Parse(time.RFC3339, _saving.CreatedDate)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{
				"error": "Invalid date format on `lastUpdate`",
			})
			return
		}

		GoalDate, err := time.Parse(time.RFC3339, _saving.GoalDate)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{
				"error": "Invalid date format on `lastUpdate`",
			})
			return
		}

		saving := model.Saving{
			Owner:       _saving.Owner,
			Balance:     _saving.Balance,
			Icon:        _saving.Icon,
			Name:        _saving.Name,
			Goal:        _saving.Goal,
			CreatedDate: CreatedDate,
			GoalDate:    GoalDate,
		}

		c.Set("saving", saving)
		c.Next()
	}
}
