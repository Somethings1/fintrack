package middleware

import (
	"context"
	"fintrack/server/util"
	"github.com/gin-gonic/gin"
	"net/http"
	"strings"
)

func IdempotencyKey() gin.HandlerFunc {
	return func(c *gin.Context) {
		key := c.GetHeader("Idempotency-Key")
		if len(key) > 128 || strings.IndexFunc(key, func(r rune) bool {
			return !(r >= 'a' && r <= 'z' || r >= 'A' && r <= 'Z' || r >= '0' && r <= '9' || r == '-' || r == '_')
		}) >= 0 {
			c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "invalid idempotency key"})
			return
		}
		c.Request = c.Request.WithContext(context.WithValue(c.Request.Context(), util.RequestKey, key))
		c.Next()
	}
}
