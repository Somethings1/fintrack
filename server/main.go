package main

import (
	"context"
	"errors"
	"fintrack/server/agent"
	"fintrack/server/config"
	"fintrack/server/controller"
	"fintrack/server/cronjob"
	"fintrack/server/middleware"
	"fintrack/server/money"
	"fintrack/server/socket"
	"fintrack/server/telemetry"
	"fintrack/server/util"
	"fmt"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"go.mongodb.org/mongo-driver/mongo/readpref"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"sync"
	"syscall"
	"time"
)

func newRouter(cfg config.Config) *gin.Engine {
	if cfg.Environment == "production" {
		gin.SetMode(gin.ReleaseMode)
	}
	r := gin.New()
	_ = r.SetTrustedProxies(nil) // Never trust caller-supplied X-Forwarded-For.
	r.Use(middleware.LoggingMiddleware(), middleware.Recovery(), middleware.SecurityHeaders())
	r.Use(cors.New(cors.Config{AllowOrigins: cfg.AllowedOrigins,
		AllowMethods:  []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:  []string{"Content-Type", "Authorization", "clientId", "Idempotency-Key"},
		ExposeHeaders: []string{"X-Request-ID"}, AllowCredentials: true, MaxAge: 12 * time.Hour}))
	r.GET("/metrics", gin.WrapF(telemetry.Handler))
	r.GET("/livez", func(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"status": "ok"}) })
	r.GET("/readyz", func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(c.Request.Context(), 2*time.Second)
		defer cancel()
		if util.MongoClient == nil || util.MongoClient.Ping(ctx, readpref.Primary()) != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"status": "unavailable"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": "ready"})
	})
	authClient := &http.Client{Timeout: 6 * time.Second, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}
	currency := cfg.LedgerCurrency
	if currency == "" && cfg.Environment != "production" {
		currency = "USD"
	}
	r.GET("/api/config", func(c *gin.Context) {
		precision, _ := money.Precision(currency)
		c.JSON(200, gin.H{"currency": currency, "precision": precision, "moneyVersion": 1})
	})
	api := r.Group("/api", middleware.OriginGuard(cfg.AllowedOrigins),
		middleware.AuthMiddleware(cfg.SupabaseURL, cfg.SupabaseKey, authClient),
		middleware.ContextInjectorMiddleware(), func(c *gin.Context) {
			c.Request = c.Request.WithContext(money.WithCurrency(c.Request.Context(), currency))
			c.Next()
		}, middleware.RateLimit(20, 60, 8192))
	api.GET("/ws", socket.HandleWebSocket(cfg.AllowedOrigins))
	api.POST("/agent/draft", middleware.RateLimit(1.0/10, 3, 4096), agent.Handler(cfg))
	api.POST("/session", func(c *gin.Context) {
		// Only explicit bearer authentication may mint the HttpOnly WebSocket cookie.
		header := strings.Fields(c.GetHeader("Authorization"))
		if len(header) != 2 || !strings.EqualFold(header[0], "Bearer") {
			c.AbortWithStatus(http.StatusBadRequest)
			return
		}
		c.SetSameSite(http.SameSiteStrictMode)
		c.SetCookie("access_token", header[1], 3600, "/api", "", cfg.Environment == "production", true)
		c.Status(http.StatusNoContent)
	})
	r.DELETE("/api/session", middleware.OriginGuard(cfg.AllowedOrigins), func(c *gin.Context) {
		c.SetSameSite(http.SameSiteStrictMode)
		c.SetCookie("access_token", "", -1, "/api", "", cfg.Environment == "production", true)
		c.Status(http.StatusNoContent)
	})
	transactions := api.Group("/transactions")
	{
		transactions.POST("/add",
			middleware.IdempotencyKey(),
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

	return r
}

func run() error {
	if os.Getenv("APP_ENV") != "production" {
		_ = godotenv.Load()
	}
	cfg, err := config.Load()
	if err != nil {
		return err
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	startup, cancel := context.WithTimeout(ctx, 30*time.Second)
	err = util.InitDB(startup, cfg.MongoURI, cfg.MongoDatabase)
	if err == nil {
		err = util.EnsureLedger(startup, cfg.LedgerCurrency)
	}
	cancel()
	if err != nil {
		return err
	}
	defer func() {
		shutdown, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		_ = util.MongoClient.Disconnect(shutdown)
	}()
	workerCtx, stopWorker := context.WithCancel(ctx)
	var workers sync.WaitGroup
	telemetry.WorkerEnabled(cfg.CronEnabled)
	if cfg.CronEnabled {
		workers.Add(1)
		go func() { defer workers.Done(); cronjob.Run(workerCtx, cfg.LedgerCurrency) }()
	}
	// Workers finish/cancel their transactions before the database disconnects.
	defer func() { stopWorker(); workers.Wait() }()
	server := &http.Server{Addr: ":" + cfg.Port, Handler: newRouter(cfg), ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout: 15 * time.Second, WriteTimeout: 45 * time.Second, IdleTimeout: 60 * time.Second, MaxHeaderBytes: 32 << 10}
	done := make(chan error, 1)
	go func() { done <- server.ListenAndServe() }()
	slog.Info("server_started", "port", cfg.Port, "environment", cfg.Environment)
	select {
	case err := <-done:
		if !errors.Is(err, http.ErrServerClosed) {
			return err
		}
	case <-ctx.Done():
		shutdown, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()
		socket.Manager.Close()
		if err := server.Shutdown(shutdown); err != nil {
			_ = server.Close()
			return err
		}
	}
	return nil
}

func main() {
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, nil)))
	if len(os.Args) > 1 && os.Args[1] == "healthcheck" {
		port := os.Getenv("PORT")
		if port == "" {
			port = "8080"
		}
		client := &http.Client{Timeout: 2 * time.Second}
		response, err := client.Get("http://127.0.0.1:" + port + "/livez")
		if err != nil {
			os.Exit(1)
		}
		response.Body.Close()
		if response.StatusCode != http.StatusOK {
			os.Exit(1)
		}
		return
	}
	if err := run(); err != nil {
		slog.Error("startup_or_shutdown_failed", "error", fmt.Sprint(err))
		os.Exit(1)
	}
}
