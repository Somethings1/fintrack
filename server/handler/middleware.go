package handler

import (
    "fmt"
    "time"
    "net/http"
    "github.com/gin-gonic/gin"
    "fintrack/server/service"
)

func LoggingMiddleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        start := time.Now();
        method := c.Request.Method
        path := c.Request.URL.Path

        c.Next()

        duration := time.Since(start)
        fmt.Printf("[%s at %s] %s\n", method, path, duration)
    }
}

func AuthMiddleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        token := c.Request.Header.Get("Authorization")
        if token == "" {
            c.AbortWithStatus(http.StatusUnauthorized)
            return
        }

        username, err := validateTokenFromCookie(c, "access_token")
        if err != nil {
            c.AbortWithStatus(http.StatusUnauthorized)
            return
        }

        c.Set("username", username)
        c.Next()
    }
}


func TransactionOwnershipMiddleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        username := c.GetString("username")
        transaction, err := service.GetTransactionByID(c.Param("id"))

        if err != nil {
            c.AbortWithStatus(http.StatusNotFound)
            return
        }

        if transaction.Creator != username {
            c.AbortWithStatus(http.StatusForbidden)
            return
        }

        c.Set("transaction", transaction)
        c.Next()
    }
}


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

func CategoryOwnershipMiddleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        username := c.GetString("username")
        category, err := service.GetCategoryByID(c.Param("id"))

        if err != nil {
            c.AbortWithStatus(http.StatusNotFound)
            return
        }

        if category.Owner != username {
            c.AbortWithStatus(http.StatusForbidden)
            return
        }

        c.Set("category", category)
        c.Next()
    }
}
