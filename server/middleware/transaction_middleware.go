package middleware

import (
	"fintrack/server/model"
	"fintrack/server/money"
	"fintrack/server/service"
	"fmt"
	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"net/http"
	"time"
)

func TransactionOwnershipMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		username := c.GetString("username")
		transaction, err := service.GetTransactionByID(c.Request.Context(), c.Param("id"))

		if err != nil {
			c.AbortWithStatusJSON(http.StatusNotFound, gin.H{"error": "Transaction not found"})
			return
		}

		if transaction.Creator != username {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "You are not the creator of this transaction"})
			return
		}

		c.Next()
	}
}

func TransactionFormatMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		type Transaction struct {
			Currency           string       `json:"currency"`
			Creator            string       `json:"creator"`
			Amount             money.Amount `json:"amount"`
			DateTime           string       `json:"dateTime"`
			Type               string       `json:"type"`
			SourceAccount      string       `json:"sourceAccount"`
			DestinationAccount string       `json:"destinationAccount"`
			Category           string       `json:"category"`
			Note               string       `json:"note"`
			IsDeleted          bool         `json:"isDeleted"`
		}
		var _transaction Transaction

		// Overall format
		if err := c.ShouldBindJSON(&_transaction); err != nil {
			c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		_transaction.Creator = c.GetString("username")
		currency, currencyErr := money.Resolve(c.Request.Context(), _transaction.Currency)
		if currencyErr != nil {
			c.AbortWithStatusJSON(400, gin.H{"error": "invalid ledger currency"})
			return
		}
		if money.Validate(_transaction.Amount, currency) != nil {
			c.AbortWithStatusJSON(400, gin.H{"error": "invalid monetary precision or range"})
			return
		}

		// Date time
		DateTime, err := time.Parse(time.RFC3339, _transaction.DateTime)
		// Never log financial request fields
		if err != nil {
			c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{
				"error": "Invalid date format on `dateTime`",
			})
			return
		}

		// Type
		if _transaction.Type != "income" &&
			_transaction.Type != "expense" &&
			_transaction.Type != "transfer" {
			c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{
				"error": "Invalid transaction type: expected " +
					"{income|expense|transfer}, but got `" +
					_transaction.Type + "`",
			})
			return
		}

		if len(_transaction.Note) > 500 {
			c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "note exceeds 500 bytes"})
			return
		}
		// Amount
		if _transaction.Amount <= 0 || _transaction.Amount > money.Max {
			c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{
				"error": "Amount must be positive and at most 1e12",
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

		// Source account
		if _transaction.Type == "expense" || _transaction.Type == "transfer" {
			owner, err := getOwner(_transaction.SourceAccount)
			if err != nil {
				c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{
					"error": "Source account not found",
				})
				return
			}
			if owner != _transaction.Creator {
				c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{
					"error": "You are not the owner of the source account",
				})
				return
			}
		}

		// Destination account
		if _transaction.Type == "income" || _transaction.Type == "transfer" {
			owner, err := getOwner(_transaction.DestinationAccount)
			if err != nil {
				c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{
					"error": "Destination account not found",
				})
				return
			}
			if owner != _transaction.Creator {
				c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{
					"error": "You are not the owner of the destination account",
				})
				return
			}
		}

		var category model.Category
		if _transaction.Type == "income" || _transaction.Type == "expense" {
			category, err = service.GetCategoryByID(c.Request.Context(), _transaction.Category)
			if err != nil {
				c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{
					"error": "Category not found",
				})
				return
			}
			if category.Owner != _transaction.Creator || category.IsDeleted || category.Type != _transaction.Type {
				c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{
					"error": "You are not the owner of the category",
				})
				return
			}

		} else {
			if _transaction.SourceAccount == _transaction.DestinationAccount {
				c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{
					"error": "Source and destination accounts cannot be the same",
				})
				return
			}
		}

		if _transaction.Type == "income" {
			_transaction.SourceAccount = "000000000000000000000000"
		}
		if _transaction.Type == "expense" {
			_transaction.DestinationAccount = "000000000000000000000000"
		}

		srcID, err := primitive.ObjectIDFromHex(_transaction.SourceAccount)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{
				"error": "Invalid source account ID",
			})
			return
		}

		dstID, err := primitive.ObjectIDFromHex(_transaction.DestinationAccount)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{
				"error": "Invalid destination account ID",
			})
			return
		}

		transaction := model.Transaction{
			Currency:           currency,
			Creator:            _transaction.Creator,
			Amount:             _transaction.Amount,
			DateTime:           DateTime,
			Type:               _transaction.Type,
			SourceAccount:      srcID,
			DestinationAccount: dstID,
			Category:           category.ID,
			Note:               _transaction.Note,
		}

		c.Set("transaction", transaction)
		c.Next()

	}
}
