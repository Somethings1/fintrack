package middleware

import (
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"log/slog"
	"net/http"
	"time"
)

// LoggingMiddleware deliberately excludes URLs, query strings, user IDs, credentials,
// request/response bodies, and panic values. Route templates have bounded cardinality.
func LoggingMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		started := time.Now()
		requestID := uuid.NewString()
		c.Header("X-Request-ID", requestID)
		c.Next()
		route := c.FullPath()
		if route == "" {
			route = "unmatched"
		}
		slog.Info("http_request", "request_id", requestID, "method", c.Request.Method,
			"route", route, "status", c.Writer.Status(), "duration_ms", time.Since(started).Milliseconds())
	}
}

func Recovery() gin.HandlerFunc {
	return func(c *gin.Context) {
		defer func() {
			if recover() != nil {
				slog.Error("request_panic", "request_id", c.Writer.Header().Get("X-Request-ID"))
				c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
			}
		}()
		c.Next()
	}
}
