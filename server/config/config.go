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
	LedgerCurrency           string
	Environment, Port        string
	DatabaseURL              string
	SupabaseURL, SupabaseKey string
	AllowedOrigins           []string
	AgentEnabled             bool
	AgentKey, AgentModel     string
	CronEnabled              bool
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
		DatabaseURL: value("DATABASE_URL", ""),
		SupabaseURL: strings.TrimRight(value("SUPABASE_URL", ""), "/"), SupabaseKey: value("SUPABASE_ANON_KEY", ""),
		AgentKey: value("GEMINI_API_KEY", ""), AgentModel: value("AGENT_MODEL", "")}
	if c.Environment != "development" && c.Environment != "test" && c.Environment != "production" {
		return c, fmt.Errorf("APP_ENV must be development, test or production")
	}
	port, err := strconv.Atoi(c.Port)
	if err != nil || port < 1 || port > 65535 {
		return c, fmt.Errorf("PORT must be between 1 and 65535")
	}
	if c.DatabaseURL == "" && c.Environment != "production" {
		c.DatabaseURL = "postgres://fintrack:fintrack@localhost:5432/fintrack?sslmode=disable"
	}
	if err := validDatabaseURL(c.DatabaseURL, c.Environment); err != nil {
		return c, err
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

func validDatabaseURL(raw, environment string) error {
	if raw == "" {
		return fmt.Errorf("DATABASE_URL is required")
	}
	u, err := url.Parse(raw)
	if err != nil || (u.Scheme != "postgres" && u.Scheme != "postgresql") || u.Host == "" || u.User == nil {
		return fmt.Errorf("DATABASE_URL must be a PostgreSQL connection URL")
	}
	query, err := url.ParseQuery(u.RawQuery)
	if err != nil || u.Fragment != "" || u.Path == "" || u.Path == "/" || u.User.Username() == "" {
		return fmt.Errorf("DATABASE_URL must specify a database and user")
	}
	if environment == "production" {
		host := strings.ToLower(u.Hostname())
		mode := query.Get("sslmode")
		if host == "localhost" || host == "127.0.0.1" || host == "::1" || (mode != "require" && mode != "verify-ca" && mode != "verify-full") {
			return fmt.Errorf("production DATABASE_URL requires a remote endpoint and explicit TLS sslmode")
		}
		for _, key := range []string{"host", "hostaddr", "port", "service", "servicefile", "sslmode"} {
			if len(query[key]) > 1 || (key != "sslmode" && len(query[key]) != 0) {
				return fmt.Errorf("production DATABASE_URL cannot override connection routing")
			}
		}
	}
	return nil
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
