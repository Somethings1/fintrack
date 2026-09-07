//go:build browser

package main

// This harness is compiled only by the dedicated CI browser job. Its fake auth
// endpoints are loopback-only and are never present in the application binary.
import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fintrack/server/config"
	"fintrack/server/model"
	"fintrack/server/money"
	"fintrack/server/service"
	"fintrack/server/util"
	"github.com/google/uuid"
	"net"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"sync"
	"syscall"
	"testing"
	"time"
)

func TestBrowserHarness(t *testing.T) {
	if os.Getenv("FINTRACK_CI") != "1" { t.Fatal("browser harness requires FINTRACK_CI=1") }
	databaseURL := os.Getenv("DATABASE_TEST_URL")
	if databaseURL != "postgres://fintrack:fintrack@127.0.0.1:55432/fintrack?sslmode=disable" { t.Fatal("only the disposable CI database is permitted") }
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGTERM, syscall.SIGINT)
	defer stop()
	if err := util.InitDB(ctx, databaseURL); err != nil { t.Fatal(err) }
	defer util.CloseDB()
	if err := util.EnsureLedger(ctx, "USD"); err != nil { t.Fatal(err) }
	ids := map[string]string{"alice@example.test": "11111111-1111-4111-8111-111111111111", "bob@example.test": "22222222-2222-4222-8222-222222222222"}
	for email, id := range ids {
		name := "Alice"
		if strings.HasPrefix(email, "bob") { name = "Bob" }
		owned := money.WithCurrency(context.WithValue(ctx, util.UserIdKey, id), "USD")
		if _, err := service.AddAccount(owned, model.Account{Name: name + " Wallet", Icon: "W", Balance: money.Must("100")}); err != nil { t.Fatal(err) }
		if _, err := service.AddCategory(owned, model.Category{Name: "Food", Icon: "F", Type: "expense", Budget: money.Must("100")}); err != nil { t.Fatal(err) }
	}
	var mu sync.Mutex
	sessions := map[string]map[string]interface{}{}
	profiles := map[string]map[string]interface{}{}
	mock := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Access-Control-Allow-Origin", "http://127.0.0.1:5173")
		w.Header().Set("Access-Control-Allow-Headers", "authorization,apikey,content-type,x-client-info,x-supabase-api-version,prefer")
		w.Header().Set("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS")
		if r.Method == "OPTIONS" { w.WriteHeader(204); return }
		mu.Lock(); defer mu.Unlock()
		if r.URL.Path == "/auth/v1/token" {
			var input struct { Email string `json:"email"`; Password string `json:"password"` }
			if json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096)).Decode(&input) != nil || ids[input.Email] == "" || input.Password != "ci-only-password" { w.WriteHeader(400); _ = json.NewEncoder(w).Encode(map[string]string{"msg": "Invalid credentials"}); return }
			id := ids[input.Email]
			user := map[string]interface{}{"id": id, "aud": "authenticated", "role": "authenticated", "email": input.Email, "app_metadata": map[string]interface{}{"provider": "email", "providers": []string{"email"}}, "user_metadata": map[string]string{}, "created_at": "2026-01-01T00:00:00Z"}
			raw, _ := json.Marshal(map[string]interface{}{"sub": id, "aud": "authenticated", "role": "authenticated", "iat": time.Now().Unix(), "exp": time.Now().Add(time.Hour).Unix(), "session_id": uuid.NewString()})
			token := base64.RawURLEncoding.EncodeToString([]byte(`{"alg":"HS256","typ":"JWT"}`)) + "." + base64.RawURLEncoding.EncodeToString(raw) + "." + base64.RawURLEncoding.EncodeToString([]byte(uuid.NewString()))
			sessions[token] = user
			_ = json.NewEncoder(w).Encode(map[string]interface{}{"access_token": token, "refresh_token": uuid.NewString(), "expires_in": 3600, "expires_at": time.Now().Add(time.Hour).Unix(), "token_type": "bearer", "user": user}); return
		}
		token := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
		user := sessions[token]
		if user == nil { w.WriteHeader(401); _ = json.NewEncoder(w).Encode(map[string]string{"msg": "Invalid session"}); return }
		if r.URL.Path == "/auth/v1/user" { _ = json.NewEncoder(w).Encode(user); return }
		if r.URL.Path == "/auth/v1/logout" { delete(sessions, token); w.WriteHeader(204); return }
		if r.URL.Path == "/rest/v1/profiles" {
			id := user["id"].(string)
			if r.URL.Query().Get("id") != "eq."+id { w.WriteHeader(403); return }
			if profiles[id] == nil { profiles[id] = map[string]interface{}{"id": id, "email": user["email"], "full_name": "CI User", "display_currency": "EUR", "display_floating_points": 3, "display_locale": "en-US", "avatar_path": "", "currency_position": "before"} }
			if r.Method == "PATCH" { var fields map[string]interface{}; if json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096)).Decode(&fields) != nil { w.WriteHeader(400); return }; for _, key := range []string{"full_name", "avatar_path", "notification_income", "notification_expense", "display_locale", "display_currency", "display_floating_points", "currency_position", "updated_at"} { if v, ok := fields[key]; ok { profiles[id][key] = v } } }
			if strings.Contains(r.Header.Get("Accept"), "vnd.pgrst.object") { _ = json.NewEncoder(w).Encode(profiles[id]) } else { _ = json.NewEncoder(w).Encode([]interface{}{profiles[id]}) }; return
		}
		http.NotFound(w, r)
	})
	auth := &http.Server{Handler: mock, ReadHeaderTimeout: 5 * time.Second}
	authListener, err := net.Listen("tcp", "127.0.0.1:8089"); if err != nil { t.Fatal(err) }
	defer auth.Close(); go func() { _ = auth.Serve(authListener) }()
	api := &http.Server{Handler: newRouter(config.Config{Environment: "development", LedgerCurrency: "USD", SupabaseURL: "http://127.0.0.1:8089", SupabaseKey: "public-ci-only", AllowedOrigins: []string{"http://127.0.0.1:5173"}}), ReadHeaderTimeout: 5 * time.Second}
	apiListener, err := net.Listen("tcp", "127.0.0.1:8080"); if err != nil { t.Fatal(err) }
	defer api.Close(); go func() { _ = api.Serve(apiListener) }()
	<-ctx.Done()
}
