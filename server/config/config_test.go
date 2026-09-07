package config

import "testing"

func TestConfigurationFailsClosed(t *testing.T) {
	base := map[string]string{"APP_ENV": "production", "LEDGER_CURRENCY": "USD", "DATABASE_URL": "postgresql://app:secret@db.example.supabase.co:5432/postgres?sslmode=require", "SUPABASE_URL": "https://test.supabase.co", "SUPABASE_ANON_KEY": "public-test-key", "ALLOWED_ORIGINS": "https://finance.example"}
	parse := func(m map[string]string) error { _, err := Parse(func(k string) string { return m[k] }); return err }
	if err := parse(base); err != nil {
		t.Fatal(err)
	}
	for _, tc := range []struct{ key, value string }{
		{"PORT", "0"}, {"PORT", "8080:9999"}, {"DATABASE_URL", ""},
		{"DATABASE_URL", "mongodb://db/finance"}, {"DATABASE_URL", "postgres://app:secret@localhost/postgres?sslmode=disable"},
		{"SUPABASE_URL", "http://test.supabase.co"}, {"SUPABASE_URL", "https://user:pass@test.supabase.co"},
		{"ALLOWED_ORIGINS", "*"}, {"ALLOWED_ORIGINS", "https://finance.example/path"},
		{"ALLOWED_ORIGINS", ""}, {"AGENT_ENABLED", "true"}, {"AGENT_ENABLED", "invalid"}, {"CRON_ENABLED", "invalid"}, {"LEDGER_CURRENCY", ""}, {"LEDGER_CURRENCY", "XXX"},
	} {
		t.Run(tc.key+tc.value, func(t *testing.T) {
			values := map[string]string{}
			for k, v := range base {
				values[k] = v
			}
			values[tc.key] = tc.value
			if parse(values) == nil {
				t.Fatal("unsafe configuration accepted")
			}
		})
	}
}

func TestDevelopmentDefaultsToLocalPostgres(t *testing.T) {
	values := map[string]string{"SUPABASE_URL": "http://localhost:54321", "SUPABASE_ANON_KEY": "public-test-key"}
	cfg, err := Parse(func(k string) string { return values[k] })
	if err != nil {
		t.Fatal(err)
	}
	if cfg.DatabaseURL != "postgres://fintrack:fintrack@localhost:5432/fintrack?sslmode=disable" || cfg.LedgerCurrency != "USD" {
		t.Fatal("unexpected development database defaults")
	}
}

func TestProductionDatabaseRequiresTLS(t *testing.T) {
	for _, mode := range []string{"", "disable", "allow", "prefer", "invalid", "require&sslmode=disable", "require&host=localhost"} {
		if err := validDatabaseURL("postgres://app:secret@db.example.test/postgres?sslmode="+mode, "production"); err == nil {
			t.Errorf("accepted unsafe TLS mode %q", mode)
		}
	}
	for _, mode := range []string{"require", "verify-ca", "verify-full"} {
		if err := validDatabaseURL("postgres://app:secret@db.example.test/postgres?sslmode="+mode, "production"); err != nil {
			t.Fatal(err)
		}
	}
}
