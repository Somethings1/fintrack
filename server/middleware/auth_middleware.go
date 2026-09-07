package middleware

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"time"

	"fintrack/server/util"
	"github.com/gin-gonic/gin"
)

// AuthMiddleware validates tokens with Supabase; no token or user cache can outlive revocation.
// The client is shared, bounded, and never follows authentication redirects.
func AuthMiddleware(projectURL, publicKey string, client *http.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		token := ""
		if header := c.GetHeader("Authorization"); header != "" {
			parts := strings.Fields(header)
			if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
				c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid authorization header"})
				return
			}
			token = parts[1]
		} else {
			token, _ = c.Cookie("access_token")
		}
		if token == "" || len(token) > 8192 {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "authentication required"})
			return
		}
		ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
		defer cancel()
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, projectURL+"/auth/v1/user", nil)
		if err != nil {
			c.AbortWithStatus(http.StatusServiceUnavailable)
			return
		}
		req.Header.Set("Authorization", "Bearer "+token)
		req.Header.Set("apikey", publicKey)
		resp, err := client.Do(req)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusServiceUnavailable, gin.H{"error": "authentication service unavailable"})
			return
		}
		defer resp.Body.Close()
		if resp.StatusCode != http.StatusOK {
			_, _ = io.Copy(io.Discard, io.LimitReader(resp.Body, 4096))
			status := http.StatusUnauthorized
			if resp.StatusCode == 429 || resp.StatusCode >= 500 {
				status = http.StatusServiceUnavailable
			}
			c.AbortWithStatusJSON(status, gin.H{"error": "authentication failed"})
			return
		}
		var user struct {
			ID string `json:"id"`
		}
		if json.NewDecoder(io.LimitReader(resp.Body, 64<<10)).Decode(&user) != nil || strings.TrimSpace(user.ID) == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid user session"})
			return
		}
		c.Set("username", user.ID)
		c.Next()
	}
}

func ContextInjectorMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Derive all values from the deadline-bearing context, preserving cancellation.
		ctx, cancel := context.WithTimeout(c.Request.Context(), 30*time.Second)
		defer cancel()
		ctx = context.WithValue(ctx, util.UserIdKey, c.GetString("username"))
		clientID := c.GetHeader("clientId")
		if len(clientID) > 128 {
			c.AbortWithStatus(http.StatusBadRequest)
			return
		}
		ctx = context.WithValue(ctx, util.ClientIdKey, clientID)
		c.Request = c.Request.WithContext(ctx)
		c.Next()
	}
}
