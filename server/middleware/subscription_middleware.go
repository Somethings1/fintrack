package middleware

import (
	"fintrack/server/model"
	"fintrack/server/service"
	"fmt"
	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"net/http"
	"time"
)

func SubscriptionOwnershipMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		username := c.GetString("username")
		subscription, err := service.GetSubscriptionById(c.Request.Context(), c.Param("id"))

		if err != nil {
			c.AbortWithStatusJSON(http.StatusNotFound, gin.H{"error": "Subscription not found"})
			return
		}

		if subscription.Creator != username {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "You are not the creator of this subscription"})
			return
		}

		c.Next()
	}
}

func SubscriptionFormatMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		type Subscription struct {
			Name          string  `json:"name"`
			Icon          string  `json:"icon"`
			Creator       string  `json:"creator"`
			Amount        float64 `json:"amount"`
			SourceAccount string  `json:"sourceAccount"`
			Category      string  `json:"category"`

			StartDate       string `json:"startDate"`
			Interval        string `json:"interval"`
			MaxInterval     int    `json:"maxInterval"`
			CurrentInterval int    `json:"currentInterval"`
			RemindBefore    int    `json:"remindBefore"`

			IsDeleted bool `json:"isDeleted"`
		}
		var _subscription Subscription

		if err := c.ShouldBindJSON(&_subscription); err != nil {
			c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		_subscription.Creator = c.GetString("username")

		if _subscription.Amount <= 0 || _subscription.Amount > 1e12 {
			c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{
				"error": "Amount cannot be negative",
			})
			return
		}

		srcID, err := primitive.ObjectIDFromHex(_subscription.SourceAccount)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{
				"error": "Invalid source account ID",
			})
			return
		}

		getOwner := func(id string) (string, error) {
			account, accErr := service.GetAccountByID(c.Request.Context(), id)
			if accErr == nil && !account.IsDeleted {
				return account.Owner, nil
			}
			saving, savErr := service.GetSavingByID(c.Request.Context(), id)
			if savErr == nil && !saving.IsDeleted {
				return saving.Owner, nil
			}
			return "", fmt.Errorf("Not found")
		}

		owner, err := getOwner(_subscription.SourceAccount)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{
				"error": "Source account not found",
			})
			return
		}
		if owner != _subscription.Creator {
			c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{
				"error": "You are not the owner of the source account",
			})
			return
		}

		var category model.Category
		category, err = service.GetCategoryByID(c.Request.Context(), _subscription.Category)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{
				"error": "Category not found",
			})
			return
		}
		if category.Owner != _subscription.Creator || category.IsDeleted || category.Type != "expense" {
			c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{
				"error": "You are not the owner of the category",
			})
			return
		}

		StartDate, err := time.Parse(time.RFC3339, _subscription.StartDate)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{
				"error": "Invalid date format on `startDate`",
			})
			return
		}

		if _subscription.Interval != "week" &&
			_subscription.Interval != "month" &&
			_subscription.Interval != "year" &&
			_subscription.Interval != "test" {
			c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{
				"error": "Invalid interval type: expected " +
					"{week|month|year}, but got `" +
					_subscription.Interval + "`",
			})
			return
		}

		if _subscription.RemindBefore < 0 {
			c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{
				"error": "RemindBefore should be a positive number",
			})
			return
		}

		subscription := model.Subscription{
			Icon:          _subscription.Icon,
			Name:          _subscription.Name,
			Creator:       _subscription.Creator,
			Amount:        _subscription.Amount,
			SourceAccount: srcID,
			Category:      category.ID,

			StartDate:       StartDate,
			Interval:        _subscription.Interval,
			MaxInterval:     _subscription.MaxInterval,
			CurrentInterval: 1,
			RemindBefore:    _subscription.RemindBefore,

			NextActive: StartDate,
			NotifyAt:   StartDate.AddDate(0, 0, -_subscription.RemindBefore),
			IsActive:   true,
			IsDeleted:  false,
		}

		c.Set("subscription", subscription)
		c.Next()

	}
}
