package middleware

import (
    "os"
    "net/http"
    "encoding/json"
    "github.com/gin-gonic/gin"
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

