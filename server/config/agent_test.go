package config

import "testing"

func TestAgentPricesAreExplicitAndValidated(t *testing.T) {
	for _, tc := range []struct {
		values            map[string]string
		valid, configured bool
	}{
		{map[string]string{}, true, false},
		{map[string]string{"AGENT_INPUT_MICRO_USD_PER_MILLION": "100000"}, false, false},
		{map[string]string{"AGENT_INPUT_MICRO_USD_PER_MILLION": "100000", "AGENT_CACHED_MICRO_USD_PER_MILLION": "10000", "AGENT_OUTPUT_MICRO_USD_PER_MILLION": "400000"}, true, true},
		{map[string]string{"AGENT_INPUT_MICRO_USD_PER_MILLION": "0", "AGENT_CACHED_MICRO_USD_PER_MILLION": "0", "AGENT_OUTPUT_MICRO_USD_PER_MILLION": "0"}, true, true},
		{map[string]string{"AGENT_INPUT_MICRO_USD_PER_MILLION": "-1"}, false, false},
		{map[string]string{"AGENT_INPUT_MICRO_USD_PER_MILLION": "1.5"}, false, false},
		{map[string]string{"AGENT_OUTPUT_MICRO_USD_PER_MILLION": "999999999999999999999999"}, false, false},
		{map[string]string{"AGENT_CHANGES_DISABLED": "garbage"}, false, false},
	} {
		var c Config
		err := parseAgentOptions(func(k string) string { return tc.values[k] }, &c)
		if (err == nil) != tc.valid || err == nil && c.AgentPricing.Configured != tc.configured {
			t.Fatalf("values=%v err=%v", tc.values, err)
		}
	}
	var c Config
	if err := parseAgentOptions(func(k string) string {
		if k == "AGENT_CHANGES_DISABLED" {
			return "true"
		}
		return ""
	}, &c); err != nil || !c.AgentChangesDisabled {
		t.Fatal("kill switch ignored")
	}
}
