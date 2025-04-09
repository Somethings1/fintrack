package handler

import (
    "io"
    "fmt"
    "time"
    "bytes"
    "net/http"
    "github.com/gin-gonic/gin"
    "fintrack/server/service"
    "fintrack/server/model"
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
        username, err := validateTokenFromCookie(c, "access_token")
        if err != nil {
            c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized (invalid token)"})
            return
        }

        c.Set("username", username)
        c.Next()
    }
}


func PrintRequestDetails() gin.HandlerFunc {
    return func(c *gin.Context) {
        fmt.Println("------------------------------------------")
        // Print HTTP method
        fmt.Println("HTTP Method:", c.Request.Method)

        // Print request headers
        fmt.Println("Request Headers:")
        for key, value := range c.Request.Header {
            fmt.Printf("%s: %s\n", key, value)
        }

        // Print query parameters
        fmt.Println("Query Parameters:")
        for key, value := range c.Request.URL.Query() {
            fmt.Printf("%s: %s\n", key, value)
        }

        // Print request body (if it's a POST or PUT request with a body)
        var body []byte
        if c.Request.Body != nil {
            body, _ = io.ReadAll(c.Request.Body)
            fmt.Println("Request Body:", string(body))

            // Since the body has been consumed, we need to reset it
            c.Request.Body = io.NopCloser(bytes.NewBuffer(body))
        }

        // Continue to the next middleware/handler
        c.Next()
    }
}

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

        // Source account
        sourceAccount, err := service.GetAccountByID(_transaction.SourceAccount)
        if _transaction.Type == "expense" || _transaction.Type == "transfer" {
            if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{
                    "error": "Source account not found",
                })
                return
            }
            if sourceAccount.Owner != _transaction.Creator {
                c.JSON(http.StatusBadRequest, gin.H{
                    "error": "You are not the owner of the source account",
                })
                return
            }
        }

        // Destination account
        destinationAccount, err := service.GetAccountByID(_transaction.DestinationAccount)
        if _transaction.Type == "income" || _transaction.Type == "transfer" {
            if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{
                    "error": "Destination account not found",
                })
                return
            }
            if destinationAccount.Owner != _transaction.Creator {
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
            if sourceAccount == destinationAccount {
                c.JSON(http.StatusBadRequest, gin.H{
                    "error": "Source and destination accounts cannot be the same",
                })
                return
            }
        }

        transaction := model.Transaction{
            Creator:         _transaction.Creator,
            Amount:          _transaction.Amount,
            DateTime:        DateTime,
            Type:            _transaction.Type,
            SourceAccount:   sourceAccount.ID,
            DestinationAccount: destinationAccount.ID,
            Category:        category.ID,
            Note:            _transaction.Note,
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

func SavingOwnershipMiddleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        username := c.GetString("username")
        saving, err := service.GetSavingByID(c.Param("id"))

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

        if _saving.Balance < 0 {
            c.JSON(http.StatusBadRequest, gin.H{
                "error": "Balance cannot be negative",
            })
            return
        }

        if _saving.Name == "" {
            c.JSON(http.StatusBadRequest, gin.H{
                "error": "Name cannot be empty",
            })
            return
        }

        CreatedDate, err := time.Parse(time.RFC3339, _saving.CreatedDate)
        if err != nil {
            c.JSON(http.StatusBadRequest, gin.H{
                "error": "Invalid date format on `lastUpdate`",
            })
        }

        GoalDate, err := time.Parse(time.RFC3339, _saving.GoalDate)
        if err != nil {
            c.JSON(http.StatusBadRequest, gin.H{
                "error": "Invalid date format on `lastUpdate`",
            })
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

func CategoryFormatMiddleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        type Category struct {
            Owner   string  `json:"owner"`
            Icon    string  `json:"icon"`
            Name    string  `json:"name"`
            Type    string  `json:"type"`
            Budget  float64 `json:"budget"`
        }
        var _category Category

        if err := c.ShouldBindJSON(&_category); err != nil {
            c.AbortWithStatus(http.StatusBadRequest)
            return
        }

        if _category.Type != "income" && _category.Type != "expense" {
            c.JSON(http.StatusBadRequest, gin.H{
                "error": "Invalid category type",
            })
        }

        if _category.Name == "" {
            c.JSON(http.StatusBadRequest, gin.H{
                "error": "Name cannot be empty",
            })
            return
        }

        if _category.Budget < 0 {
            c.JSON(http.StatusBadRequest, gin.H{
                "error": "Budget cannot be negative",
            })
            return
        }

        category := model.Category{
            Owner:   _category.Owner,
            Icon:    _category.Icon,
            Name:    _category.Name,
            Type:    _category.Type,
            Budget:  _category.Budget,
        }

        c.Set("category", category)
        c.Next()
    }
}
