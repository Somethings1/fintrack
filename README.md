# FinTrack

> Your AI-powered finance copilot for tracking, planning, and managing money across web and mobile.

[![CI](https://github.com/longnt27/fintrack/actions/workflows/ci.yml/badge.svg)](https://github.com/longnt27/fintrack/actions/workflows/ci.yml)

FinTrack is a full-stack personal finance application with exact-money accounting, web and native mobile clients, PostgreSQL persistence, Supabase authentication, offline mobile drafts, and a guarded AI assistant that can analyze and manage financial records through explicit user confirmation.

## Highlights

- **Track money precisely** — accounts, transactions, transfers, categories, budgets, savings goals, subscriptions, and notifications.
- **Use natural language** — ask about balances, spending, savings, budgets, and recurring expenses.
- **Manage records in chat** — create, update, and delete financial records through reviewable proposals and explicit confirmation.
- **Web + native mobile** — React web client and React Native / Expo Android+iOS client backed by the same API and ledger.
- **Offline mobile capture** — encrypted SQLCipher cache and local transaction drafts; PostgreSQL remains authoritative.
- **Production-oriented backend** — exact fixed-point money, idempotent transaction writes, tenant isolation, stale-write protection, health checks, migrations, and encrypted restore testing.
- **Guarded AI execution** — scoped tools, permission gates, bounded execution, credential filtering, redaction, confirmation boundaries, usage accounting, metrics, and structured logs.

## Architecture

```text
              Web                              Mobile
        React + Ant Design              React Native + Expo
                 │                              │
                 └──────────────┬───────────────┘
                                │ HTTPS
                                ▼
                         Go / Gin API
                    ┌───────────┼───────────┐
                    │           │           │
              Supabase Auth  Agent layer  PostgreSQL
                               │           authoritative
                               ▼             ledger
                         Gemini API

Mobile only:
SecureStore + SQLCipher SQLite cache / offline drafts
```

The browser and mobile applications never connect directly to PostgreSQL or Gemini. Financial authorization and writes remain server-side.

## Stack

| Layer | Technology |
| --- | --- |
| Web | React, TypeScript, Vite, Ant Design |
| Mobile | React Native, Expo, SQLCipher SQLite, SecureStore |
| API | Go, Gin |
| Database | PostgreSQL |
| Authentication | Supabase Auth |
| AI | Gemini API behind the Go service |
| Runtime | Docker / Docker Compose |
| CI | GitHub Actions |

## Quick start

### Web + API

Requirements: Docker, Docker Compose, and a development Supabase project.

```bash
git clone https://github.com/longnt27/fintrack.git
cd fintrack
cp .env.example .env
```

Set at least `SUPABASE_URL` and `SUPABASE_ANON_KEY` in `.env`, then start the local stack:

```bash
docker compose -f compose.dev.yaml up --build
```

Open `http://localhost:8088`.

Local development uses disposable PostgreSQL via Docker. The AI assistant is disabled by default; enable it only after configuring the provider settings in `.env`.

### Mobile

The mobile client requires a native development build because its local database uses SQLCipher; Expo Go is not supported.

```bash
cd mobile
cp .env.example .env
npm ci
npm run android

# macOS + Xcode
npm run ios
```

See [`mobile/README.md`](mobile/README.md) and [`docs/mobile.md`](docs/mobile.md) for configuration and device acceptance requirements.

## AI safety model

FinTrack follows a simple boundary:

**The model proposes. Application code authorizes. The user confirms.**

The assistant receives only bounded, user-scoped tools. Chat starts read-only; change and delete proposals require explicit permissions. Financial mutations are executed by the existing authenticated API only after confirmation, and transaction writes retain normal ledger validation and idempotency guarantees.

AI is optional and disabled by default in configuration.

## Data and correctness

- Monetary values use fixed-point integer millionths; the ledger does not use floating-point arithmetic for stored money.
- PostgreSQL is the source of truth for financial records and balances.
- Transaction writes use database transactions, ownership checks, exact balance reversal/reapplication, and idempotency keys.
- Mobile sync uses exact decimal strings and record revisions; stale mobile edits fail instead of silently overwriting newer changes.
- Offline mobile drafts do not affect balances until successfully posted online.
- Direct browser access to financial PostgreSQL tables is denied; the Go service remains the financial authorization boundary.

## Production deployment

Production expects:

- PostgreSQL over TLS — typically the same Supabase project used for authentication.
- HTTPS-only public traffic and explicit allowed origins.
- Server-side provider credentials only.
- Database backups, restore drills, monitoring, and alerting operated outside the application container lifecycle.
- Immutable image references rather than `latest`.

Start with [`docs/production-readiness.md`](docs/production-readiness.md) and [`docs/operations.md`](docs/operations.md) before deploying.

## CI and quality gates

The required GitHub Actions pipeline covers:

- Go formatting, vet, race-tested unit and PostgreSQL integration suites
- Exact-money and ledger contract tests
- Web lint, tests, typecheck, build, dependency and bundle checks
- Real browser/API/database acceptance tests
- Mobile TypeScript, lint, contract/component tests, Android+iOS bundle export, native project generation, and Android native compilation
- Tenant/policy isolation
- Container builds, smoke tests, TLS checks, vulnerability scanning, and SBOM generation
- Synthetic encrypted PostgreSQL backup/restore verification

## Documentation

- [Agent behavior and CRUD semantics](docs/basic-agent.md)
- [Agent guardrails and observability](docs/agent-guardrails-observability.md)
- [Mobile architecture and runbook](docs/mobile.md)
- [Operations runbook](docs/operations.md)
- [Production readiness](docs/production-readiness.md)
- [PostgreSQL migration notes](docs/relational-db-migration.md)
- [Security policy](SECURITY.md)

## Repository layout

```text
server/       Go API, ledger, migrations, agent, integrations
web/          React web application
mobile/       React Native / Expo application
packages/     Shared client contracts and exact-money utilities
e2e/          Browser acceptance tests
docs/         Architecture, operations, security, and runbooks
deploy/       Deployment assets
```

## Security

Please report security issues through the process described in [`SECURITY.md`](SECURITY.md). Do not include credentials, tokens, or private financial data in public issues.

---

FinTrack is actively evolving. Mobile store distribution, commercial billing, and live-model quality evaluation are separate release concerns and should be validated before offering the product as a paid public service.
