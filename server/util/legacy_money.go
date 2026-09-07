package util

// MonetaryFields describes only the source MongoDB schema consumed by the
// offline exact-money migration. Keep this compatibility metadata separate from
// the PostgreSQL runtime, which stores checked fixed-point integers.
var MonetaryFields = map[string][]string{
	"accounts":      {"balance", "opening_balance"},
	"savings":       {"balance", "opening_balance", "goal"},
	"categories":    {"budget"},
	"transactions":  {"amount"},
	"subscriptions": {"amount"},
}
