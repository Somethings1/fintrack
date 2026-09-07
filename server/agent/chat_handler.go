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

func MessageHandler(cfg config.Config) gin.HandlerFunc {
	p := provider{endpoint: "https://generativelanguage.googleapis.com/v1beta/models/" + cfg.AgentModel + ":generateContent", key: cfg.AgentKey, client: providerClient(cfg)}
	handler := messageHandler(cfg.AgentEnabled, chatRunner{model: p, tools: WorkspaceTools{LedgerTools: LedgerTools{DB: util.DB}}})
	return func(c *gin.Context) { c.Set("agent_changes_disabled", cfg.AgentChangesDisabled); handler(c) }
}
func messageHandler(enabled bool, runner chatRunner) gin.HandlerFunc {
	return func(c *gin.Context) {
		if !enabled {
			c.Set("agent_outcome", "disabled")
			c.AbortWithStatusJSON(503, gin.H{"error": "AI assistant is disabled", "runId": runID(c.Request.Context())})
			return
		}
		if util.UserID(c.Request.Context()) == "" {
			c.AbortWithStatus(401)
			return
		}
		raw, err := io.ReadAll(io.LimitReader(c.Request.Body, (64<<10)+1))
		if err != nil || len(raw) > 64<<10 {
			c.AbortWithStatus(413)
			return
		}
		var request ChatRequest
		if !uniqueJSON(raw) || decodeStrict(raw, &request) != nil {
			c.AbortWithStatusJSON(400, gin.H{"error": "Provide a valid bounded request with no unknown or duplicate fields."})
			return
		}
		if err := request.validate(); err != nil {
			var guard *guardError
			if errors.As(err, &guard) {
				writeGuardError(c, err)
			} else {
				c.AbortWithStatusJSON(400, gin.H{"error": "Provide a question, explicit consent, and valid permissions/history."})
			}
			return
		}
		if request.AllowChanges && c.GetBool("agent_changes_disabled") {
			writeGuardError(c, deny("changes_not_enabled"))
			return
		}
		ctx, cancel := context.WithTimeout(c.Request.Context(), 20*time.Second)
		defer cancel()
		result, err := runner.Run(ctx, request, time.Now().UTC(), money.Currency(ctx))
		if err != nil {
			c.Set("agent_outcome", outcomeFor(err))
			var guard *guardError
			if errors.As(err, &guard) {
				writeGuardError(c, err)
				return
			}
			status, message := http.StatusBadGateway, "The assistant could not complete this question. No records were changed."
			if errors.Is(ctx.Err(), context.DeadlineExceeded) || errors.Is(err, context.DeadlineExceeded) {
				status, message = http.StatusGatewayTimeout, "The assistant timed out. Try a narrower question."
			} else if errors.Is(err, errChatLimit) {
				status, message = http.StatusUnprocessableEntity, "This question needs too many steps. Try a narrower question."
			} else if errors.Is(err, errToolUnavailable) {
				status, message = http.StatusServiceUnavailable, "Financial data is temporarily unavailable."
			}
			c.AbortWithStatusJSON(status, gin.H{"error": message, "runId": runID(ctx)})
			return
		}
		if result.Proposal != nil {
			c.Set("agent_outcome", "proposed")
		}
		c.JSON(200, result)
	}
}
