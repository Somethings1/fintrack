package telemetry

import (
	"bytes"
	"strings"
	"sync"
	"testing"
	"time"
)

func TestAgentMetricsBoundLabelsAndExposeHistograms(t *testing.T) {
	m := newAgentMetrics()
	var wg sync.WaitGroup
	for i := 0; i < 20; i++ {
		wg.Add(1)
		go func() { defer wg.Done(); m.event("request:chat", "success", 100*time.Millisecond) }()
	}
	wg.Wait()
	m.event("request:chat", "private-user-text", time.Second)
	m.event("private-user-text", "success", time.Second)
	var out bytes.Buffer
	m.write(&out)
	text := out.String()
	for _, want := range []string{`fintrack_agent_events_total{stage="request",operation="chat",outcome="success"} 20`, `fintrack_agent_duration_seconds_bucket{stage="request",operation="chat",le="0.1"} 20`, `fintrack_agent_duration_seconds_bucket{stage="request",operation="chat",le="+Inf"} 21`, `fintrack_agent_events_total{stage="request",operation="chat",outcome="error"} 1`, `fintrack_agent_usage_total{known="false"} 0`} {
		if !strings.Contains(text, want) {
			t.Fatalf("missing %s", want)
		}
	}
	if strings.Contains(text, "private-user-text") || AgentSafeTool("private-user-text") != "unknown" {
		t.Fatal("unbounded metric label leaked")
	}
	if len(m.series) != 16 {
		t.Fatal("unexpected metric cardinality")
	}
}
