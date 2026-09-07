package config

import "testing"

func TestConfigurationFailsClosed(t *testing.T) {
	base := map[string]string{"APP_ENV": "production", "MONGO_URI": "mongodb://db/", "SUPABASE_URL": "https://test.supabase.co", "SUPABASE_ANON_KEY": "public-test-key", "ALLOWED_ORIGINS": "https://finance.example"}
	parse := func(m map[string]string) error { _, err := Parse(func(k string) string { return m[k] }); return err }
	if err := parse(base); err != nil {
		t.Fatal(err)
	}
	for _, tc := range []struct{ key, value string }{
		{"PORT", "0"}, {"PORT", "8080:9999"}, {"MONGO_URI", ""}, {"MONGO_DATABASE", "bad.name"},
		{"SUPABASE_URL", "http://test.supabase.co"}, {"SUPABASE_URL", "https://user:pass@test.supabase.co"},
		{"ALLOWED_ORIGINS", "*"}, {"ALLOWED_ORIGINS", "https://finance.example/path"},
		{"ALLOWED_ORIGINS", ""}, {"AGENT_ENABLED", "true"}, {"AGENT_ENABLED", "invalid"}, {"CRON_ENABLED", "true"},
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
