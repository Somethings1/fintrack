package main

import (
	"fintrack/server/controller"
	"fintrack/server/middleware"
	"fintrack/server/socket"
	"fintrack/server/util"
	"fintrack/server/cronjob"
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
		AllowHeaders:     []string{"Upgrade", "Connection", "Content-Type", "Authorization", "Origin", "Accept", "clientId"},
		AllowCredentials: true,
		AllowOriginFunc: func(origin string) bool {
			return origin == "http://localhost:5173"
		},
		ExposeHeaders: []string{"Content-Length", "Set-Cookie"},
        AllowWebSockets: true,
	}

	r.Use(cors.New(corsConfig))

	r.Use(middleware.LoggingMiddleware())
	r.Use(middleware.PrintRequestDetails())


	api := r.Group("/api", middleware.AuthMiddleware(), middleware.ContextInjectorMiddleware())
    api.GET("/ws", socket.HandleWebSocket)

	transactions := api.Group("/transactions")
	{
		transactions.POST("/add",
			middleware.TransactionFormatMiddleware(),
			controller.AddTransaction)

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

	subscriptions := api.Group("/subscriptions")
	{
		subscriptions.POST("/add",
			middleware.SubscriptionFormatMiddleware(),
			controller.AddSubscription)

		subscriptions.GET("/get-since/:time",
			controller.GetSubscriptionsSince)

		subscriptions.PUT("/update/:id",
			middleware.SubscriptionOwnershipMiddleware(),
			middleware.SubscriptionFormatMiddleware(),
			controller.UpdateSubscription)

		subscriptions.DELETE("/delete/:id",
			middleware.SubscriptionOwnershipMiddleware(),
			controller.DeleteSubscription)
	}

    notifications := api.Group("/notifications")
    {
        notifications.POST("/add",
            middleware.NotificationFormatMiddleware(),
            controller.AddNotification)
        notifications.GET("/get-since/:time",
            controller.GetNotificationsSince)
        notifications.PUT("/mark-read",
            controller.MarkNotificationsRead)
        notifications.PUT("/update/:id",
            middleware.NotificationOwnershipMiddleware(),
            middleware.NotificationFormatMiddleware(),
            controller.UpdateNotification)
        notifications.DELETE("/delete/:id",
            middleware.NotificationOwnershipMiddleware(),
            controller.DeleteNotification)
    }

	fmt.Println("Server running on http://localhost:8080")
	log.Fatal(r.Run(":8080"))
}

func startCronJobs() {
    go cronjob.CreateSubscriptionNotificationsCron()
    go cronjob.CreateSubscriptionTransactionCron()
}

func main() {
	util.InitDB()
    godotenv.Load()
    startCronJobs()
    startControllers()
}

