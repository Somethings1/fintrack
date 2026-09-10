# Production-readiness implementation

This repository contains production hardening and executable acceptance gates, not a
certification of an uninspected live deployment. See [operations](operations.md) for
migration, private storage, release, backup, TLS, monitoring and rollback procedures.
Nothing in pull-request CI connects to production, enables AI, or publishes images.

## What is implemented

| Area | Implementation | Verification |
| --- | --- | --- |
| Money | Checked fixed-point Go amounts, BSON Decimal128, explicit immutable deployment currency, precision validation, exact client sums | Unit and real MongoDB integration tests, including 0.10 + 0.20 and type checks |
| Historical data | Dry-run offline migration; deterministic reviewed plan, ownership/reference checks, opening-balance reconciliation, transactionally guarded apply | Real database migration/refusal/concurrent-change tests |
| Recurrence | Anchored UTC schedules, bounded catch-up, atomic occurrence posting and schedule/balance changes, unique occurrence constraints, atomic reminders, poison-item backoff | Concurrent-worker/retry/rollback/month-end/leap-year tests |
| Authentication | Verified Supabase identity, bounded upstream calls, strict origins, owner-scoped mutations, secure WebSocket session establishment | Stubbed identity provider with real handlers/database; invalid auth and cross-tenant tests |
| Privacy | Owner-isolated IndexedDB, private avatar paths, client image re-encoding, short-lived signed URLs; restrictive profile/storage RLS boundaries | Browser account-switch test and PostgreSQL Alice/Bob/anonymous policy tests |
| Agent | Authenticated backend Gemini draft adapter, opt-in data-sharing consent, bounded catalog/input/output/time/concurrency, independent validation, separate manual save | Adversarial/failure unit tests and browser consent gate; no live model call in CI |
| CI | Commit-pinned Actions, read-only PR permissions, strict aggregate, race/integration/lint/type/build/audit/image scans | Required CI fails unless every prerequisite succeeds |
| Performance | Compound sync indexes, bounded keyset/NDJSON protocol, batched IndexedDB writes, lazy routes/exports, exact lookup maps, bundle budgets | Bundle gates and 320-request authenticated concurrent posting regression |
| Runtime | Non-root read-only API/web/TLS edge, security headers, limits, readiness, graceful shutdown, protected metrics | Image builds, container smoke, certificate-validated local TLS smoke, secret/vulnerability scans, SBOMs |
| Recovery | Streamed age-encrypted Mongo backup, exact document/index inventories, fresh-target restore, checksum/freshness checks | Disposable real database encrypted restore drill; wrong checksum and existing target rejection |
| Release | Manual protected-environment workflow, exact-main-commit CI and review-rule verification, re-smoke/re-scan candidate images, immutable digest manifest | Release preflight refusal unit tests; actual publication requires operator approval |

## Required CI

`.github/workflows/ci.yml` runs on pull requests, main pushes, manual dispatch and a
weekly schedule. `Required CI` requires all six jobs to finish successfully:

- **backend**: module verification, formatting, vet, race unit/integration tests,
  actual API/database load regression, build, reachable Go vulnerability scan;
- **frontend**: clean lockfile install, zero-warning lint, regression tests, strict
  TypeScript/build, 450 KB initial / 1.1 MB total gzip JavaScript budgets, npm audit;
- **containers**: Compose validation, API/web/edge builds, least-privilege runtime
  smoke, shutdown, TLS certificate verification, source secret scan, high/critical
  image vulnerability gates and CycloneDX SBOMs;
- **Policy isolation**: real PostgreSQL RLS with two identities and anonymous access,
  including intentionally broad legacy policies; operational release-guard tests;
- **Browser acceptance**: Chromium against the built client, real API and replica-set
  database; Supabase alone is a disposable test double; authenticated saves, exact
  balances, reload, consent, logout/revocation and same-browser user-switch isolation;
- **Encrypted restore drill**: real dump/encrypt/decrypt/restore, document and index
  verification, Decimal128 retention and refusal to overwrite an existing target.

Evidence artifacts include coverage, browser failure traces/screenshots and image
SBOMs. Fixtures contain synthetic data only. The backup drill does not upload keys or
archives. Dependency scans are thresholded point-in-time checks, not proof of absence
of all vulnerabilities. `server/test` is obsolete legacy-auth coverage behind the
`legacy` build tag, not silently represented as current integration coverage.

## Scope and remaining operator decisions

The monetary model is **one currency per deployment**, with no FX conversion or mixed
currency totals. Supported precision is explicit in `server/money/amount.go` and the
client configuration validator. Changing a profile setting cannot relabel balances.
The application is a personal tracker, not a regulated bank, immutable double-entry
accounting system, tax-compliance product or externally audited financial ledger.

Migration is intentionally limited to 2,000 documents / 8 MiB per plan. Larger data
sets need a separately reviewed batched migration, not disabling this guard. An
operator must choose the real historical currency, reconcile inferred openings with
statements, approve recurrence checkpoints, stop writers and approve the plan hash.
The API refuses incompatible legacy storage instead of silently rounding it.

Local policy fixtures do not certify a particular hosted Supabase project, OAuth
configuration or Storage deployment. Apply the scripts in a staging project, inspect
existing functions/grants and exercise real account/profile/avatar access before
launch. Public legacy avatar URLs are not reused; owners must re-upload authorized
images to the private bucket.

CI load testing is a bounded regression workload on a GitHub runner, not a claimed
production capacity, SLA or soak test. Monitoring alert thresholds are starter policy
and need a named operator, a configured scraper/alert receiver, representative staged
load and realistic host/database sizing.

Repository rules, independent reviewers, hosted databases, DNS, secrets, ACME,
backup retention/offsite storage/PITR and key custody require operator configuration.
[operations](operations.md) supplies executable tools and exact rollout steps. No
live-data migration, repository-administration mutation, registry publication or
production deployment is performed by the hardening PR.

## Development

Use Go 1.27.1, Node 22 and MongoDB 7 with a replica set. Copy the environment examples
and use a development Supabase project. For native development run a local replica
set, `go run .` in `server`, and `npm ci --legacy-peer-deps && npm run dev` in `web`.
Vite proxies `/api` and WebSockets to the local API. Set `LEDGER_CURRENCY` explicitly
when importing any historical data. Development defaults to USD only for fresh data.

Alternatively use `docker compose --env-file .env -f compose.dev.yaml up --build -d`.
That manifest's unauthenticated, host-unexposed MongoDB is **development only**.
`down` preserves the named volume; `down --volumes` destroys its data.

## Design references

- MongoDB transactions: https://www.mongodb.com/docs/manual/core/transactions/
- MongoDB backup tools: https://www.mongodb.com/docs/database-tools/mongodump/
- Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase private storage: https://supabase.com/docs/guides/storage/security/access-control
- Go vulnerability scanning: https://go.dev/security/vuln/
- Caddy HTTPS: https://caddyserver.com/docs/automatic-https
- Gemini structured output: https://ai.google.dev/gemini-api/docs/structured-output
- SheetJS distribution: https://docs.sheetjs.com/docs/getting-started/installation/nodejs/
