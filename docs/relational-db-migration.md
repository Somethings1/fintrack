# Relational database migration

## Runtime and local development

Supabase Auth is unchanged. Set the backend-only `DATABASE_URL` to PostgreSQL in
that same Supabase project, using its direct connection or session pooler. Use
explicit TLS (`sslmode=require`, or certificate-verified `verify-full` with the
appropriate CA). Do not use the transaction pooler for this implementation.
Never put database credentials in `VITE_*` configuration or commit them.

The current migration runner applies embedded SQL migrations on startup and
therefore needs the application-table owner's DDL privileges. Financial tables
have RLS enabled with no browser policies and grants revoked from `PUBLIC`,
`anon`, and `authenticated`. This deliberately blocks direct Supabase REST access.
The trusted Go backend uses the table-owner connection and continues enforcing
owner predicates; RLS is not a substitute for those backend checks. The existing
profile/avatar policies are separate and are not replaced by this migration.

Run `docker compose -f compose.dev.yaml up --build` with the existing Supabase
URL and public anon key configured. Development finance data stays in the local
PostgreSQL service; authentication still uses the configured Supabase project.
PostgreSQL 18 persists its versioned data directory under `/var/lib/postgresql`.
Do not delete an existing Docker volume without backing up any data needed.

## Verification without production credentials

From the repository root, start the disposable loopback fixture and run:

```sh
bash scripts/start-ci-postgres.sh
cd server
export DATABASE_TEST_URL='postgres://fintrack:fintrack@127.0.0.1:55432/fintrack?sslmode=disable'
go test -race -tags=integration -count=1 -timeout=180s ./...
```

The HTTP ledger contract assertions remain unchanged. Test harnesses validate
the exact fixture URL before DDL and allocate fresh randomly named databases;
they never drop an arbitrary `DATABASE_TEST_URL` public schema. CI builds all
commands, checks committed formatting without rewriting it, and requires backend,
frontend, browser, policy, container/security, and restore jobs to succeed.

Additional regressions cover concurrent transfers and idempotency conflicts,
failed-posting rollback, transaction type changes, recurring/reminder deduplication,
owner-isolated keyset pagination with tombstones, browser-role denial, import
metadata preservation, and rejection/rollback of invalid or non-empty imports.

## Existing data: explicit offline cutover

Back up both systems and test restoration first. Stop all Mongo and target API
and recurring-worker writers before generating the final reviewed plan and keep
them stopped through validation. The importer reads the source; it does not delete
it. Supply `SOURCE_MONGO_URI` and `DATABASE_URL` through protected process
configuration, not shell history or CI secrets on a pull request.

```sh
cd server
go build -o /secure/migrate-relational ./cmd/migrate-relational
/secure/migrate-relational --source-database finance_db --currency USD
# Review the counts and source digest, then explicitly apply that digest:
/secure/migrate-relational --source-database finance_db --currency USD \
  --apply --writers-stopped --expected-plan REVIEWED_SHA256
```

Use the actual source name and currency. The dry run is a source fingerprint,
not a complete validation of every record or a connection test for the target.
The digest includes private persistence fields, not just public JSON: opening
balances, idempotency metadata, recurrence references, and reminder deduplication.
The apply path checks the digest, rejects non-empty financial tables, locks the
target tables, validates relational constraints, and reconciles every balance
against opening balances plus active postings before committing copied rows.
Schema initialization and ledger settings happen before the data transaction;
a failed import leaves those empty structures in place, not a partial ledger.

Legacy floating-point source data must first pass the reviewed exact-money
migration. Do not infer missing historical references or silently reset balances.
After a staging rehearsal, compare row counts, ownership, balances, tombstones,
and upcoming occurrences against the stopped source before enabling writers.
Switch clients and workers together. Rollback to the untouched Mongo source is
only safe before accepting new PostgreSQL writes; after that, reconcile new
writes rather than blindly switching databases and losing them.

No CI test connects to a live Supabase or Mongo tenant. Passing CI is not approval
to perform a live cutover. The restore CI job currently validates a synthetic
PostgreSQL probe, not a full production-ledger or Supabase Auth disaster recovery.
