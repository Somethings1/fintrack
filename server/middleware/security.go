package middleware

import (
	"github.com/gin-gonic/gin"
	"net/http"
	"sync"
	"time"
)

func SecurityHeaders() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("X-Content-Type-Options", "nosniff")
		c.Header("Referrer-Policy", "no-referrer")
		c.Header("Cache-Control", "no-store")
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 1<<20)
		if c.Request.ContentLength > 1<<20 {
			c.AbortWithStatus(http.StatusRequestEntityTooLarge)
			return
		}
		c.Next()
	}
}

// Cookie-authenticated unsafe requests must carry an explicitly allowed Origin.
// Bearer clients do not rely on ambient credentials; CORS is still enforced separately.
func OriginGuard(origins []string) gin.HandlerFunc {
	allowed := make(map[string]bool, len(origins))
	for _, origin := range origins {
		allowed[origin] = true
	}
	return func(c *gin.Context) {
		method := c.Request.Method
		if method != http.MethodGet && method != http.MethodHead && method != http.MethodOptions && c.GetHeader("Authorization") == "" {
			if !allowed[c.GetHeader("Origin")] {
				c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "origin not allowed"})
				return
			}
		}
		c.Next()
	}
}

type bucket struct {
	tokens        float64
	updated, seen time.Time
}
type limiter struct {
	mu          sync.Mutex
	users       map[string]bucket
	lastCleanup time.Time
	rate, burst float64
	capacity    int
}

// RateLimit is bounded both in requests and memory. It is per-process, not a
// substitute for a shared ingress quota when deploying multiple replicas.
func RateLimit(rate, burst float64, capacity int) gin.HandlerFunc {
	l := &limiter{users: map[string]bucket{}, rate: rate, burst: burst, capacity: capacity}
	return func(c *gin.Context) {
		if !l.allow(c.GetString("username"), time.Now()) {
			c.Header("Retry-After", "60")
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{"error": "rate limit exceeded"})
			return
		}
		c.Next()
	}
}
func (l *limiter) allow(key string, now time.Time) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	if key == "" {
		return false
	}
	if now.Sub(l.lastCleanup) > time.Minute {
		for id, b := range l.users {
			if now.Sub(b.seen) > 10*time.Minute {
				delete(l.users, id)
			}
		}
		l.lastCleanup = now
	}
	b, exists := l.users[key]
	if !exists {
		if len(l.users) >= l.capacity {
			return false
		}
		b = bucket{tokens: l.burst, updated: now}
	}
	b.tokens = min(l.burst, b.tokens+now.Sub(b.updated).Seconds()*l.rate)
	b.updated, b.seen = now, now
	allowed := b.tokens >= 1
	if allowed {
		b.tokens--
	}
	l.users[key] = b
	return allowed
}
