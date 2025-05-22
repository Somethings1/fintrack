package main

import (
	"fintrack/server/controller"
    "fintrack/server/middleware"
	"fintrack/server/util"
	"fmt"
	"log"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
    "github.com/joho/godotenv"
)

func startControllers () {
	r := gin.Default()
	corsConfig := cors.Config{
		AllowOrigins:     []string{"http://localhost:5173"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Content-Type", "Authorization"},
		AllowCredentials: true,
		AllowOriginFunc: func(origin string) bool {
			return origin == "http://localhost:3000"
		},
		ExposeHeaders: []string{"Content-Length", "Set-Cookie"},
	}

	r.Use(cors.New(corsConfig))

	r.Use(middleware.LoggingMiddleware())
	r.Use(middleware.PrintRequestDetails())

	api := r.Group("/api", middleware.AuthMiddleware())

	transactions := api.Group("/transactions")
	{
		transactions.POST("/add",
			middleware.TransactionFormatMiddleware(),
			controller.AddTransaction)

		transactions.GET("/get/:year",
			controller.GetTransactionsByYear)

		transactions.GET("/get-since/:time",
			controller.GetTransactionsSince)

		transactions.PUT("/update/:id",
			middleware.TransactionOwnershipMiddleware(),
			middleware.TransactionFormatMiddleware(),
			controller.UpdateTransaction)

		transactions.DELETE("/delete/:id",
			middleware.TransactionOwnershipMiddleware(),
			controller.DeleteTransaction)
	}

	accounts := api.Group("/accounts")
	{
		accounts.POST("/add",
			middleware.AccountFormatMiddleware(),
			controller.AddAccount)

		accounts.GET("/get",
			controller.GetAccounts)

		accounts.GET("/get-since/:time",
			controller.GetAccountsSince)

		accounts.PUT("/update/:id",
			middleware.AccountOwnershipMiddleware(),
			middleware.AccountFormatMiddleware(),
			controller.UpdateAccount)

		accounts.DELETE("/delete/:id",
			middleware.AccountOwnershipMiddleware(),
			controller.DeleteAccount)
	}

	savings := api.Group("/savings")
	{
		savings.POST("/add",
			middleware.SavingFormatMiddleware(),
			controller.AddSaving)

		savings.GET("/get",
			controller.GetSavings)

		savings.GET("/get-since/:time",
			controller.GetSavingsSince)

		savings.PUT("/update/:id",
			middleware.SavingOwnershipMiddleware(),
			middleware.SavingFormatMiddleware(),
			controller.UpdateSaving)

		savings.DELETE("/delete/:id",
			middleware.SavingOwnershipMiddleware(),
			controller.DeleteSaving)
	}

	categories := api.Group("/categories")
	{
		categories.POST("/add",
			middleware.CategoryFormatMiddleware(),
			controller.AddCategory)

		categories.GET("/get",
			controller.GetCategories)

		categories.GET("/get-since/:time",
			controller.GetCategoriesSince)

		categories.PUT("/update/:id",
			middleware.CategoryOwnershipMiddleware(),
			middleware.CategoryFormatMiddleware(),
			controller.UpdateCategory)

		categories.DELETE("/delete/:id",
			middleware.CategoryOwnershipMiddleware(),
			controller.DeleteCategory)
	}

	fmt.Println("Server running on http://localhost:8080")
	log.Fatal(r.Run(":8080"))
}

func main() {
	util.InitDB()
    godotenv.Load()
    startControllers();
}

