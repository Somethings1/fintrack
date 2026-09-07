package config

import (
	"fmt"
	"strconv"
	"strings"
)

// Prices are integer micro-USD per million tokens; no vendor price is assumed.
// Supply all three or leave all empty. Zero is a valid configured rate.
type AgentPricing struct {
	Configured            bool
	Input, Cached, Output int64
}

func parseAgentOptions(env func(string) string, c *Config) error {
	var err error
	raw := strings.TrimSpace(env("AGENT_CHANGES_DISABLED"))
	if raw == "" {
		raw = "false"
	}
	c.AgentChangesDisabled, err = strconv.ParseBool(raw)
	if err != nil {
		return fmt.Errorf("AGENT_CHANGES_DISABLED must be a boolean")
	}
	keys := []string{"AGENT_INPUT_MICRO_USD_PER_MILLION", "AGENT_CACHED_MICRO_USD_PER_MILLION", "AGENT_OUTPUT_MICRO_USD_PER_MILLION"}
	values := []*int64{&c.AgentPricing.Input, &c.AgentPricing.Cached, &c.AgentPricing.Output}
	present := 0
	for i, key := range keys {
		raw := strings.TrimSpace(env(key))
		if raw == "" {
			continue
		}
		present++
		n, e := strconv.ParseInt(raw, 10, 64)
		if e != nil || n < 0 || n > 1_000_000_000 {
			return fmt.Errorf("%s must be an integer from 0 to 1000000000", key)
		}
		*values[i] = n
	}
	if present != 0 && present != 3 {
		return fmt.Errorf("provide all three agent token prices, or leave all unset")
	}
	c.AgentPricing.Configured = present == 3
	return nil
}
