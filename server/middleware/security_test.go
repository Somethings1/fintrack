package middleware

import (
	"context"
	"fintrack/server/model"
	"fintrack/server/util"
	"github.com/gin-gonic/gin"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestAuthFailsClosed(t *testing.T) {
	gin.SetMode(gin.TestMode)
	for _, tc := range []struct {
		name, token, body string
		status, want      int
	}{
		{"missing", "", `{"id":"owner"}`, 200, 401},
		{"bad scheme", "Basic test", `{"id":"owner"}`, 200, 401},
		{"invalid", "Bearer test", `{"id":"owner"}`, 401, 401},
		{"outage", "Bearer test", `{"id":"owner"}`, 503, 503},
		{"empty identity", "Bearer test", `{"id":""}`, 200, 401},
		{"malformed", "Bearer test", `not-json`, 200, 401},
		{"oversized", "Bearer test", strings.Repeat("x", 65537), 200, 401},
		{"valid", "bearer test", `{"id":"owner"}`, 200, 204},
	} {
		t.Run(tc.name, func(t *testing.T) {
			upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if r.URL.Path != "/auth/v1/user" || r.Header.Get("apikey") != "public-test-key" {
					t.Error("incorrect auth request")
				}
				w.WriteHeader(tc.status)
				_, _ = io.WriteString(w, tc.body)
			}))
			defer upstream.Close()
			called := false
			router := gin.New()
			router.Use(AuthMiddleware(upstream.URL, "public-test-key", upstream.Client()), ContextInjectorMiddleware())
			router.GET("/", func(c *gin.Context) {
				called = true
				if c.Request.Context().Value(util.UserIdKey) != "owner" {
					t.Error("missing authenticated context")
				}
				c.Status(204)
			})
			req := httptest.NewRequest("GET", "/", nil)
			req.Header.Set("Authorization", tc.token)
			res := httptest.NewRecorder()
			router.ServeHTTP(res, req)
			if res.Code != tc.want || called != (tc.want == 204) {
				t.Fatalf("status=%d called=%v body=%s", res.Code, called, res.Body.String())
			}
		})
	}
}
func TestContextPreservesDeadlineAndCancellation(t *testing.T) {
	parent, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	router := gin.New()
	router.Use(func(c *gin.Context) { c.Set("username", "owner"); c.Next() }, ContextInjectorMiddleware())
	router.GET("/", func(c *gin.Context) {
		deadline, ok := c.Request.Context().Deadline()
		if !ok || time.Until(deadline) > time.Second {
			t.Fatal("parent deadline lost")
		}
		cancel()
		if c.Request.Context().Err() != context.Canceled {
			t.Fatal("parent cancellation lost")
		}
		c.Status(204)
	})
	req := httptest.NewRequest("GET", "/", nil).WithContext(parent)
	router.ServeHTTP(httptest.NewRecorder(), req)
}
func TestFormatAbortAndOwnership(t *testing.T) {
	for _, tc := range []struct {
		body string
		want int
	}{
		{`{`, 400}, {`{"name":"Wallet","owner":"attacker","balance":10,"icon":"W"}`, 204},
	} {
		called := false
		router := gin.New()
		router.Use(func(c *gin.Context) { c.Set("username", "owner"); c.Next() })
		router.POST("/", AccountFormatMiddleware(), func(c *gin.Context) {
			called = true
			raw, _ := c.Get("account")
			if raw.(model.Account).Owner != "owner" {
				t.Fatal("client controlled owner")
			}
			c.Status(204)
		})
		req := httptest.NewRequest("POST", "/", strings.NewReader(tc.body))
		req.Header.Set("Content-Type", "application/json")
		res := httptest.NewRecorder()
		router.ServeHTTP(res, req)
		if res.Code != tc.want || called != (tc.want == 204) {
			t.Fatalf("invalid middleware chain: %d %s", res.Code, res.Body.String())
		}
	}
}
func TestOriginAndBodyGuards(t *testing.T) {
	for _, tc := range []struct {
		origin, bearer string
		want           int
	}{{"", "", 403}, {"https://evil.example", "", 403}, {"https://app.example", "", 204}, {"", "Bearer explicit", 204}} {
		router := gin.New()
		router.Use(OriginGuard([]string{"https://app.example"}))
		router.POST("/", func(c *gin.Context) { c.Status(204) })
		req := httptest.NewRequest("POST", "/", nil)
		req.Header.Set("Origin", tc.origin)
		req.Header.Set("Authorization", tc.bearer)
		res := httptest.NewRecorder()
		router.ServeHTTP(res, req)
		if res.Code != tc.want {
			t.Fatalf("origin guard=%d want=%d", res.Code, tc.want)
		}
	}
	router := gin.New()
	router.Use(SecurityHeaders())
	router.POST("/", func(c *gin.Context) { t.Fatal("oversized request reached handler") })
	res := httptest.NewRecorder()
	router.ServeHTTP(res, httptest.NewRequest("POST", "/", strings.NewReader(strings.Repeat("x", (1<<20)+1))))
	if res.Code != 413 || res.Header().Get("Cache-Control") != "no-store" {
		t.Fatal("request bound missing")
	}
}
func TestLimiterIsBoundedAndRefills(t *testing.T) {
	l := limiter{users: map[string]bucket{}, rate: 1, burst: 2, capacity: 1}
	now := time.Now()
	if l.allow("", now) || !l.allow("owner", now) || !l.allow("owner", now) || l.allow("owner", now) || l.allow("other", now) {
		t.Fatal("invalid quota or capacity")
	}
	if !l.allow("owner", now.Add(time.Second)) {
		t.Fatal("tokens did not refill")
	}
	if !l.allow("other", now.Add(11*time.Minute)) {
		t.Fatal("idle entry was not evicted")
	}
}
