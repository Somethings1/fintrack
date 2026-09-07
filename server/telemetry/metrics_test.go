package telemetry

import (
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestMetricsAreBoundedAndContainNoRequestData(t *testing.T) {
	Request(500, 125*time.Millisecond)
	WorkerEnabled(true)
	WorkerTick(nil, 3*time.Second)
	r := httptest.NewRecorder()
	Handler(r, httptest.NewRequest("GET", "/metrics?access_token=never-log-me", nil))
	body := r.Body.String()
	for _, metric := range []string{"fintrack_http_requests_total{status_class=\"5xx\"}", "fintrack_worker_enabled 1", "fintrack_worker_oldest_due_seconds 3"} {
		if !strings.Contains(body, metric) {
			t.Fatal("metric missing")
		}
	}
	if strings.Contains(body, "never-log-me") {
		t.Fatal("query leaked")
	}
}
