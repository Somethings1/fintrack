package main

import (
	"fintrack/server/handler"
	"fintrack/server/util"
	"fmt"
	"log"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func main() {
	util.InitDB()

    r := gin.Default()
    r.Use(handler.LoggingMiddleware())
    r.Use(handler.PrintRequestDetails())

    r.POST("/auth/signup", handler.SignUp)
    r.POST("/auth/signin", handler.SignIn)
    r.POST("/auth/refresh", handler.Refresh)
    r.POST("/auth/verify", handler.AuthMiddleware(), handler.Verify)
    r.POST("/auth/logout", handler.Logout)

    api := r.Group("/api", handler.AuthMiddleware())

    transactions := api.Group("/transactions")
    {
        transactions.POST("/add",
            handler.TransactionFormatMiddleware(),
            handler.AddTransaction)

        transactions.GET("/get/:year",
            handler.GetTransactionsByYear)

        transactions.PUT("/update/:id",
            handler.TransactionOwnershipMiddleware(),
            handler.TransactionFormatMiddleware(),
            handler.UpdateTransaction)

        transactions.DELETE("/delete/:id",
            handler.TransactionOwnershipMiddleware(),
            handler.DeleteTransaction)
    }

    accounts := api.Group("/accounts")
    {
        accounts.POST("/add",
            handler.AccountFormatMiddleware(),
            handler.AddAccount)

        accounts.GET("/get",
            handler.GetAccounts)

        accounts.PUT("/update/:id",
            handler.AccountOwnershipMiddleware(),
            handler.AccountFormatMiddleware(),
            handler.UpdateAccount)

        accounts.DELETE("/delete/:id",
            handler.AccountOwnershipMiddleware(),
            handler.DeleteAccount)
    }

    categories := api.Group("/categories")
    {
        categories.POST("/add",
            handler.CategoryFormatMiddleware(),
            handler.AddCategory)

        categories.GET("/get",
            handler.GetCategories)

        categories.PUT("/update/:id",
            handler.CategoryOwnershipMiddleware(),
            handler.CategoryFormatMiddleware(),
            handler.UpdateCategory)

        categories.DELETE("/delete/:id",
            handler.CategoryOwnershipMiddleware(),
            handler.DeleteCategory)
    }

    corsConfig := cors.Config{
		AllowOrigins:     []string{"http://localhost:3000"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE"},
		AllowHeaders:     []string{"Content-Type", "Authorization"},
		AllowCredentials: true,
		AllowOriginFunc: func(origin string) bool {
			return origin == "http://localhost:3000"
		},
		ExposeHeaders: []string{"Content-Length"},
	}

    r.Use(cors.New(corsConfig))

	fmt.Println("Server running on http://localhost:8080")
	log.Fatal(r.Run(":8080"))
}

