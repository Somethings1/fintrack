# Security policy

Do not disclose credentials, financial records or exploit payloads in a public issue.
Report privately through GitHub private vulnerability reporting when enabled, or contact
the repository owner through an independently verified private channel. Do not assume this
repository currently has a staffed security response team or an SLA.

Treat an exposed historical `VITE_GEMINI_KEY` as compromised: revoke it in the provider console,
create a server-only replacement, and remove old deployed assets/caches. Deleting a source file
does not revoke a key. Supabase public anon keys are not service-role keys; their safety depends
on correct row-level security policies.

The required checks block build, lint, tests, dependency vulnerabilities and container scan
failures. Operators must separately enforce branch protection, TLS, ingress quotas, secrets
management, MongoDB authentication, backup/restore testing and monitoring. See the launch
blockers in `docs/production-readiness.md`.
