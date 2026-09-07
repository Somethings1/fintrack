# Operations runbook

All commands below are **operator actions**, not actions performed by PR CI. Use a
staging environment first, a private secret manager/environment file and an approved
maintenance window. Never paste keys, URIs, financial records, migration reports or
backups into an issue, PR, prompt, log or public CI artifact.

## 1. Repository governance and release approval

An independent collaborator must review changes. `CODEOWNERS` alone is not an enforced
review gate. `scripts/configure-repository.py` prints the proposed `FinTrack required production gates`
ruleset and release environment; it does not mutate anything unless passed `--apply`.
The script is deliberately fixed to `longnt27/fintrack` and uses the operator's `gh`
authentication, never credentials committed to this repository.

```sh
python3 scripts/configure-repository.py --reviewer INDEPENDENT_COLLABORATOR
# After inspecting the proposal and confirming the collaborator:
python3 scripts/configure-repository.py --reviewer INDEPENDENT_COLLABORATOR --apply
```

The additive ruleset requires a PR, one approval, stale-approval dismissal, last-push
approval by another person, resolved conversations, up-to-date `Required CI` bound to
GitHub Actions, and no force push/deletion. The `release` environment requires human
approval, disallows self-review/admin bypass and permits main only. Existing rulesets
are not deleted; an existing same-named ruleset/environment is not overwritten. Setup
writes are not atomic: on a failure, inspect partial state before retrying. Enable
repository vulnerability alerts/private reporting in the hosting UI as appropriate.

Merge only reviewed changes with green CI. After main's **push CI** succeeds, the
manual `Release reviewed images` workflow may be dispatched on that exact main commit.
Set these **public** release-environment variables (never service-role/provider keys):
`PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_ANON_KEY`.

The release script verifies main has not advanced, every required CI job passed for
that SHA, review/status rules are active, and the environment prevents bypass and
self-review. It builds candidate API/web/edge images, smoke-tests them, validates TLS,
scans all three images, rechecks CI/main, then publishes commit/run-specific GHCR tags
and retains a digest manifest and SBOMs. Partial registry publication is possible on a
network failure; **only a completed approved run with its manifest is deployable**.
It does not deploy. Manifest evidence is not a cryptographic image-signing claim.

## 2. Supabase authentication, profiles and private avatars

Configure email/OAuth and exact application redirect URLs in a staging project.
The API uses `SUPABASE_URL` and the public `SUPABASE_ANON_KEY` to verify access tokens.
It does not use a browser-provided identity or an unverified JWT payload.

Review `query.sql`, then apply `deploy/profiles-rls.sql` and `deploy/avatar-rls.sql`
through the project's reviewed migration process. The profile script adds `avatar_path`,
owner isolation, anonymous denial and a safe SECURITY DEFINER trigger search path.
Storage policies create an owner-only boundary for bucket **avatar**, even if an old
permissive storage policy exists. They do not change other buckets' access policy.

Configure the actual Storage bucket through its API, not by editing Storage metadata:

```sh
# Inject SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY privately into this process.
node scripts/configure-avatar.mjs
# After reviewing the proposal (existing public avatars will become private):
node scripts/configure-avatar.mjs --apply
```

The bucket is private, WebP-only and limited to 2 MiB. Clients validate/re-encode PNG,
JPEG or WebP to a small WebP and store `<owner UUID>/<random UUID>.webp`; signed URLs
are short-lived. Old public URLs/metadata are not adopted automatically. Plan an
owner-authorized re-upload and remove stale legacy objects only after a reviewed
inventory/retention decision. Do not make the bucket public to restore old URLs.

Staging acceptance must use two real non-admin users: each can select/update its own
profile and upload/read/delete its own avatar; neither can enumerate/read/overwrite/
move the other's profile or avatar; anonymous access is denied; signout and an
account switch cannot display cached financial data. Test OAuth/password reset,
image upload failure/cleanup and signed-URL expiry. The CI PostgreSQL role fixtures
and fake identity provider are deliberate isolation tests, not a hosted-provider audit.

## 3. Exact-money model and legacy migration

Choose `LEDGER_CURRENCY` explicitly: USD/EUR/GBP/CAD/AUD/CHF/SGD/THB/CNY (2 decimals),
JPY/VND/KRW (0), or KWD/BHD (3). A single deployment is a single currency; no conversion
is performed. All monetary API input is independently validated against its currency.
Go stores checked integer millionths, MongoDB stores major-unit BSON Decimal128, and
client aggregates use checked BigInt arithmetic. Charts may use numbers for plotting;
the persisted ledger and financial totals must not use floating-point accumulation.

The API validates the immutable `money_v1` metadata and refuses legacy amount storage.
A fresh empty database is initialized with the configured currency. Existing data must
be migrated offline; changing `.env` is not a migration or FX operation.

1. Stop **every** old/new API, scheduled worker and external data writer. Block ingestion.
2. Take and restore-test an encrypted backup (section 4). Preserve old image digests.
3. Build the migration tool from the reviewed commit: `cd server && go build -o /secure/migrate-money ./cmd/migrate-money`.
4. Generate a private dry-run report, with `MONGO_URI` injected only into the process:

```sh
/secure/migrate-money --database finance_db --currency USD --report /secure/money-plan.json
```

This dry run opens the database for reads only. Review the 0600 report against actual
statements: opening/closing balances, transaction types, ownership, referenced accounts,
savings/categories, currency and precision. Noise such as `0.30000000000000004` is an
issue, not silently rounded. Missing currency is resolved only by the operator's chosen
historical currency. Existing opening balances must reconcile; inferred openings need
separate explicit approval. Transfers and deleted postings are handled in reconciliation.

Legacy recurrence needs an explicit checkpoint file when the plan identifies ambiguity:

```json
{
  "SUBSCRIPTION_OBJECT_ID": {"processed": 4, "next": "2026-10-01T00:00:00Z"}
}
```

Use the report to determine the correct next anchored occurrence. Do not guess or reset
processed counts to replay charges. Supply the same reviewed `--schedules /secure/checkpoints.json`
to dry run and apply. The tool is bounded to 2,000 documents / 8 MiB to fit one atomic
migration. Larger datasets require a reviewed batched migration design and evidence;
do not remove the bounds to force a production dataset through it.

When all issues are resolved and the exact plan SHA-256 has been approved:

```sh
/secure/migrate-money --database finance_db --currency USD \
  --report /secure/money-apply.json --apply --writers-stopped \
  --expected-plan APPROVED_PLAN_SHA256 --accept-inferred-openings
```

Include `--accept-inferred-openings` only after approving those actual values; do not
copy it blindly. A new report path is required (reports are never overwritten).
The apply re-reads the original records/counts and refuses a changed plan, concurrent
modifications or digest mismatch. Data changes and schema metadata commit together
with snapshot reads/majority writes. Reconcile again, then start matching new images.
Keep old clients off the API: bounded sync/currency/storage changes require a coordinated
release. Desktop/Electron packages are not covered by these web release gates.

## 4. Encrypted backup, restore and freshness

`scripts/backup.py` requires `mongosh`, MongoDB Database Tools, age and Python. The
`deploy/backup/Dockerfile` packages them in a non-root image. Build/update and review
that administrative tool image separately; API/web/edge vulnerability gates do not
claim coverage of every installed operator utility.

Store an age recipient/public key with the backup process; store the private identity
elsewhere under independent custody, mode 0600. Backups and their private manifests
contain sensitive information and require restricted storage, encrypted offsite copies,
retention policy and access auditing. Never put them in Git or public artifacts.

Backup is intentionally offline: stop all writers and keep them stopped until both
inventories complete. The before/after check is an additional safeguard, not a live
snapshot/PITR substitute. It rejects changed records/indexes and removes partial output.

```sh
# MONGO_URI and AGE_RECIPIENT supplied by the secret/environment manager.
python3 scripts/backup.py backup --database finance_db --archive /secure/finance-001.age
# Explicitly execute after reviewing the target and stopping writers:
python3 scripts/backup.py backup --database finance_db --archive /secure/finance-001.age \
  --apply --writers-stopped
sha256sum /secure/finance-001.age
```

The first command validates intent and prints a dry run without opening a connection.
The real command streams dump -> encryption without a plaintext archive file and
writes an encrypted archive plus a 0600 manifest containing exact document hashes,
counts, index definitions and collection options. Neither artifact is overwritten.
Keep the approved checksum separately from an attacker-writable backup directory.

Restore **only to a distinct, fresh** database named `fintrack_restore_*`. Restore uses
`MONGO_URI` for the destination cluster (which must support the same collections/indexes).
It never uses `--drop` and refuses a target containing any collection.

```sh
# Also inject AGE_IDENTITY_FILE pointing to a private mode-0600 identity file.
python3 scripts/backup.py restore --database finance_db --target fintrack_restore_drill \
  --archive /secure/finance-001.age --expected-sha256 APPROVED_ARCHIVE_SHA256 --apply
python3 scripts/backup.py check-age --archive /secure/finance-001.age --max-age-hours 26
```

A successful restore requires the approved checksum and exact restored document/index/
option inventory. A failed restore may leave a partial **isolated target**; do not promote
it. Investigate and use another fresh target. The target must be dedicated to the drill
with no other writers, not a database another application might create concurrently.
The script deliberately suppresses raw database-tool errors to avoid leaking secrets.

Schedule the freshness command in the infrastructure scheduler and route any nonzero
exit to the on-call alert receiver. Test with a deliberately stale copy. Choose backup
frequency/retention/RPO/RTO based on actual requirements. For uninterrupted production
writes and point-in-time recovery, use a managed replica-set backup/PITR service and
exercise its restore process; this offline utility does not implement managed PITR.

The PR's CI drill performs real dump/age encryption/decryption/restore with synthetic
Decimal128 records and unique indexes, rejects a wrong checksum and a nonempty target,
and deletes its ephemeral keys/archives instead of uploading them.

## 5. Runtime deployment and recurrence

Provision an authenticated MongoDB replica set with TLS, restricted network access,
majority write durability and tested backup. Use least-privilege application and
separate maintenance identities. Production Compose does not start an unauthenticated
MongoDB for you. Keep API port 8080 private; only the web ingress should be reachable.

Copy `.env.example` to a private environment file, set real configuration and the
reviewed release manifest's **API_IMAGE, WEB_IMAGE and EDGE_IMAGE digests**. Use the
same commit's matching web/API pair; don't rebuild a release on the production host.
Set `ALLOWED_ORIGINS` to the exact HTTPS origin and update Supabase redirects accordingly.
Do not use wildcards or change `BIND_ADDRESS` to expose unauthenticated infrastructure.

```sh
docker compose --env-file /secure/fintrack.env -f compose.yaml config --quiet
docker compose --env-file /secure/fintrack.env -f compose.yaml -f compose.edge.yaml config --quiet
docker compose --env-file /secure/fintrack.env -f compose.yaml -f compose.edge.yaml \
  up -d --no-build --pull always
```

The optional Caddy edge needs DNS pointing to the host, reachable inbound ports 80/443,
`APP_DOMAIN` (hostname only), `ACME_EMAIL`, and durable `edge_data` certificate storage.
It runs as non-root on internal 8080/8443 and terminates TLS, redirects HTTP and sets
HSTS. Retain/protect the certificate volume. In staging, verify certificate issuance,
renewal and the final public redirect/origin behavior; CI validates a disposable local
CA certificate, not your public DNS/ACME account. An existing trusted TLS ingress may
replace this overlay; never run Vite preview as the production server.

The API/web/edge have bounded resources, dropped capabilities, no-new-privileges and
read-only root filesystems with designated temporary/writable paths. Tune host limits
from representative tests. nginx rejects oversized requests and applies connection,
per-peer and global ingress quotas; it does not trust client-supplied forwarding headers.
Behind the bundled edge, the web proxy sees the edge as a shared peer: the ingress quota
is intentionally conservative/shared. Do not enable arbitrary forwarded-IP trust just
to avoid a quota; design and test a trusted-proxy chain before tuning it. API quotas are
also per verified user. No rate limit is a substitute for upstream DDoS protection.

Recurrence uses the new atomic worker and is opt-in with `CRON_ENABLED=true` after
migration/checkpoint review. Ticks process at most 100 subscriptions per phase, one
occurrence per subscription per tick. Bounded catch-up, CAS schedule advancement and
unique occurrence indexes prevent double posting across multiple API replicas. Reminders
also commit atomically. Poison occurrences back off for five minutes rather than
blocking all later subscriptions. Monitor backlog/errors and repair references through
reviewed changes; never delete the uniqueness index or reset checkpoints as a workaround.

The AI assistant stays `AGENT_ENABLED=false` unless a separately reviewed provider
configuration is supplied. Enable only after confirming server-only `GEMINI_API_KEY`,
`AGENT_MODEL` availability, provider data handling and budget. Rotate any historical
browser-exposed Gemini key. The user must consent before their entered description and
bounded owned catalog leave the API; model output is a draft, not an autonomous posting.
CI never sends a prompt or customer record to Gemini.

## 6. Monitoring, acceptance and rollback

Private API `/metrics` exposes bounded status-class counters, duration sum/count and
worker health/backlog metrics, with no user/financial/prompt/token/path labels. nginx
does not forward this endpoint publicly. `deploy/monitoring/prometheus.yml` and
`alerts.yml` define a private scraper and starter alerts. Connect them to your existing
Prometheus/Alertmanager infrastructure, assign an on-call owner and test notification
routing. Sample thresholds are not measured SLAs. Check backup freshness separately.

Readiness checks MongoDB; liveness checks process responsiveness. Logs include generated
request IDs, route templates, status and timing, not request bodies/tokens. Observe
uptime, error ratios, memory/CPU, storage, database primary/replication/latency, worker
failures/backlog and backup age. Keep `/metrics` private even in a multi-host deployment.

Before launch, run hosted-provider acceptance on the intended origin: two actual users,
password/OAuth/reset, profile/avatar, account/saving/category operations, expense/income/
transfer edits/reversals, duplicate retry, exports, multiple sessions and consent flow.
Run representative staged load and a restore against staging backups, including outages.
CI's bounded 320-request/8-user regression and two Chromium scenarios do not replace a
production-like soak test, real provider validation or all-browser/device coverage.

For rollback: stop writers and recurrence, capture the failed release's evidence, and
select a reviewed coherent recovery point. An older float-based binary **cannot** safely
operate on Decimal128-migrated data. Restore a pre-migration snapshot to a fresh database
and use matching older image digests only after reconciliation and explicit approval of
any lost writes; otherwise fix forward with the new schema. Never roll back just the
frontend or delete schema metadata to bypass startup guards. Preserve migration reports
and incident evidence privately; never overwrite the only good backup.
