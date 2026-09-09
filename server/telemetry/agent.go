package telemetry

import (
	"fmt"
	"io"
	"strings"
	"sync"
	"time"
)

// All labels are enumerated here. In particular no actor, run ID, record ID,
// model-generated name, text, URL, token or error message may become a label.
var agentOutcomes = []string{"success", "proposed", "blocked", "invalid_request", "provider_error", "data_error", "timeout", "canceled", "rate_limited", "disabled", "limit", "error"}
var agentToolNames = []string{"get_financial_snapshot", "get_spending_summary", "get_savings_goals", "get_upcoming_subscriptions", "find_records", "propose_transaction", "propose_account", "propose_saving", "propose_category", "propose_budget", "propose_subscription", "unknown"}
var agentGuardReasons = []string{"invalid_text", "sensitive_input", "sensitive_output", "provider_safety", "unknown_tool", "invalid_tool_arguments", "changes_not_enabled", "deletes_not_enabled", "unverified_record", "invalid_tool_limit", "tool_result_limit", "provider_request_limit", "tool_data_redacted", "invalid_json", "output_token_limit", "other"}
var latencyBounds = []float64{0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 20, 30}

type agentSeries struct {
	counts  map[string]uint64
	micros  uint64
	buckets []uint64
}
type AgentUsage struct {
	Known                                   bool
	Prompt, Cached, Output, Thinking, Total int64
	CostKnown                               bool
	CostNanoUSD                             uint64
}
type agentMetrics struct {
	usageWriteFailures uint64
	sync.Mutex
	series                                                        map[string]*agentSeries
	guards                                                        map[string]uint64
	tokens                                                        [5]uint64
	usageKnown, usageUnknown, costKnown, costUnknown, costNanoUSD uint64
	inFlight                                                      int64
}

func newAgentMetrics() *agentMetrics {
	m := &agentMetrics{series: map[string]*agentSeries{}, guards: map[string]uint64{}}
	add := func(key string) {
		m.series[key] = &agentSeries{counts: map[string]uint64{}, buckets: make([]uint64, len(latencyBounds))}
	}
	for _, mode := range []string{"chat", "draft"} {
		for _, stage := range []string{"request", "provider"} {
			add(stage + ":" + mode)
		}
	}
	for _, tool := range agentToolNames {
		add("tool:" + tool)
	}
	return m
}

var agents = newAgentMetrics()

func enum(value string, allowed []string, fallback string) string {
	for _, s := range allowed {
		if value == s {
			return s
		}
	}
	return fallback
}
func AgentSafeTool(value string) string    { return enum(value, agentToolNames, "unknown") }
func AgentSafeOutcome(value string) string { return enum(value, agentOutcomes, "error") }
func AgentGuard(reason string) {
	agents.Lock()
	defer agents.Unlock()
	agents.guards[enum(reason, agentGuardReasons, "other")]++
}
func AgentInFlight(delta int64) { agents.Lock(); defer agents.Unlock(); agents.inFlight += delta }
func (m *agentMetrics) event(key, outcome string, elapsed time.Duration) {
	m.Lock()
	defer m.Unlock()
	s := m.series[key]
	if s == nil {
		return
	}
	s.counts[AgentSafeOutcome(outcome)]++
	s.micros += uint64(max(elapsed.Microseconds(), 0))
	for i, bound := range latencyBounds {
		if elapsed.Seconds() <= bound {
			s.buckets[i]++
		}
	}
}
func AgentRequest(mode, outcome string, elapsed time.Duration) {
	agents.event("request:"+enum(mode, []string{"chat", "draft"}, "chat"), outcome, elapsed)
}
func AgentTool(name, outcome string, elapsed time.Duration) {
	agents.event("tool:"+AgentSafeTool(name), outcome, elapsed)
}
func AgentProvider(mode, outcome string, elapsed time.Duration, u AgentUsage) {
	agents.event("provider:"+enum(mode, []string{"chat", "draft"}, "chat"), outcome, elapsed)
	agents.Lock()
	defer agents.Unlock()
	if u.Known {
		agents.usageKnown++
		values := []int64{u.Prompt, u.Cached, u.Output, u.Thinking, u.Total}
		for i, n := range values {
			agents.tokens[i] += uint64(max(n, 0))
		}
	} else {
		agents.usageUnknown++
	}
	if u.Known && u.CostKnown {
		agents.costKnown++
		agents.costNanoUSD += u.CostNanoUSD
	} else {
		agents.costUnknown++
	}
}
func (m *agentMetrics) write(w io.Writer) {
	m.Lock()
	defer m.Unlock()
	fmt.Fprintln(w, "# HELP fintrack_agent_events_total Agent request, provider and tool outcomes.\n# TYPE fintrack_agent_events_total counter")
	keys := []string{"request:chat", "request:draft", "provider:chat", "provider:draft"}
	for _, tool := range agentToolNames {
		keys = append(keys, "tool:"+tool)
	}
	for _, key := range keys {
		parts := strings.SplitN(key, ":", 2)
		s := m.series[key]
		for _, outcome := range agentOutcomes {
			fmt.Fprintf(w, "fintrack_agent_events_total{stage=%q,operation=%q,outcome=%q} %d\n", parts[0], parts[1], outcome, s.counts[outcome])
		}
	}
	fmt.Fprintln(w, "# HELP fintrack_agent_duration_seconds Agent latency by bounded stage and operation.\n# TYPE fintrack_agent_duration_seconds histogram")
	for _, key := range keys {
		parts := strings.SplitN(key, ":", 2)
		s := m.series[key]
		var count uint64
		for _, v := range s.counts {
			count += v
		}
		for i, b := range latencyBounds {
			fmt.Fprintf(w, "fintrack_agent_duration_seconds_bucket{stage=%q,operation=%q,le=%q} %d\n", parts[0], parts[1], fmt.Sprint(b), s.buckets[i])
		}
		fmt.Fprintf(w, "fintrack_agent_duration_seconds_bucket{stage=%q,operation=%q,le=\"+Inf\"} %d\nfintrack_agent_duration_seconds_sum{stage=%q,operation=%q} %.6f\nfintrack_agent_duration_seconds_count{stage=%q,operation=%q} %d\n", parts[0], parts[1], count, parts[0], parts[1], float64(s.micros)/1e6, parts[0], parts[1], count)
	}
	fmt.Fprintln(w, "# HELP fintrack_agent_guardrails_total Guard rejections and redactions (not user text).\n# TYPE fintrack_agent_guardrails_total counter")
	for _, reason := range agentGuardReasons {
		fmt.Fprintf(w, "fintrack_agent_guardrails_total{reason=%q} %d\n", reason, m.guards[reason])
	}
	fmt.Fprintln(w, "# HELP fintrack_agent_tokens_total Provider-reported tokens; prompt includes cached tokens, total includes other components.\n# TYPE fintrack_agent_tokens_total counter")
	for i, kind := range []string{"prompt", "cached", "output", "thinking", "total"} {
		fmt.Fprintf(w, "fintrack_agent_tokens_total{kind=%q} %d\n", kind, m.tokens[i])
	}
	fmt.Fprintf(w, "# TYPE fintrack_agent_usage_total counter\nfintrack_agent_usage_total{known=\"true\"} %d\nfintrack_agent_usage_total{known=\"false\"} %d\n", m.usageKnown, m.usageUnknown)
	fmt.Fprintf(w, "# TYPE fintrack_agent_cost_estimates_total counter\nfintrack_agent_cost_estimates_total{known=\"true\"} %d\nfintrack_agent_cost_estimates_total{known=\"false\"} %d\n", m.costKnown, m.costUnknown)
	fmt.Fprintf(w, "# HELP fintrack_agent_estimated_cost_usd_total Configured-price estimate for calls with known usage, not a provider invoice.\n# TYPE fintrack_agent_estimated_cost_usd_total counter\nfintrack_agent_estimated_cost_usd_total %.9f\n", float64(m.costNanoUSD)/1e9)
	fmt.Fprintf(w, "# TYPE fintrack_agent_usage_write_failures_total counter\nfintrack_agent_usage_write_failures_total %d\n", m.usageWriteFailures)
	fmt.Fprintf(w, "# TYPE fintrack_agent_in_flight gauge\nfintrack_agent_in_flight %d\n", m.inFlight)
}
func WriteAgentMetrics(w io.Writer) { agents.write(w) }

func AgentUsageWriteFailure() { agents.Lock(); defer agents.Unlock(); agents.usageWriteFailures++ }
