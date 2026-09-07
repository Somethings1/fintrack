// Package telemetry exports bounded, process-local Prometheus counters. No user,
// financial, URL, token, model or other unbounded labels are recorded.
package telemetry

import (
	"fmt"
	"net/http"
	"sync/atomic"
	"time"
)

var requests [6]atomic.Uint64
var durationMicros atomic.Uint64
var workerEnabled atomic.Bool
var workerLastSuccess atomic.Int64
var workerFailures atomic.Uint64
var workerLagSeconds atomic.Int64

func Request(status int, elapsed time.Duration) {
	class := status / 100
	if class < 1 || class > 5 {
		class = 0
	}
	requests[class].Add(1)
	durationMicros.Add(uint64(max(elapsed.Microseconds(), 0)))
}
func WorkerEnabled(enabled bool) { workerEnabled.Store(enabled) }
func WorkerTick(err error, lag time.Duration) {
	workerLagSeconds.Store(int64(max(lag.Seconds(), 0)))
	if err != nil {
		workerFailures.Add(1)
	} else {
		workerLastSuccess.Store(time.Now().Unix())
	}
}

// Handler must only be reachable on the private API network. The web proxy does
// not forward /metrics. Restrict network access to the scraper/app operators.
func Handler(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
	var total uint64
	for class := range requests {
		n := requests[class].Load()
		total += n
		fmt.Fprintf(w, "fintrack_http_requests_total{status_class=\"%dxx\"} %d\n", class, n)
	}
	fmt.Fprintf(w, "fintrack_http_duration_seconds_sum %.6f\nfintrack_http_duration_seconds_count %d\n", float64(durationMicros.Load())/1e6, total)
	enabled := 0
	if workerEnabled.Load() {
		enabled = 1
	}
	fmt.Fprintf(w, "fintrack_worker_enabled %d\nfintrack_worker_last_success_timestamp_seconds %d\nfintrack_worker_failures_total %d\nfintrack_worker_oldest_due_seconds %d\n", enabled, workerLastSuccess.Load(), workerFailures.Load(), workerLagSeconds.Load())
}
