package middleware

import (
    "fmt"
    "time"
    "net/http"
    "github.com/gin-gonic/gin"
    "fintrack/server/service"
    "fintrack/server/model"
    "go.mongodb.org/mongo-driver/bson/primitive"
)

func TransactionOwnershipMiddleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        username := c.GetString("username")
        transaction, err := service.GetTransactionByID(c.Param("id"))

        if err != nil {
            c.JSON(http.StatusNotFound, gin.H{"error": "Transaction not found"})
            return
        }

        if transaction.Creator != username {
            c.JSON(http.StatusForbidden, gin.H{"error": "You are not the creator of this transaction"})
            return
        }

        c.Next()
    }
}

func TransactionFormatMiddleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        type Transaction struct {
            Creator         string             `json:"creator"`
            Amount          float64            `json:"amount"`
            DateTime        string             `json:"dateTime"`
            Type            string             `json:"type"`
            SourceAccount   string             `json:"sourceAccount"`
            DestinationAccount string          `json:"destinationAccount"`
            Category        string             `json:"category"`
            Note            string             `json:"note"`
            IsDeleted       bool            `json:"isDeleted"`
        }
        var _transaction Transaction

        // Overall format
        if err := c.ShouldBindJSON(&_transaction); err != nil {
            c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
            return
        }

        // Date time
        DateTime, err := time.Parse(time.RFC3339, _transaction.DateTime)
        fmt.Println(_transaction.DateTime);
        if err != nil {
            c.JSON(http.StatusBadRequest, gin.H{
                "error": "Invalid date format on `dateTime`",
            })
            return
        }

        // Type
        if _transaction.Type != "income" &&
           _transaction.Type != "expense" &&
           _transaction.Type != "transfer" {
               c.JSON(http.StatusBadRequest, gin.H{
                   "error": "Invalid transaction type: expected " +
                   "{income|expense|transfer}, but got `" +
                   _transaction.Type + "`",
               })
            return
        }

        // Amount
        if _transaction.Amount < 0 {
            c.JSON(http.StatusBadRequest, gin.H{
                "error": "Amount cannot be negative",
            })
            return
        }

        getOwner := func(id string) (string, error) {
            account, accErr := service.GetAccountByID(id)
            if accErr == nil {
                return account.Owner, nil
            }
            saving, savErr := service.GetSavingByID(id)
            if savErr == nil {
                return saving.Owner, nil
            }
            return "", fmt.Errorf("Not found")
        }


        // Source account
        if _transaction.Type == "expense" || _transaction.Type == "transfer" {
            owner, err := getOwner(_transaction.SourceAccount)
            if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{
                    "error": "Source account not found",
                })
                return
            }
            if owner != _transaction.Creator {
                c.JSON(http.StatusBadRequest, gin.H{
                    "error": "You are not the owner of the source account",
                })
                return
            }
        }

        // Destination account
        if _transaction.Type == "income" || _transaction.Type == "transfer" {
            owner, err := getOwner(_transaction.DestinationAccount)
            if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{
                    "error": "Destination account not found",
                })
                return
            }
            if owner != _transaction.Creator {
                c.JSON(http.StatusBadRequest, gin.H{
                    "error": "You are not the owner of the destination account",
                })
                return
            }
        }

        var category model.Category
        if _transaction.Type == "income" || _transaction.Type == "expense" {
            category, err = service.GetCategoryByID(_transaction.Category)
            if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{
                    "error": "Category not found",
                })
                return
            }
            if category.Owner != _transaction.Creator {
                c.JSON(http.StatusBadRequest, gin.H{
                    "error": "You are not the owner of the category",
                })
                return
            }

        } else {
            if _transaction.SourceAccount == _transaction.DestinationAccount {
                c.JSON(http.StatusBadRequest, gin.H{
                    "error": "Source and destination accounts cannot be the same",
                })
                return
            }
        }

        srcID, err := primitive.ObjectIDFromHex(_transaction.SourceAccount)
        if err != nil {
            c.JSON(http.StatusBadRequest, gin.H{
                "error": "Invalid source account ID",
            })
            return
        }

        dstID, err := primitive.ObjectIDFromHex(_transaction.DestinationAccount)
        if err != nil {
            c.JSON(http.StatusBadRequest, gin.H{
                "error": "Invalid destination account ID",
            })
            return
        }

        transaction := model.Transaction{
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
