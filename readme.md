# FinTrack

Personal finance tracking with a React/TypeScript client, Go/Gin API, MongoDB replica
set and Supabase authentication/profiles. An optional, consent-based Gemini assistant
prepares a transaction draft; the user reviews and separately confirms every save.

## Engineering baseline

The application has exact monetary storage, a reviewed offline migration tool, atomic
recurring payments, owner-isolated data and private avatars. API/web/TLS-edge containers
run non-root with read-only root filesystems. Required CI covers race/integration tests,
real browser acceptance, PostgreSQL policy isolation, a concurrent API load regression,
encrypted backup/restore, strict frontend builds and dependency/image security gates.
A manual protected release workflow publishes matching immutable image digests; it
never deploys automatically.

This is a personal tracker, **not** a certified banking/double-entry accounting product.
One currency is configured per deployment; display settings do not convert currencies.
Historical records need approved reconciliation and migration. Public hosting, provider
configuration, secrets, backups and independent release review remain operator actions.

- [Implementation and CI scope](docs/production-readiness.md)
- [Deployment, migration, private storage, backup, release and rollback](docs/operations.md)
- [Coding-agent trust boundaries](AGENTS.md)
- [Security policy](SECURITY.md)

## Development

Prerequisites: Go 1.27.1, Node 22, MongoDB 7 configured as a replica set, and a development
Supabase project. Use the committed lockfiles, not ad-hoc dependency upgrades.

```sh
cp server/.env.example server/.env
cp web/.env.example web/.env
# Fill these private files with development configuration, never service keys in VITE_*.
# Start MongoDB with a replica set, then in separate terminals:
cd server && go run .
cd web && npm ci --legacy-peer-deps && npm run dev
```

For a disposable container stack, copy the root `.env.example`, use development values,
and run `docker compose --env-file .env -f compose.dev.yaml up --build -d`. That MongoDB
configuration is development-only, not production authentication or backup provisioning.
Do not remove named volumes unless their data is intentionally disposable.

Configure Supabase email/OAuth redirect URLs for the chosen app origin. Review/apply
`query.sql`, `deploy/profiles-rls.sql` and `deploy/avatar-rls.sql` in the development
project. See the operations runbook for the private avatar bucket API configuration.
Only the public Supabase URL/anonymous key belong in the browser build.

## Validation

The authoritative automation is `.github/workflows/ci.yml`; `Required CI` rejects any
failed/skipped prerequisite. CI uses disposable databases and a fake identity provider,
never real financial records, production secrets or paid AI requests. In restricted
sandboxes, push reviewed changes to a feature PR and inspect the exact-commit GitHub
run rather than treating unavailable local tests as a pass.

Useful component commands are in `AGENTS.md`. Legacy tests for removed authentication
endpoints are retained behind `-tags=legacy`; current tests exercise the actual API.
Automatic recurring posting and AI are opt-in separately; consult the runbook before
enabling either in production. The Electron shell is not qualified by the web gates.
