package agent

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fintrack/server/config"
	"fintrack/server/telemetry"
	"fintrack/server/util"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type traceKey struct{}
type runTrace struct {
	mu                       sync.Mutex
	id, mode                 string
	outputTokens             int64
	calls, unknown, unpriced int64
	usage                    telemetry.AgentUsage
}

func traceFrom(ctx context.Context) *runTrace {
	trace, _ := ctx.Value(traceKey{}).(*runTrace)
	return trace
}
func runID(ctx context.Context) string {
	if t := traceFrom(ctx); t != nil {
		return t.id
	}
	return ""
}
func outputBudgetExceeded(ctx context.Context) bool {
	if t := traceFrom(ctx); t != nil {
		t.mu.Lock()
		defer t.mu.Unlock()
		return t.outputTokens > 8192
	}
	return false
}
func outcomeFor(err error) string {
	if err == nil {
		return "success"
	}
	var guard *guardError
	if errors.As(err, &guard) {
		return "blocked"
	}
	if errors.Is(err, context.Canceled) {
		return "canceled"
	}
	if errors.Is(err, context.DeadlineExceeded) {
		return "timeout"
	}
	if errors.Is(err, errToolUnavailable) {
		return "data_error"
	}
	if errors.Is(err, errChatLimit) {
		return "limit"
	}
	var argument *toolArgumentError
	if errors.As(err, &argument) {
		return "invalid_request"
	}
	return "error"
}
func observeTool(ctx context.Context, name string, started time.Time, err error) {
	name = telemetry.AgentSafeTool(name)
	outcome := outcomeFor(err)
	telemetry.AgentTool(name, outcome, time.Since(started))
	if t := traceFrom(ctx); t != nil {
		slog.InfoContext(ctx, "agent_tool", "run_id", t.id, "tool", name, "outcome", outcome, "duration_ms", time.Since(started).Milliseconds())
	}
}

// Gateway is shared by draft/chat. Identity comes from verified auth context;
// the active map never contains more than eight entries and is cleared on exit.
// This is a process-local concurrency limit, not a distributed billing quota.
func Gateway(cfg config.Config) gin.HandlerFunc {
	var mu sync.Mutex
	active := map[string]bool{}
	return func(c *gin.Context) {
		mode := "chat"
		if strings.HasSuffix(c.FullPath(), "/draft") {
			mode = "draft"
		}
		t := &runTrace{id: uuid.NewString(), mode: mode}
		c.Request = c.Request.WithContext(context.WithValue(c.Request.Context(), traceKey{}, t))
		c.Header("X-Agent-Run-ID", t.id)
		started := time.Now()
		completed := false
		defer func() {
			outcome := "success"
			switch code := c.Writer.Status(); {
			case !completed:
				outcome = "error"
			case code == 429:
				outcome = "rate_limited"
			case code == 504:
				outcome = "timeout"
			case code == 403:
				outcome = "blocked"
			case code == 400 || code == 413:
				outcome = "invalid_request"
			case code == 422:
				outcome = "limit"
			case code == 503:
				outcome = "disabled"
			case code >= 500:
				outcome = "provider_error"
			case code >= 400:
				outcome = "error"
			}
			if v, ok := c.Get("agent_outcome"); ok {
				if s, ok := v.(string); ok {
					outcome = telemetry.AgentSafeOutcome(s)
				}
			}
			if c.Request.Context().Err() != nil {
				outcome = outcomeFor(c.Request.Context().Err())
			}
			persistRun(c.Request.Context(), util.UserID(c.Request.Context()), t, cfg, outcome, time.Since(started))
			telemetry.AgentRequest(mode, outcome, time.Since(started))
			status := c.Writer.Status()
			if !completed && status < 400 {
				status = 500
			}
			slog.InfoContext(c.Request.Context(), "agent_request", "run_id", t.id, "mode", mode, "outcome", outcome, "status", status, "duration_ms", time.Since(started).Milliseconds())
		}()
		owner := util.UserID(c.Request.Context())
		if owner == "" {
			c.AbortWithStatus(401)
			completed = true
			return
		}
		mu.Lock()
		busy := len(active) >= 8 || active[owner]
		if !busy {
			active[owner] = true
		}
		mu.Unlock()
		if busy {
			c.Header("Retry-After", "10")
			c.AbortWithStatusJSON(429, gin.H{"error": "An assistant request is already running or capacity is full.", "code": "agent_busy", "runId": t.id})
			completed = true
			return
		}
		telemetry.AgentInFlight(1)
		defer func() { mu.Lock(); delete(active, owner); mu.Unlock(); telemetry.AgentInFlight(-1) }()
		raw, err := io.ReadAll(io.LimitReader(c.Request.Body, (64<<10)+1))
		if err != nil || len(raw) > 64<<10 {
			c.AbortWithStatus(413)
			completed = true
			return
		}
		if !uniqueJSON(raw) {
			telemetry.AgentGuard("invalid_json")
			c.AbortWithStatusJSON(400, gin.H{"error": "Invalid or ambiguous JSON request.", "code": "invalid_json", "runId": t.id})
			completed = true
			return
		}
		// Scan decoded user-provided strings, including escaped JSON content and
		// history. Never scan/log headers containing legitimate bearer credentials.
		var input any
		_ = json.Unmarshal(raw, &input)
		if err := scanUserJSON(input); err != nil {
			writeGuardError(c, err)
			completed = true
			return
		}
		c.Request.Body = io.NopCloser(bytes.NewReader(raw))
		c.Next()
		completed = true
	}
}
func scanUserJSON(value any) error {
	switch v := value.(type) {
	case string:
		return checkUserText(v)
	case []any:
		for _, item := range v {
			if err := scanUserJSON(item); err != nil {
				return err
			}
		}
	case map[string]any:
		for key, item := range v {
			if err := checkUserText(key); err != nil {
				return err
			}
			if err := scanUserJSON(item); err != nil {
				return err
			}
		}
	}
	return nil
}
func writeGuardError(c *gin.Context, err error) {
	var guard *guardError
	if !errors.As(err, &guard) {
		c.AbortWithStatus(500)
		return
	}
	c.Set("agent_outcome", "blocked")
	status, message := http.StatusUnprocessableEntity, "The assistant stopped this request. Narrow the request and try again."
	switch guard.code {
	case "sensitive_input":
		status, message = 400, "Remove passwords, API keys, connection credentials, or tokens before using the assistant."
	case "invalid_text":
		status, message = 400, "Remove invisible control or direction-override characters from the request."
	case "changes_not_enabled":
		status, message = 403, "Enable change proposals before requesting a record change."
	case "deletes_not_enabled":
		status, message = 403, "Enable delete/archive proposals before requesting deletion."
	case "unverified_record":
		message = "The assistant must look up the affected records in this request before preparing a change. Try naming the record and requested change explicitly."
	case "sensitive_output":
		message = "The assistant response was withheld because it may contain credentials. No change was submitted."
	}
	c.AbortWithStatusJSON(status, gin.H{"error": message, "code": guard.code, "runId": runID(c.Request.Context())})
}

func providerClient(cfg config.Config) *http.Client {
	return &http.Client{Timeout: 18 * time.Second, Transport: observedTransport{base: http.DefaultTransport, pricing: cfg.AgentPricing}, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}
}

type observedTransport struct {
	base    http.RoundTripper
	pricing config.AgentPricing
}

func (o observedTransport) RoundTrip(req *http.Request) (response *http.Response, err error) {
	started := time.Now()
	outcome := "provider_error"
	usage := telemetry.AgentUsage{}
	mode := "chat"
	attempted := false
	t := traceFrom(req.Context())
	if t != nil {
		mode = t.mode
	}
	defer func() {
		if !attempted {
			return
		}
		if err != nil {
			outcome = outcomeFor(err)
			if outcome == "error" {
				outcome = "provider_error"
			}
		}
		telemetry.AgentProvider(mode, outcome, time.Since(started), usage)
		if t != nil {
			t.mu.Lock()
			t.calls++
			if !usage.Known {
				t.unknown++
			}
			if !usage.CostKnown {
				t.unpriced++
			} else {
				t.usage.CostNanoUSD += usage.CostNanoUSD
			}
			if usage.Known {
				t.outputTokens += usage.Output + usage.Thinking
				t.usage.Prompt += usage.Prompt
				t.usage.Cached += usage.Cached
				t.usage.Output += usage.Output
				t.usage.Thinking += usage.Thinking
				t.usage.Total += usage.Total
			}
			t.mu.Unlock()
			slog.InfoContext(req.Context(), "agent_provider", "run_id", t.id, "mode", mode, "outcome", outcome, "duration_ms", time.Since(started).Milliseconds(), "usage_known", usage.Known, "prompt_tokens", usage.Prompt, "cached_tokens", usage.Cached, "output_tokens", usage.Output, "thinking_tokens", usage.Thinking, "cost_known", usage.CostKnown, "estimated_cost_nano_usd", usage.CostNanoUSD)
		}
	}()
	if req.ContentLength < 0 || req.ContentLength > maxProviderRequestBytes {
		return nil, deny("provider_request_limit")
	}
	if outputBudgetExceeded(req.Context()) {
		return nil, deny("output_token_limit")
	}
	base := o.base
	if base == nil {
		base = http.DefaultTransport
	}
	attempted = true
	response, err = base.RoundTrip(req)
	if err != nil {
		return nil, err
	}
	raw, readErr := io.ReadAll(io.LimitReader(response.Body, (128<<10)+1))
	_ = response.Body.Close()
	if readErr != nil {
		return nil, readErr
	}
	if len(raw) > 128<<10 {
		return nil, errors.New("provider response too large")
	}
	response.Body = io.NopCloser(bytes.NewReader(raw))
	usage = parseUsage(raw, o.pricing)
	if response.StatusCode == 200 {
		outcome = "success"
		var envelope struct {
			PromptFeedback struct {
				BlockReason string `json:"blockReason"`
			} `json:"promptFeedback"`
			Candidates []struct {
				Finish string `json:"finishReason"`
			} `json:"candidates"`
		}
		if json.Unmarshal(raw, &envelope) != nil {
			outcome = "provider_error"
		} else if envelope.PromptFeedback.BlockReason != "" {
			outcome = "blocked"
		} else if len(envelope.Candidates) != 1 {
			outcome = "provider_error"
		} else if envelope.Candidates[0].Finish != "STOP" {
			switch envelope.Candidates[0].Finish {
			case "SAFETY", "RECITATION", "BLOCKLIST", "PROHIBITED_CONTENT", "SPII":
				outcome = "blocked"
			case "MAX_TOKENS":
				outcome = "limit"
			default:
				outcome = "provider_error"
			}
		}
	}
	return response, nil
}
func parseUsage(raw []byte, prices config.AgentPricing) telemetry.AgentUsage {
	var e struct {
		Usage *struct {
			Prompt     *int64 `json:"promptTokenCount"`
			Cached     int64  `json:"cachedContentTokenCount"`
			Output     int64  `json:"candidatesTokenCount"`
			Thinking   int64  `json:"thoughtsTokenCount"`
			Total      *int64 `json:"totalTokenCount"`
			ToolPrompt int64  `json:"toolUsePromptTokenCount"`
		} `json:"usageMetadata"`
	}
	if !uniqueJSON(raw) || json.Unmarshal(raw, &e) != nil || e.Usage == nil || e.Usage.Prompt == nil || e.Usage.Total == nil {
		return telemetry.AgentUsage{}
	}
	u := e.Usage
	for _, n := range []int64{*u.Prompt, u.Cached, u.Output, u.Thinking, *u.Total, u.ToolPrompt} {
		if n < 0 || n > 10_000_000 {
			return telemetry.AgentUsage{}
		}
	}
	if u.Cached > *u.Prompt || *u.Total < *u.Prompt+u.Output+u.Thinking {
		return telemetry.AgentUsage{}
	}
	out := telemetry.AgentUsage{Known: true, Prompt: *u.Prompt, Cached: u.Cached, Output: u.Output, Thinking: u.Thinking, Total: *u.Total}
	// No guessed price when a tariff/usage component is unknown. Built-in paid
	// tools are not used; unexpected tool-use prompt billing stays unpriced.
	if prices.Configured && u.ToolPrompt == 0 {
		out.CostKnown = true
		microPriceTokens := (*u.Prompt-u.Cached)*prices.Input + u.Cached*prices.Cached + (u.Output+u.Thinking)*prices.Output
		out.CostNanoUSD = uint64((microPriceTokens + 999) / 1000)
	}
	return out
}

// Persist only provider-use metadata. Bounded best-effort recording after a
// canceled request does not resurrect a model request or a financial mutation.
// Failure increments a loss metric; this is operational accounting, not billing.
func persistRun(parent context.Context, owner string, t *runTrace, cfg config.Config, outcome string, elapsed time.Duration) {
	t.mu.Lock()
	defer t.mu.Unlock()
	if t.calls == 0 {
		return
	}
	if util.DB == nil {
		telemetry.AgentUsageWriteFailure()
		return
	}
	ctx, cancel := context.WithTimeout(context.WithoutCancel(parent), 2*time.Second)
	defer cancel()
	_, err := util.DB.ExecContext(ctx, `INSERT INTO agent_usage
        (run_id,owner,mode,model,outcome,provider_calls,unknown_usage_calls,unpriced_calls,
         prompt_tokens,cached_tokens,output_tokens,thinking_tokens,total_tokens,estimated_cost_nano_usd,
         input_price_micro_usd,cached_price_micro_usd,output_price_micro_usd,duration_ms)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
        ON CONFLICT (run_id) DO NOTHING`, t.id, owner, t.mode, cfg.AgentModel, telemetry.AgentSafeOutcome(outcome),
		t.calls, t.unknown, t.unpriced, t.usage.Prompt, t.usage.Cached, t.usage.Output,
		t.usage.Thinking, t.usage.Total, int64(t.usage.CostNanoUSD), cfg.AgentPricing.Input,
		cfg.AgentPricing.Cached, cfg.AgentPricing.Output, max(elapsed.Milliseconds(), 0))
	if err != nil {
		telemetry.AgentUsageWriteFailure()
		slog.WarnContext(ctx, "agent_usage_persist_failed", "run_id", t.id)
		return
	}
	// Bounded opportunistic 90-day retention, using the recorded_at index.
	if _, err := util.DB.ExecContext(ctx, `DELETE FROM agent_usage WHERE run_id IN
        (SELECT run_id FROM agent_usage WHERE recorded_at < now()-interval '90 days' ORDER BY recorded_at LIMIT 100)`); err != nil {
		telemetry.AgentUsageWriteFailure()
		slog.WarnContext(ctx, "agent_usage_retention_failed", "run_id", t.id)
	}
}
