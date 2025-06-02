package middleware

import (
    "net/http"
    "github.com/gin-gonic/gin"
    "fintrack/server/service"
    "fintrack/server/model"
)

func AccountOwnershipMiddleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        username := c.GetString("username")
        account, err := service.GetAccountByID(c.Param("id"))

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
            Owner   string  `json:"owner"`
            Balance float64 `json:"balance"`
            Icon    string  `json:"icon"`
            Name    string  `json:"name"`
        }
        var _account Account

        if err := c.ShouldBindJSON(&_account); err != nil {
            c.AbortWithStatus(http.StatusBadRequest)
            return
        }

        if _account.Balance < 0 {
            c.JSON(http.StatusBadRequest, gin.H{
                "error": "Balance cannot be negative",
            })
            return
        }

        if _account.Name == "" {
            c.JSON(http.StatusBadRequest, gin.H{
                "error": "Name cannot be empty",
            })
            return
        }


        account := model.Account{
            Owner:   _account.Owner,
            Balance: _account.Balance,
            Icon:    _account.Icon,
            Name:    _account.Name,
        }

        c.Set("account", account)
        c.Next()

    }
}
