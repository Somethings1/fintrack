package middleware

import (
	"context"
	"encoding/json"
	"github.com/gin-gonic/gin"
	"net/http"
	"os"
	"time"
    "fintrack/server/util"
)

func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		token, err := c.Cookie("access_token")
		if err != nil || token == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "No token"})
			return
		}

		req, _ := http.NewRequest("GET", os.Getenv("SUPABASE_URL")+"/auth/v1/user", nil)
		req.Header.Set("Authorization", "Bearer "+token)
		req.Header.Set("apikey", os.Getenv("SUPABASE_ANON_KEY"))

		resp, err := http.DefaultClient.Do(req)
		if err != nil || resp.StatusCode != 200 {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
			return
		}
		defer resp.Body.Close()

		var result struct {
			ID string `json:"id"`
		}
		if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Failed to decode user"})
			return
		}

		c.Set("username", result.ID)
		c.Next()
	}
}

func ContextInjectorMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		userId := c.GetString("username")
		clientId := c.GetHeader("clientId")

		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		ctx = context.WithValue(c.Request.Context(), util.UserIdKey, userId)
		ctx = context.WithValue(ctx, util.ClientIdKey, clientId)

		c.Request = c.Request.WithContext(ctx)

		c.Next()
	}
}
