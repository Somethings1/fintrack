# Production-readiness foundation

This branch adds a tested deployment and security foundation. It is **not a certification that
existing financial data is reconciled or that a live deployment has been reviewed**. No production
secrets, database migrations, rulesets, paid AI calls or deployments are performed by CI.

## Launch blockers: do not skip these
1. **Money and currency model:** stored monetary values remain `float64`/JavaScript numbers.
   Approve a per-ledger currency and precision model, migrate to integer minor units or Decimal128,
   and reconcile opening balances, transfers, refunds and historical totals. The display-currency
   setting is not an exchange-rate system. Do not treat this app as a banking/accounting ledger yet.
2. **Recurring posting:** automatic subscription posting is disabled by default. Production rejects
   `CRON_ENABLED=true`; HTTP creation no longer performs unbounded catch-up writes. Subscription
   records/reminders remain available, but scheduled posting needs an atomic occurrence ledger,
   idempotent advancement, bounded catch-up and restart/concurrency tests before re-enabling.
3. **Tenant deployment review:** apply/review `deploy/profiles-rls.sql` in staging, verify profile
   owner isolation using two real test accounts, and audit avatar-storage policies. The SQL is not
   auto-applied. Review any existing SECURITY DEFINER functions and broad storage grants.
4. **Operational controls:** configure TLS/HSTS, ingress request/body/connection quotas, managed
   authenticated MongoDB replica-set access, backup/PITR retention, restore drills, monitoring and
   a named on-call owner. Run a staged load test; there is no measured capacity or availability SLA.
5. **Human acceptance:** exercise sign-in/sign-out, password recovery, profile/avatar, account,
   savings, categories, transfers, exports, two simultaneous browser sessions, and optional agent
   consent/save flows with representative data. CI's container smoke is not a browser E2E test.
6. **Legacy clients:** the bounded NDJSON completion protocol is a coordinated frontend/API change.
   Deploy a matching pair; old Electron/binary/browser clients are not release-qualified here.

## CI and branch protection
`Required CI` aggregates backend, frontend, and container jobs and fails if any prerequisite fails
or is skipped. No path exclusions bypass required checks. Actions are commit-pinned and default to
read-only repository permissions. PRs never deploy or publish images. The jobs run:
- Go formatting, module verification, vet, race tests, build and pinned govulncheck.
- A real disposable MongoDB replica set with local Supabase auth stub: tenant isolation, idempotent
  retry and concurrent creation, balance reversal, safe archival, notification ownership, cursor
  pagination across equal timestamps, cookie flags, readiness and WebSocket origins.
- Clean npm install, zero-warning lint, TypeScript build, Node regression tests, npm high/critical
  vulnerability gate and gzip bundle budgets (450 KB initial / 1.1 MB total JavaScript).
- Both image builds, non-root/read-only/capability-dropped runtime smoke, graceful API shutdown,
  Trivy high/critical image vulnerability scans, source secret scan and SBOM artifacts.

An administrator must configure the repository ruleset: require PRs, `Required CI`, up-to-date
branches, human review, resolved conversations, and no force-push or routine bypass. CODEOWNERS is
advisory without an enforced ruleset. Enable dependency alerts and private vulnerability reporting.
Dependabot covers npm, Go, Actions and Docker; the pinned official SheetJS tarball needs manual
release review because the npm distribution is not the canonical maintained package.

## Local development
Install Go 1.26.5 and Node 22. Copy `server/.env.example` and `web/.env.example` to `.env` in their
respective directories; use a development Supabase project. Start a local Mongo replica set (the
CI bootstrap script is also usable locally when ports/names are free), then run `go run .` under
`server/` and `npm ci --legacy-peer-deps && npm run dev` under `web/`. Vite proxies `/api` including
WebSockets to `127.0.0.1:8080`. The browser no longer contains a provider secret or hardcoded API URL.

For a full local Docker stack, put development Supabase values in a root `.env` and run
`docker compose --env-file .env -f compose.dev.yaml up --build -d`. Mongo is intentionally
unauthenticated and unexposed to host ports in this development-only stack. Do not reuse it in
production. `docker compose -f compose.dev.yaml down` retains the named database volume; adding
`--volumes` deletes it and should only be done intentionally on disposable data.

## Production container deployment
1. Complete the launch blockers and obtain green checks for the exact commit to release.
2. Copy `.env.example` to a protected, untracked configuration file (owner-readable only). Use
   an authenticated TLS replica-set URI and a least-privilege application user. `SUPABASE_ANON_KEY`
   is the public browser key, not a service-role key. Prefer a platform secret manager over env files.
3. Run `docker compose --env-file .env config --quiet`. Never paste the expanded configuration
   into logs or issues: it contains runtime secrets.
4. Set an immutable release tag, build the matching API/web images, scan them and record their
   digests. Release deployments should use those image digests, not rebuilt mutable tags. Base-image
   tags remain updateable by Dependabot; rebuild/scan regularly and pin reviewed release digests.
5. Run `docker compose --env-file .env up --build -d`. The published web port binds only to localhost
   by default. Put a TLS reverse proxy/load balancer in front; keep API/Mongo inaccessible externally.
   Set `ALLOWED_ORIGINS` to exact public HTTPS origins and Supabase redirect allowlists to the same
   origin plus `/update-password` as required. Custom Supabase domains require updating the CSP.
6. Verify `/healthz` (web), `/readyz` (Mongo-backed API readiness via proxy), authenticated CRUD,
   auth rejection and WebSocket reconnect. Record the exact images/config and smoke results.

The API image has no shell and runs as UID 65532; the web image runs as UID 101. Production Compose
uses read-only root filesystems, all Linux capabilities dropped, no-new-privileges, tmpfs, memory/CPU
and PID limits, bounded logs and graceful shutdown. These defaults need a measured load test before
changing limits. API liveness `/livez` is deliberately independent from Mongo; `/readyz` is not.

## Authentication, privacy and synchronization
HTTP calls use a verified bearer token. A dedicated authenticated endpoint mints a Secure (production),
HttpOnly, SameSite=Strict, `/api`-scoped cookie for browser WebSockets. Cookies alone cannot authorize
unsafe cross-origin requests. WebSocket connections have exact-origin checks, bounded per-user/global
counts, queues, deadlines, heartbeat and periodic reauthentication. Ingress quotas are still required:
auth verification occurs before the per-user in-process quota, and replicas do not share a limiter.

Logs contain generated request IDs, method, route template, status and elapsed time, not query strings,
auth headers, bodies, financial descriptions, model prompts or provider responses. Readiness failures
return no database internals. Propagate request IDs to support without sending financial payloads.

Synchronization uses tenant-indexed ascending `(last_update, _id)` keyset pages of 500 plus a completion
marker. The client handles split UTF-8/NDJSON, requires the marker before checkpointing, overlaps
millisecond boundaries and includes tombstones. Cache writes are batched and per-user IndexedDB replaces
the old shared database. Logout deletes local financial caches. Quota/corruption/network errors must
not advance checkpoints. More than 100,000 records per synchronization requires an export/backfill
strategy; this client intentionally bounds work instead of silently dropping data.

POST transaction requests accept a per-user `Idempotency-Key`; the unique partial Mongo index is created
at startup. Replaying the same key/payload returns the original ID without changing balances; another
payload returns 409. Keys are stored with the transaction, including after deletion, and are not TTL
purged. The browser coalesces simultaneous submissions and retains keys after ambiguous failures.
Other create endpoints do not yet have server-side replay guarantees. Mutations do not optimistically
adjust balances. Referenced accounts/savings/categories cannot be archived via unsafe cascading deletes.

## Optional assistant and agent development
The assistant is a **bounded transaction-drafting workflow**, not an autonomous financial agent.
It is off by default. Enabling it requires `AGENT_ENABLED=true`, a server-only `GEMINI_API_KEY`,
and an explicitly selected supported `AGENT_MODEL` (do not assume an old model name still exists).
Review provider data handling, region, retention, budget and model availability before enabling.
Rotate any historical browser-exposed Gemini key and invalidate old assets; removing code is not revocation.

A user must opt in before their description and owned account/category IDs and names are sent to Google.
Balances, transaction history and auth credentials are not sent. Output must match a bounded JSON schema
and pass independent amount/type/ownership validation. The provider has no tools, write capability or
arbitrary endpoint selection. Requests have body/token/response/time limits, per-user quota and an
8-request process-wide concurrency cap. Failures/refusals return no executable draft and are not retried.
The user sees the proposal and separately confirms a save through the ordinary validated/idempotent API.
Names/descriptions/output are treated as untrusted data, including prompt-injection attempts.
`AGENTS.md` documents the same boundaries for coding assistants working on this repository.

## Operate and recover
Monitor readiness, 5xx, auth-upstream 503s, 429s, latency, Mongo primary/pool health, disk, backup age,
container restarts and agent provider failures/spend. Alert thresholds and capacity are deployment-specific.
Perform a scheduled isolated restore from backups and compare per-user record counts, tombstones and
balance reconciliation; never test restoration over the live database. Back up before index/schema changes.

Rollback means restoring the previous **matching** API/web image pair and compatible configuration,
then repeating readiness and authenticated smoke tests. Do not roll back only the frontend or delete
new indexes/data blindly. Pause writes and reconcile before reversing a financial migration. To disable
the optional assistant, set `AGENT_ENABLED=false` and redeploy the API; do not leave compromised keys active.
Do not enable legacy recurrence as a workaround. Incident reports should include request IDs and sanitized
error classes, not tokens, prompts, descriptions or customer financial data.

## External design references
- Go vulnerability scanning: https://go.dev/security/vuln/
- MongoDB transaction guidance: https://www.mongodb.com/docs/manual/core/transactions/
- Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- Gemini structured output: https://ai.google.dev/gemini-api/docs/structured-output
- SheetJS maintained distribution: https://docs.sheetjs.com/docs/getting-started/installation/nodejs/
- Docker startup dependencies: https://docs.docker.com/compose/how-tos/startup-order/
