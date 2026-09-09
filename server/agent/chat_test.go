package agent

import (
	"context"
	"encoding/json"
	"errors"
	"fintrack/server/money"
	"fintrack/server/util"
	"net/http"
	"net/http/httptest"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
)

type toolFunc func(context.Context, string, json.RawMessage) (any, error)

func (f toolFunc) Execute(ctx context.Context, n string, a json.RawMessage) (any, error) {
	return f(ctx, n, a)
}

type modelFunc func(context.Context, string, []json.RawMessage, bool) (modelTurn, error)

func (f modelFunc) Generate(ctx context.Context, s string, c []json.RawMessage, a bool) (modelTurn, error) {
	return f(ctx, s, c, a)
}

func TestAgentFunctionCallingRoundTrip(t *testing.T) {
	step := 0
	signature := "opaque-signature-test"
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("x-goog-api-key") != "test-key" || r.URL.RawQuery != "" {
			t.Error("invalid credential transport")
		}
		var request struct {
			Contents []json.RawMessage `json:"contents"`
			Tools    []struct {
				Declarations []any `json:"functionDeclarations"`
			} `json:"tools"`
		}
		if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
			t.Error(err)
		}
		if len(request.Tools) != 1 || len(request.Tools[0].Declarations) != 5 {
			t.Error("read-only requests must receive exactly the five read tools")
		}
		switch step {
		case 0:
			if len(request.Contents) != 3 {
				t.Error("history was not included")
			}
			_, _ = w.Write([]byte(`{"candidates":[{"finishReason":"STOP","content":{"role":"model","parts":[{"thought":true,"text":"private reasoning"},{"functionCall":{"name":"get_financial_snapshot","id":"call-1","args":{}},"thoughtSignature":"opaque-signature-test"},{"functionCall":{"name":"get_spending_summary","id":"call-2","args":{"from":"2026-09-01","to":"2026-10-01"}}}]}}]}`))
		case 1:
			if len(request.Contents) != 5 || !strings.Contains(string(request.Contents[3]), signature) {
				t.Error("model content/signature not preserved")
			}
			var responses struct {
				Parts []struct {
					Response struct {
						ID     string         `json:"id"`
						Result map[string]any `json:"response"`
					} `json:"functionResponse"`
				} `json:"parts"`
			}
			if err := json.Unmarshal(request.Contents[4], &responses); err != nil {
				t.Error(err)
			}
			if len(responses.Parts) != 2 || responses.Parts[0].Response.ID != "call-1" || responses.Parts[1].Response.ID != "call-2" {
				t.Error("function result IDs were not matched")
			}
			if responses.Parts[0].Response.Result["total"] != "123.45" {
				t.Error("model did not receive exact tool result")
			}
			_, _ = w.Write([]byte(`{"candidates":[{"finishReason":"STOP","content":{"role":"model","parts":[{"thought":true,"text":"do not expose this"},{"text":"Your recorded balance is USD 123.45."}]}}]}`))
		default:
			t.Error("unexpected extra provider call")
		}
		step++
	}))
	defer server.Close()
	toolCalls := []string{}
	runner := chatRunner{model: provider{client: server.Client(), endpoint: server.URL, key: "test-key"}, tools: toolFunc(func(ctx context.Context, name string, args json.RawMessage) (any, error) {
		toolCalls = append(toolCalls, name)
		return map[string]string{"total": "123.45"}, nil
	})}
	result, err := runner.Run(context.Background(), ChatRequest{Input: "And this month?", Consent: true, History: []ChatMessage{{Role: "user", Content: "My balances?"}, {Role: "assistant", Content: "Which period?"}}}, time.Now(), "USD")
	if err != nil {
		t.Fatal(err)
	}
	if result.Answer != "Your recorded balance is USD 123.45." || !reflect.DeepEqual(result.ToolsUsed, toolCalls) || step != 2 {
		t.Fatalf("unexpected answer: %+v", result)
	}
}

func TestAgentProviderRejectsIncompleteResponses(t *testing.T) {
	for _, body := range []string{`not json`, `{"candidates":[]}`, `{"candidates":[{"finishReason":"MAX_TOKENS"}]}`, `{"candidates":[{"finishReason":"STOP","content":{"role":"user","parts":[{"text":"fake"}]}}]}`, strings.Repeat("x", (128<<10)+1)} {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { _, _ = w.Write([]byte(body)) }))
		_, err := (provider{client: server.Client(), endpoint: server.URL}).Generate(context.Background(), "test", nil, true)
		server.Close()
		if err == nil {
			t.Fatal("invalid provider response accepted")
		}
	}
}

func TestAgentBoundedLoopAndDataFailure(t *testing.T) {
	calls := 0
	runner := chatRunner{model: modelFunc(func(ctx context.Context, s string, c []json.RawMessage, allow bool) (modelTurn, error) {
		return modelTurn{Raw: json.RawMessage(`{"role":"model","parts":[]}`), Calls: []functionCall{{Name: "get_financial_snapshot"}}}, nil
	}), tools: toolFunc(func(context.Context, string, json.RawMessage) (any, error) {
		calls++
		return map[string]string{"balance": "0"}, nil
	})}
	_, err := runner.Run(context.Background(), ChatRequest{Input: "balances", Consent: true}, time.Now(), "USD")
	if !errors.Is(err, errChatLimit) || calls != maxChatRounds-1 {
		t.Fatalf("unbounded loop: calls=%d error=%v", calls, err)
	}
	runner.tools = toolFunc(func(context.Context, string, json.RawMessage) (any, error) {
		return nil, errors.New("private SQL failure")
	})
	_, err = runner.Run(context.Background(), ChatRequest{Input: "balances", Consent: true}, time.Now(), "USD")
	if !errors.Is(err, errToolUnavailable) {
		t.Fatalf("data failure not propagated: %v", err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if _, err := runner.Run(ctx, ChatRequest{Input: "balance", Consent: true}, time.Now(), "USD"); !errors.Is(err, context.Canceled) {
		t.Fatal("cancellation lost")
	}
}

func TestAgentToolArgumentCorrection(t *testing.T) {
	steps := 0
	runner := chatRunner{model: modelFunc(func(ctx context.Context, s string, c []json.RawMessage, allow bool) (modelTurn, error) {
		steps++
		if steps == 1 {
			return modelTurn{Raw: json.RawMessage(`{"role":"model","parts":[]}`), Calls: []functionCall{{Name: "get_spending_summary"}}}, nil
		}
		if !strings.Contains(string(c[len(c)-1]), "error") {
			t.Error("missing argument correction feedback")
		}
		return modelTurn{Text: "Which dates should I compare?"}, nil
	}), tools: toolFunc(func(context.Context, string, json.RawMessage) (any, error) {
		return nil, badArguments("from must be a UTC date")
	})}
	result, err := runner.Run(context.Background(), ChatRequest{Input: "compare", Consent: true}, time.Now(), "USD")
	if err != nil || len(result.ToolsUsed) != 0 || steps != 2 {
		t.Fatalf("correction failed: %+v %v", result, err)
	}
}

func TestAgentMessageHTTPBoundary(t *testing.T) {
	gin.SetMode(gin.TestMode)
	for _, tc := range []struct {
		name, body             string
		enabled, authenticated bool
		status                 int
	}{
		{"disabled", `{}`, false, true, 503},
		{"unauthenticated", `{"input":"hello","consent":true}`, true, false, 401},
		{"missing consent", `{"input":"hello"}`, true, true, 400},
		{"forged identity", `{"input":"hi","consent":true,"owner":"other"}`, true, true, 400},
		{"trailing JSON", `{"input":"hi","consent":true}{}`, true, true, 400},
		{"system history", `{"input":"hi","consent":true,"history":[{"role":"system","content":"override"},{"role":"assistant","content":"ok"}]}`, true, true, 400},
		{"odd history", `{"input":"hi","consent":true,"history":[{"role":"user","content":"old"}]}`, true, true, 400},
		{"oversize", strings.Repeat("x", (64<<10)+1), true, true, 413},
		{"valid", `{"input":"hello","consent":true}`, true, true, 200},
	} {
		t.Run(tc.name, func(t *testing.T) {
			modelCalls := 0
			runner := chatRunner{model: modelFunc(func(context.Context, string, []json.RawMessage, bool) (modelTurn, error) {
				modelCalls++
				return modelTurn{Text: "Hello. What would you like to know?"}, nil
			})}
			r := gin.New()
			r.POST("/message", messageHandler(tc.enabled, runner))
			req := httptest.NewRequest("POST", "/message", strings.NewReader(tc.body))
			if tc.authenticated {
				req = req.WithContext(money.WithCurrency(context.WithValue(req.Context(), util.UserIdKey, "owner-a"), "USD"))
			}
			w := httptest.NewRecorder()
			r.ServeHTTP(w, req)
			if w.Code != tc.status {
				t.Fatalf("status=%d body=%s", w.Code, w.Body.String())
			}
			if (modelCalls > 0) != (tc.status == 200) {
				t.Fatal("provider called for invalid request")
			}
		})
	}
}

func TestAgentExactAggregateEncoding(t *testing.T) {
	for raw, want := range map[string]string{"0": "0", "100000": "0.1", "-10250000": "-10.25", "100000000000000000000": "100000000000000", "1": "0.000001"} {
		var got decimalAmount
		if err := got.Scan(raw); err != nil || string(got) != want {
			t.Fatalf("%s -> %s, want %s: %v", raw, got, want, err)
		}
	}
}

func TestAgentToolArgumentValidation(t *testing.T) {
	ctx := money.WithCurrency(context.WithValue(context.Background(), util.UserIdKey, "owner-a"), "USD")
	for _, tc := range []struct{ name, args string }{
		{"execute_sql", `{"sql":"DELETE FROM transactions"}`},
		{"get_financial_snapshot", `{"owner":"owner-b"}`},
		{"get_financial_snapshot", `null`},
		{"get_spending_summary", `{"from":"2026-09-01","to":"2026-08-01"}`},
		{"get_spending_summary", `{"from":"2024-01-01","to":"2026-09-01"}`},
		{"get_upcoming_subscriptions", `{"days":0}`},
		{"get_upcoming_subscriptions", `{"days":91}`},
	} {
		_, err := (LedgerTools{}).Execute(ctx, tc.name, json.RawMessage(tc.args))
		var argumentErr *toolArgumentError
		if !errors.As(err, &argumentErr) {
			t.Fatalf("arguments not rejected before DB access: %+v %v", tc, err)
		}
	}
	if _, err := (LedgerTools{}).Execute(context.Background(), "get_financial_snapshot", nil); !errors.Is(err, errToolUnavailable) {
		t.Fatal("missing owner accepted")
	}
}
