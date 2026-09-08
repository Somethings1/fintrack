package middleware

import (
	"fintrack/server/util"
	"github.com/gin-gonic/gin"
	"strings"
	"time"
)

// A single strong revision is accepted. Wildcards/weak validators and lists
// cannot turn an exact approval into a blind overwrite.
func RecordPrecondition() gin.HandlerFunc {
	return func(c *gin.Context) {
		values := c.Request.Header.Values("If-Match")
		if len(values) == 0 {
			c.Next()
			return
		}
		raw := c.GetHeader("If-Match")
		if len(values) != 1 || len(raw) < 3 || len(raw) > 64 || !strings.HasPrefix(raw, "\"") || !strings.HasSuffix(raw, "\"") || (c.Request.Method != "PUT" && c.Request.Method != "DELETE") {
			c.AbortWithStatusJSON(400, gin.H{"error": "Provide one quoted record revision."})
			return
		}
		version, err := time.Parse(time.RFC3339Nano, raw[1:len(raw)-1])
		if err != nil || version.IsZero() {
			c.AbortWithStatusJSON(400, gin.H{"error": "Invalid record revision."})
			return
		}
		c.Request = c.Request.WithContext(util.WithExpectedVersion(c.Request.Context(), version))
		c.Next()
	}
}
