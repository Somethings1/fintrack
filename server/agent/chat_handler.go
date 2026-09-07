package agent

import (
	"context"
	"errors"
	"fintrack/server/config"
	"fintrack/server/money"
	"fintrack/server/util"
	"io"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

// MessageHandler adds investigation, not mutation, to the existing draft flow.
// Enabling it uses the same explicitly configured Gemini model and credentials.
func MessageHandler(cfg config.Config) gin.HandlerFunc {
	p := provider{
		endpoint: "https://generativelanguage.googleapis.com/v1beta/models/" + cfg.AgentModel + ":generateContent",
		key:      cfg.AgentKey,
		client:   &http.Client{Timeout: 18 * time.Second, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }},
	}
	return messageHandler(cfg.AgentEnabled, chatRunner{model: p, tools: LedgerTools{DB: util.DB}})
}

func messageHandler(enabled bool, runner chatRunner) gin.HandlerFunc {
	slots := make(chan struct{}, 8)
	return func(c *gin.Context) {
		if !enabled {
			c.AbortWithStatusJSON(http.StatusServiceUnavailable, gin.H{"error": "AI assistant is disabled"})
			return
		}
		if util.UserID(c.Request.Context()) == "" {
			c.AbortWithStatus(http.StatusUnauthorized)
			return
		}
		raw, err := io.ReadAll(io.LimitReader(c.Request.Body, (64<<10)+1))
		if err != nil || len(raw) > 64<<10 {
			c.AbortWithStatus(http.StatusRequestEntityTooLarge)
			return
		}
		var request ChatRequest
		if decodeStrict(raw, &request) != nil || request.validate() != nil {
			c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "provide a question, explicit AI consent, and valid bounded history"})
			return
		}
		select {
		case slots <- struct{}{}:
			defer func() { <-slots }()
		default:
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{"error": "agent is busy"})
			return
		}
		ctx, cancel := context.WithTimeout(c.Request.Context(), 20*time.Second)
		defer cancel()
		result, err := runner.Run(ctx, request, time.Now().UTC(), money.Currency(ctx))
		if err != nil {
			status, message := http.StatusBadGateway, "The assistant could not complete this question. No records were changed."
			if errors.Is(ctx.Err(), context.DeadlineExceeded) || errors.Is(err, context.DeadlineExceeded) {
				status, message = http.StatusGatewayTimeout, "The assistant timed out. Try a narrower question."
			} else if errors.Is(err, errChatLimit) {
				status, message = http.StatusUnprocessableEntity, "This question needs too many steps. Try a narrower question."
			} else if errors.Is(err, errToolUnavailable) {
				status, message = http.StatusServiceUnavailable, "Financial data is temporarily unavailable."
			}
			c.AbortWithStatusJSON(status, gin.H{"error": message})
			return
		}
		c.JSON(http.StatusOK, result)
	}
}
