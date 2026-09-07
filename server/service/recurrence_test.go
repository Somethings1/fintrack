package service

import (
	"testing"
	"time"
)

func TestAnchoredRecurrence(t *testing.T) {
	for _, tc := range []struct {
		start, interval string
		n               int
		want            string
	}{
		{"2024-01-31T12:30:00Z", "month", 1, "2024-02-29T12:30:00Z"},
		{"2024-01-31T12:30:00Z", "month", 2, "2024-03-31T12:30:00Z"},
		{"2024-02-29T00:00:00Z", "year", 1, "2025-02-28T00:00:00Z"},
		{"2024-02-29T00:00:00Z", "year", 4, "2028-02-29T00:00:00Z"},
		{"2026-09-01T00:00:00Z", "week", 1, "2026-09-08T00:00:00Z"},
		{"2026-09-01T00:00:00Z", "day", 1, "2026-09-02T00:00:00Z"},
	} {
		start, _ := time.Parse(time.RFC3339, tc.start)
		got, err := OccurrenceAt(start, tc.interval, tc.n)
		if err != nil || got.Format(time.RFC3339) != tc.want {
			t.Fatalf("%+v: %v %v", tc, got, err)
		}
	}
	for _, interval := range []string{"test", "minute", "", "sql"} {
		if _, err := OccurrenceAt(time.Now(), interval, 1); err == nil {
			t.Fatal("invalid interval")
		}
	}
	if _, err := OccurrenceAt(time.Now(), "day", -1); err == nil {
		t.Fatal("negative ordinal")
	}
}
