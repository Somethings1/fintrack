package middleware

import (
	"fintrack/server/model"
	"fintrack/server/money"
	"fintrack/server/service"
	"github.com/gin-gonic/gin"
	"net/http"
)

func AccountOwnershipMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		username := c.GetString("username")
		account, err := service.GetAccountByID(c.Request.Context(), c.Param("id"))

		if err != nil {
			c.AbortWithStatus(http.StatusNotFound)
			return
		}

		if account.Owner != username {
			c.AbortWithStatus(http.StatusForbidden)
			return
		}

		c.Set("account", account)
		c.Next()
	}
}

func AccountFormatMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		type Account struct {
			Currency string       `json:"currency"`
			Owner    string       `json:"owner"`
			Balance  money.Amount `json:"balance"`
			Icon     string       `json:"icon"`
			Name     string       `json:"name"`
		}
		var _account Account

		if err := c.ShouldBindJSON(&_account); err != nil {
			c.AbortWithStatus(http.StatusBadRequest)
			return
		}
		_account.Owner = c.GetString("username")
		currency, currencyErr := money.Resolve(c.Request.Context(), _account.Currency)
		if currencyErr != nil {
			c.AbortWithStatusJSON(400, gin.H{"error": "invalid ledger currency"})
			return
		}
		if money.Validate(_account.Balance, currency) != nil {
			c.AbortWithStatusJSON(400, gin.H{"error": "invalid monetary precision or range"})
			return
		}

		if _account.Balance < 0 {
			c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{
				"error": "Balance cannot be negative",
			})
			return
		}

		if _account.Name == "" {
			c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{
				"error": "Name cannot be empty",
			})
			return
		}

		account := model.Account{
			Currency: currency,
			Owner:    _account.Owner,
			Balance:  _account.Balance,
			Icon:     _account.Icon,
			Name:     _account.Name,
		}

		c.Set("account", account)
		c.Next()

	}
}
