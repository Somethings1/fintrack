package agent

import (
	"bytes"
	"context"
	"errors"
	"fintrack/server/config"
	"fintrack/server/util"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

func TestUsageSeparatesCachedAndThinkingAndUnknownCost(t *testing.T) {
	prices := config.AgentPricing{Configured: true, Input: 100000, Cached: 10000, Output: 400000}
	raw := []byte(`{"usageMetadata":{"promptTokenCount":1000,"cachedContentTokenCount":200,"candidatesTokenCount":50,"thoughtsTokenCount":25,"totalTokenCount":1075}}`)
	u := parseUsage(raw, prices)
	if !u.Known || !u.CostKnown || u.CostNanoUSD != 112000 || u.Prompt != 1000 || u.Cached != 200 || u.Output != 50 || u.Thinking != 25 || u.Total != 1075 {
		t.Fatalf("bad usage: %+v", u)
	}
	if u := parseUsage(raw, config.AgentPricing{}); !u.Known || u.CostKnown {
		t.Fatalf("unconfigured tariff treated as free: %+v", u)
	}
	if u := parseUsage(raw, config.AgentPricing{Configured: true}); !u.CostKnown || u.CostNanoUSD != 0 {
		t.Fatal("explicit zero tariff lost")
	}
	for _, raw := range []string{`{}`, `{"usageMetadata":{}}`, `{"usageMetadata":{"promptTokenCount":null,"totalTokenCount":0}}`, `{"usageMetadata":{"promptTokenCount":-1,"totalTokenCount":0}}`, `{"usageMetadata":{"promptTokenCount":1,"cachedContentTokenCount":2,"totalTokenCount":1}}`, `{"usageMetadata":{"promptTokenCount":10,"candidatesTokenCount":5,"totalTokenCount":11}}`, `{"usageMetadata":{"promptTokenCount":1,"promptTokenCount":2,"totalTokenCount":2}}`, `{"usageMetadata":{"promptTokenCount":10000001,"totalTokenCount":10000001}}`} {
		if u := parseUsage([]byte(raw), prices); u.Known || u.CostKnown {
			t.Fatalf("invalid usage accepted: %s", raw)
		}
	}
	other := []byte(`{"usageMetadata":{"promptTokenCount":10,"toolUsePromptTokenCount":2,"totalTokenCount":12}}`)
	if u := parseUsage(other, prices); !u.Known || u.CostKnown {
		t.Fatal("unexpected billing component was priced")
	}
}

func TestObservedProviderRestoresBodyAndLogsOnlyMetadata(t *testing.T) {
	var logs bytes.Buffer
	previous := slog.Default()
	slog.SetDefault(slog.New(slog.NewJSONHandler(&logs, nil)))
	defer slog.SetDefault(previous)
	trace := &runTrace{id: uuid.NewString(), mode: "chat"}
	ctx := context.WithValue(context.Background(), traceKey{}, trace)
	body := `{"candidates":[{"finishReason":"STOP","content":{"parts":[{"text":"private-financial-answer"}]}}],"usageMetadata":{"promptTokenCount":10,"candidatesTokenCount":2,"totalTokenCount":12}}`
	attempted := 0
	transport := observedTransport{pricing: config.AgentPricing{Configured: true, Input: 100000, Output: 400000}, base: roundTripFunc(func(r *http.Request) (*http.Response, error) {
		attempted++
		if r.Header.Get("x-goog-api-key") != "private-provider-key" {
			t.Error("key was not sent to configured provider")
		}
		return &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader(body)), Header: make(http.Header)}, nil
	})}
	req := httptest.NewRequest("POST", "https://provider.example/private-url", strings.NewReader("private-input")).WithContext(ctx)
	req.Header.Set("x-goog-api-key", "private-provider-key")
	resp, err := transport.RoundTrip(req)
	if err != nil {
		t.Fatal(err)
	}
	restored, err := io.ReadAll(resp.Body)
	_ = resp.Body.Close()
	if err != nil || string(restored) != body {
		t.Fatal("provider body was consumed rather than restored")
	}
	if trace.calls != 1 || trace.unknown != 0 || trace.unpriced != 0 || trace.outputTokens != 2 || trace.usage.Total != 12 || attempted != 1 {
		t.Fatalf("bad trace: %+v", trace)
	}
	if !strings.Contains(logs.String(), trace.id) || !strings.Contains(logs.String(), `"usage_known":true`) {
		t.Fatal("missing correlation or usage")
	}
	for _, secret := range []string{"private-provider-key", "private-financial-answer", "private-input", "private-url"} {
		if strings.Contains(logs.String(), secret) {
			t.Fatalf("content leaked into log: %s", secret)
		}
	}
	trace.outputTokens = 8193
	_, err = transport.RoundTrip(req)
	requireGuard(t, err, "output_token_limit")
	if attempted != 1 || trace.calls != 1 {
		t.Fatal("local denial counted as provider use")
	}
	trace.outputTokens = 0
	req.ContentLength = maxProviderRequestBytes + 1
	_, err = transport.RoundTrip(req)
	requireGuard(t, err, "provider_request_limit")
	if attempted != 1 || trace.calls != 1 {
		t.Fatal("oversize request reached provider")
	}
}

func TestGatewayRejectsCredentialsAndAmbiguousInputWithoutEcho(t *testing.T) {
	gin.SetMode(gin.TestMode)
	var logs bytes.Buffer
	previous := slog.Default()
	slog.SetDefault(slog.New(slog.NewJSONHandler(&logs, nil)))
	defer slog.SetDefault(previous)
	called := 0
	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Request = c.Request.WithContext(context.WithValue(c.Request.Context(), util.UserIdKey, "private-owner-id"))
		c.Next()
	})
	router.POST("/agent/message", Gateway(config.Config{}), func(c *gin.Context) { called++; c.JSON(200, gin.H{"runId": runID(c.Request.Context())}) })
	for _, body := range []string{`{"input":"password=never-log-this"}`, `{"input":"hello","input":"other"}`, `{"history":[{"content":"access_token=do-not-log"}]}`, `{"input":"bad\u202etext"}`} {
		req := httptest.NewRequest("POST", "/agent/message", strings.NewReader(body))
		req.Header.Set("X-Agent-Run-ID", "attacker-run-id")
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)
		if w.Code != 400 {
			t.Fatalf("unexpected status %d: %s", w.Code, w.Body.String())
		}
		if _, err := uuid.Parse(w.Header().Get("X-Agent-Run-ID")); err != nil {
			t.Fatal("no server run ID")
		}
		if strings.Contains(w.Body.String(), "never-log-this") || strings.Contains(w.Body.String(), "do-not-log") {
			t.Fatal("credentials echoed")
		}
	}
	if called != 0 {
		t.Fatal("blocked input reached handler")
	}
	for _, text := range []string{"never-log-this", "do-not-log", "private-owner-id", "attacker-run-id"} {
		if strings.Contains(logs.String(), text) {
			t.Fatalf("private log content: %s", text)
		}
	}
	w := httptest.NewRecorder()
	router.ServeHTTP(w, httptest.NewRequest("POST", "/agent/message", strings.NewReader(`{"input":"hello"}`)))
	if w.Code != 200 || called != 1 {
		t.Fatal("rejections leaked an active slot")
	}
}

func TestGatewayConcurrencySharedAcrossChatAndDraft(t *testing.T) {
	gin.SetMode(gin.TestMode)
	gateway := Gateway(config.Config{})
	entered := make(chan struct{}, 16)
	release := make(chan struct{})
	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Request = c.Request.WithContext(context.WithValue(c.Request.Context(), util.UserIdKey, c.GetHeader("Test-Owner")))
		c.Next()
	})
	handler := func(c *gin.Context) {
		entered <- struct{}{}
		select {
		case <-release:
			c.Status(200)
		case <-c.Request.Context().Done():
			c.Status(499)
		}
	}
	router.POST("/agent/message", gateway, handler)
	router.POST("/agent/draft", gateway, handler)
	send := func(ctx context.Context, owner, path string) *httptest.ResponseRecorder {
		r := httptest.NewRequest("POST", path, strings.NewReader(`{}`)).WithContext(ctx)
		r.Header.Set("Test-Owner", owner)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, r)
		return w
	}
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	done := make(chan *httptest.ResponseRecorder, 8)
	go func() { done <- send(ctx, "a", "/agent/message") }()
	select {
	case <-entered:
	case <-time.After(3 * time.Second):
		t.Fatal("first request did not start")
	}
	if w := send(context.Background(), "a", "/agent/draft"); w.Code != 429 || w.Header().Get("Retry-After") == "" {
		t.Fatal("same actor concurrency not blocked across routes")
	}
	for i := 0; i < 7; i++ {
		owner := string(rune('b' + i))
		go func() { done <- send(ctx, owner, "/agent/message") }()
		select {
		case <-entered:
		case <-time.After(3 * time.Second):
			t.Fatal("slot did not start")
		}
	}
	if w := send(context.Background(), "ninth", "/agent/draft"); w.Code != 429 {
		t.Fatal("global bound ignored")
	}
	cancel()
	for i := 0; i < 8; i++ {
		select {
		case <-done:
		case <-time.After(3 * time.Second):
			t.Fatal("cancellation did not release request")
		}
	}
	close(release)
	if w := send(context.Background(), "a", "/agent/draft"); w.Code != 200 {
		t.Fatal("canceled request leaked slot")
	}
}

func TestProviderSafetyAndFailedAttemptUsage(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{"promptFeedback":{"blockReason":"SAFETY"}}`))
	}))
	defer server.Close()
	_, err := (provider{client: server.Client(), endpoint: server.URL}).Generate(context.Background(), "system", nil, true)
	requireGuard(t, err, "provider_safety")
	transport := observedTransport{base: roundTripFunc(func(*http.Request) (*http.Response, error) { return nil, context.DeadlineExceeded })}
	trace := &runTrace{id: uuid.NewString(), mode: "draft"}
	req := httptest.NewRequest("POST", "https://provider.example", strings.NewReader(`{}`)).WithContext(context.WithValue(context.Background(), traceKey{}, trace))
	_, err = transport.RoundTrip(req)
	if !errors.Is(err, context.DeadlineExceeded) || trace.calls != 1 || trace.unknown != 1 || trace.unpriced != 1 {
		t.Fatal("failed attempt was not recorded as unknown usage")
	}
}
