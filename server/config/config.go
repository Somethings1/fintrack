// Package config validates configuration before network listeners or workers start.
package config

import (
	"fintrack/server/money"
	"fmt"
	"net/url"
	"os"
	"strconv"
	"strings"
)

type Config struct {
	LedgerCurrency                             string
	Environment, Port, MongoURI, MongoDatabase string
	SupabaseURL, SupabaseKey                   string
	AllowedOrigins                             []string
	AgentEnabled                               bool
	AgentKey, AgentModel                       string
	CronEnabled                                bool
}

func Load() (Config, error) { return Parse(os.Getenv) }

// Parse is separate from Load so tests never need real credentials.
func Parse(env func(string) string) (Config, error) {
	value := func(key, fallback string) string {
		if v := strings.TrimSpace(env(key)); v != "" {
			return v
		}
		return fallback
	}
	c := Config{LedgerCurrency: value("LEDGER_CURRENCY", ""), Environment: value("APP_ENV", "development"), Port: value("PORT", "8080"),
		MongoURI: value("MONGO_URI", ""), MongoDatabase: value("MONGO_DATABASE", "finance_db"),
		SupabaseURL: strings.TrimRight(value("SUPABASE_URL", ""), "/"), SupabaseKey: value("SUPABASE_ANON_KEY", ""),
		AgentKey: value("GEMINI_API_KEY", ""), AgentModel: value("AGENT_MODEL", "")}
	if c.Environment != "development" && c.Environment != "test" && c.Environment != "production" {
		return c, fmt.Errorf("APP_ENV must be development, test or production")
	}
	port, err := strconv.Atoi(c.Port)
	if err != nil || port < 1 || port > 65535 {
		return c, fmt.Errorf("PORT must be between 1 and 65535")
	}
	if c.MongoURI == "" && c.Environment != "production" {
		c.MongoURI = "mongodb://localhost:27017/?replicaSet=rs0"
	}
	if !strings.HasPrefix(c.MongoURI, "mongodb://") && !strings.HasPrefix(c.MongoURI, "mongodb+srv://") {
		return c, fmt.Errorf("MONGO_URI is required and must be a MongoDB URI")
	}
	if strings.ContainsAny(c.MongoDatabase, "/\\. \"$\x00") {
		return c, fmt.Errorf("invalid MONGO_DATABASE")
	}
	if _, err := validOrigin(c.SupabaseURL, c.Environment); err != nil || c.SupabaseKey == "" {
		return c, fmt.Errorf("SUPABASE_URL and SUPABASE_ANON_KEY are required; use an HTTPS project URL")
	}
	origins := value("ALLOWED_ORIGINS", "")
	if origins == "" && c.Environment != "production" {
		origins = "http://localhost:5173,http://localhost:8088"
	}
	if origins == "" {
		return c, fmt.Errorf("ALLOWED_ORIGINS is required in production")
	}
	for _, raw := range strings.Split(origins, ",") {
		origin, err := validOrigin(strings.TrimSpace(raw), c.Environment)
		if err != nil {
			return c, fmt.Errorf("ALLOWED_ORIGINS must contain exact origins, without paths or wildcards")
		}
		c.AllowedOrigins = append(c.AllowedOrigins, origin)
	}
	c.AgentEnabled, err = strconv.ParseBool(value("AGENT_ENABLED", "false"))
	if err != nil {
		return c, fmt.Errorf("AGENT_ENABLED must be a boolean")
	}
	c.CronEnabled, err = strconv.ParseBool(value("CRON_ENABLED", "false"))
	if err != nil {
		return c, fmt.Errorf("CRON_ENABLED must be a boolean")
	}
	if c.LedgerCurrency == "" && c.Environment != "production" {
		c.LedgerCurrency = "USD"
	}
	if _, err := money.Precision(c.LedgerCurrency); err != nil {
		return c, fmt.Errorf("LEDGER_CURRENCY must be an explicitly supported currency in production")
	}
	if c.AgentEnabled && (c.AgentKey == "" || c.AgentModel == "") {
		return c, fmt.Errorf("AGENT_MODEL and GEMINI_API_KEY are required when AGENT_ENABLED=true")
	}
	for _, ch := range c.AgentModel {
		if !(ch >= 'a' && ch <= 'z' || ch >= 'A' && ch <= 'Z' || ch >= '0' && ch <= '9' || ch == '-' || ch == '.') {
			return c, fmt.Errorf("invalid AGENT_MODEL")
		}
	}
	return c, nil
}

func validOrigin(raw, environment string) (string, error) {
	u, err := url.Parse(raw)
	if err != nil || u.Host == "" || u.User != nil || u.RawQuery != "" || u.Fragment != "" || u.Path != "" {
		return "", fmt.Errorf("invalid origin")
	}
	if u.Scheme != "https" && !(environment != "production" && u.Scheme == "http" && (u.Hostname() == "localhost" || u.Hostname() == "127.0.0.1")) {
		return "", fmt.Errorf("HTTPS required")
	}
	return u.String(), nil
}
