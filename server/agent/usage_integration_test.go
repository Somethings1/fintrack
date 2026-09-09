//go:build integration

package agent

import (
	"context"
	"database/sql"
	"encoding/json"
	"fintrack/server/config"
	"fintrack/server/money"
	"fintrack/server/telemetry"
	"fintrack/server/util"
	"net/url"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
)

func usageDatabase(t *testing.T) {
	t.Helper()
	const fixture = "postgres://fintrack:fintrack@127.0.0.1:55432/fintrack?sslmode=disable"
	if os.Getenv("DATABASE_TEST_URL") != fixture {
		t.Fatal("exact disposable loopback DATABASE_TEST_URL required")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	admin, err := sql.Open("pgx", fixture)
	if err != nil {
		t.Fatal(err)
	}
	database := "fintrack_agent_" + strings.ReplaceAll(uuid.NewString(), "-", "")
	t.Cleanup(func() {
		_ = util.CloseDB()
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if _, err := admin.ExecContext(ctx, `DROP DATABASE IF EXISTS "`+database+`" WITH (FORCE)`); err != nil {
			t.Error(err)
		}
		_ = admin.Close()
	})
	if _, err := admin.ExecContext(ctx, `CREATE DATABASE "`+database+`"`); err != nil {
		t.Fatal(err)
	}
	u, _ := url.Parse(fixture)
	u.Path = "/" + database
	if err := util.InitDB(ctx, u.String()); err != nil {
		t.Fatal(err)
	}
	if err := util.EnsureLedger(ctx, "USD"); err != nil {
		t.Fatal(err)
	}
}

func TestAgentUsagePersistencePrivacyIsolationAndRetention(t *testing.T) {
	usageDatabase(t)
	cfg := config.Config{AgentModel: "synthetic-model", AgentPricing: config.AgentPricing{Configured: true, Input: 100000, Cached: 10000, Output: 400000}}
	trace := &runTrace{id: uuid.NewString(), mode: "chat", calls: 2, unknown: 1, unpriced: 1, usage: telemetry.AgentUsage{Prompt: 1000, Cached: 200, Output: 50, Thinking: 25, Total: 1075, CostNanoUSD: 112000}}
	// Final accounting survives cancellation but cannot resume provider work.
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	persistRun(ctx, "owner-a", trace, cfg, "proposed", time.Second)
	persistRun(ctx, "owner-a", trace, cfg, "proposed", time.Second)
	var count int
	var owner, outcome string
	var calls, unknown, unpriced, cost, cached, thinking int64
	if err := util.DB.QueryRow(`SELECT owner,outcome,provider_calls,unknown_usage_calls,unpriced_calls,estimated_cost_nano_usd,cached_tokens,thinking_tokens FROM agent_usage WHERE run_id=$1`, trace.id).Scan(&owner, &outcome, &calls, &unknown, &unpriced, &cost, &cached, &thinking); err != nil {
		t.Fatal(err)
	}
	if owner != "owner-a" || outcome != "proposed" || calls != 2 || unknown != 1 || unpriced != 1 || cost != 112000 || cached != 200 || thinking != 25 {
		t.Fatal("usage or unknown-call accounting changed")
	}
	if err := util.DB.QueryRow(`SELECT count(*) FROM agent_usage`).Scan(&count); err != nil || count != 1 {
		t.Fatal("duplicate run counted twice", err)
	}
	var rls bool
	if err := util.DB.QueryRow(`SELECT relrowsecurity FROM pg_class WHERE oid='agent_usage'::regclass`).Scan(&rls); err != nil || !rls {
		t.Fatal("usage RLS disabled", err)
	}
	var publicGrants int
	if err := util.DB.QueryRow(`SELECT count(*) FROM pg_class c, LATERAL aclexplode(COALESCE(c.relacl,acldefault('r',c.relowner))) a WHERE c.oid='agent_usage'::regclass AND a.grantee=0`).Scan(&publicGrants); err != nil || publicGrants != 0 {
		t.Fatal("public usage grant", err)
	}
	for _, table := range []string{"transactions", "financial_accounts", "categories", "subscriptions"} {
		if err := util.DB.QueryRow(`SELECT count(*) FROM ` + table).Scan(&count); err != nil || count != 0 {
			t.Fatal("accounting changed financial records", err)
		}
	}
	var columns string
	if err := util.DB.QueryRow(`SELECT string_agg(column_name,',') FROM information_schema.columns WHERE table_name='agent_usage'`).Scan(&columns); err != nil {
		t.Fatal(err)
	}
	for _, forbidden := range []string{"prompt_text", "answer", "arguments", "payload", "record_id", "note"} {
		if strings.Contains(columns, forbidden) {
			t.Fatalf("content column %s", forbidden)
		}
	}
	if _, err := util.DB.Exec(`UPDATE agent_usage SET recorded_at=now()-interval '91 days'`); err != nil {
		t.Fatal(err)
	}
	trace.id = uuid.NewString()
	persistRun(context.Background(), "owner-b", trace, cfg, "success", time.Second)
	if err := util.DB.QueryRow(`SELECT count(*) FROM agent_usage WHERE owner='owner-a'`).Scan(&count); err != nil || count != 0 {
		t.Fatal("expired accounting retained", err)
	}
	if err := util.DB.QueryRow(`SELECT count(*) FROM agent_usage WHERE owner='owner-b'`).Scan(&count); err != nil || count != 1 {
		t.Fatal("new accounting missing", err)
	}
}

func TestGuardedRealLookupScopesRecordsAndRequiresFreshOwnedTargets(t *testing.T) {
	usageDatabase(t)
	const id = "111111111111111111111111"
	const foreign = "222222222222222222222222"
	_, err := util.DB.Exec(`INSERT INTO financial_accounts(id,owner,kind,currency,opening_balance_micros,balance_micros,name) VALUES($1,'owner-a','account','USD',0,0,'Wallet'),($2,'owner-b','account','USD',0,0,'FOREIGN SECRET')`, id, foreign)
	if err != nil {
		t.Fatal(err)
	}
	ctx := money.WithCurrency(context.WithValue(context.Background(), util.UserIdKey, "owner-a"), "USD")
	ctx = context.WithValue(ctx, permissionKey{}, permissions{Changes: true, Deletes: true})
	g := &guardedTools{next: WorkspaceTools{LedgerTools: LedgerTools{DB: util.DB}}}
	args := json.RawMessage(`{"operation":"update","recordId":"` + id + `","values":{"name":"Renamed"}}`)
	_, err = g.Execute(ctx, "propose_account", args)
	requireGuard(t, err, "unverified_record")
	result, err := g.Execute(ctx, "find_records", json.RawMessage(`{"entity":"account"}`))
	if err != nil {
		t.Fatal(err)
	}
	raw, _ := json.Marshal(result)
	if strings.Contains(string(raw), "FOREIGN SECRET") {
		t.Fatal("tenant data leaked")
	}
	result, err = g.Execute(ctx, "propose_account", args)
	if err != nil {
		t.Fatal(err)
	}
	if _, ok := result.(*ChangeProposal); !ok {
		t.Fatal("no confirmed proposal")
	}
	_, err = g.Execute(ctx, "propose_account", json.RawMessage(`{"operation":"delete","recordId":"`+foreign+`"}`))
	requireGuard(t, err, "unverified_record")
	var name string
	if err := util.DB.QueryRow(`SELECT name FROM financial_accounts WHERE id=$1`, id).Scan(&name); err != nil || name != "Wallet" {
		t.Fatal("preparation performed a write", err)
	}
}
