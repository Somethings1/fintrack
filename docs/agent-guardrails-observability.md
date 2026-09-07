# Agent guardrails and observability

This extends the financial CRUD agent, not its authority. Models still produce
proposals; users click a separate confirmation card; normal authenticated APIs
validate and apply mutations. No provider is enabled by this change.

## Enforced request boundaries

Chat begins read-only. Users opt into **Allow change proposals**, and separately
**Allow delete/archive proposals**. Both flags are validated on the Go server;
provider tool schemas are filtered AND the executor independently rejects denied
operations. Changing permissions clears the conversation and pending cards.
These flags express the authenticated user's requested scope, not an entitlement
or protection against that user calling their own normal CRUD endpoints.

Every target and explicit account/category reference in a proposal must have
appeared in an owned, current-request tool lookup. An ID in model prose, a guessed
ID, or an earlier conversation does not satisfy that check. Ownership/currency
validation in the SQL tools and mutation API remains authoritative. This prevents
invented targets from being used without lookup; it does not prove the model chose
the intended record among valid matches. Users still review before/after fields.

Incoming prompts/history are checked for high-confidence credentials (API tokens,
private keys, password assignments and credential-bearing connection URLs) and
invalid/control/direction-override text. They are rejected without echoing their
contents. Duplicate JSON keys, trailing documents and excessive nesting are rejected.
Tool arguments retain strict schemas and a 2 KiB limit. Three invalid tool attempts
stop a run. Unknown tools never reach the executor. There is no arbitrary SQL,
shell, URL-fetch or provider-selected mutation endpoint.

Stored transaction notes are omitted from provider-bound lookup results unless
**Include stored transaction notes** is enabled. Detected credentials in tool text
are redacted even with note access. Amounts remain exact strings/numbers, not
rounded by the redaction pass. Typed change previews go to the authenticated UI,
not back to the model. Final free-text answers containing detected credentials
are withheld. The legacy draft mode shares the input checks, catalog redaction,
provider instrumentation, output checks and operator proposal switch.

Resource limits: four model rounds, eight tool calls, four calls per round, 32 KiB
per tool result, 128 KiB per provider request/response, bounded history and output,
and a 20-second agent deadline. Reported output plus thinking tokens over 8,192
stop further work. Missing provider usage is unknown; byte/round/deadline bounds
still apply. There are no silent retries. A shared process-local gate allows eight
active AI requests overall and one per user across draft/chat. This is NOT a
cluster-wide quota or a monetary spending cap.

`AGENT_CHANGES_DISABLED=true` blocks new chat proposals and legacy draft requests.
It does not revoke cards already returned or disable manual finance endpoints.
`AGENT_ENABLED=false` disables model-backed endpoints. These settings take effect
when the service is restarted/redeployed through the normal deployment process.

## Privacy-conscious observability

Each accepted-to-gateway request receives a server-generated UUID in
`X-Agent-Run-ID`. Chat displays it as a support reference. Structured JSON events
`agent_request`, `agent_provider`, and `agent_tool` share that ID and contain only
fixed operation/outcome labels, timings, token counters and known-cost estimates.
No prompt, response text, financial record, owner ID, credential, tool argument,
provider error body or connection URL is written to these agent logs.
Authentication failures before this gateway use existing HTTP request logging.

The existing private `/metrics` endpoint exports:

- `fintrack_agent_events_total{stage,operation,outcome}` and latency histograms
  `fintrack_agent_duration_seconds`: request/provider/tool counts and duration.
- `fintrack_agent_guardrails_total{reason}`: fixed rejection/redaction categories.
- `fintrack_agent_tokens_total{kind}`: provider-reported prompt/cached/output/thinking/total.
- `fintrack_agent_usage_total{known}` and `fintrack_agent_cost_estimates_total{known}`.
- `fintrack_agent_estimated_cost_usd_total`, `fintrack_agent_in_flight`, and
  `fintrack_agent_usage_write_failures_total`.

Labels are allowlisted; no user, run ID, model-generated name or raw error can
create an unbounded series. Counters reset with the process: scrape every replica
and use Prometheus rate/increase, not manual cumulative sums across restarts.
Prompt includes cached tokens; total includes other components. Do not sum every
`kind` together. `/metrics` must stay on the private application network, behind
operator access controls, never publicly proxied by the browser frontend.

## Durable usage and cost estimates

Migration `004_agent_usage.sql` creates an operator-only, RLS-enabled table with
browser-role grants revoked. It stores one row per run that attempted a provider
call: authenticated owner, model, mode, outcome, counts, known token totals,
unknown/unpriced call counts, elapsed time and price snapshots. This is
**account-linked operational metadata, not anonymous data**. It stores no chat
content or financial records and is never a model tool.

Recording is best-effort with a two-second bound, even after client cancellation;
that does not restart a canceled model call or financial operation. Duplicate run
IDs cannot double-count. Database failures increment the loss metric. Process
crashes can lose a record. Do NOT bill customers from this table as an exact
provider invoice, and do not assume failed requests cost zero.

Set all three optional prices as integers in micro-USD per million tokens:
`AGENT_INPUT_MICRO_USD_PER_MILLION`, `AGENT_CACHED_MICRO_USD_PER_MILLION`,
`AGENT_OUTPUT_MICRO_USD_PER_MILLION`. For illustration ONLY, 100000 represents
$0.10 per million tokens; no current model price is asserted by this example.
Unconfigured prices produce unknown cost, not zero. Explicit zero rates are
supported. Update rates with the selected model and provider agreement. The
calculation separates uncached/cached input and counts thinking with output;
built-in paid search tools and provider billing adjustments are not modeled.

Operator query for recent per-user cost (never expose as a public endpoint):

```sql
SELECT owner, count(*) AS runs,
       sum(provider_calls) AS provider_calls,
       sum(unknown_usage_calls) AS unknown_usage_calls,
       sum(unpriced_calls) AS unpriced_calls,
       sum(estimated_cost_nano_usd)::numeric / 1000000000 AS estimated_usd
FROM agent_usage
WHERE recorded_at >= date_trunc('month', now())
GROUP BY owner
ORDER BY estimated_usd DESC;
```

The service opportunistically deletes up to 100 rows older than 90 days per
recorded run. For a strict retention policy, configure an operator-owned scheduled
purge, including backups/log retention and account deletion obligations. No
scheduler or production retention job is deployed by this PR.

## Operations

The existing alert rules include agent provider failures, elevated p95 latency,
missing usage, and lost usage writes. Calibrate thresholds to observed traffic;
low-volume alerts include minimum call counts. Correlate a UI reference with the
three JSON event types, identify the failing fixed tool/outcome, and reproduce
with synthetic data. Never request a user's password, API token or entire ledger
as a debugging substitute. There is no third-party tracing export by default.

Example latency query:

```promql
histogram_quantile(0.95,
  sum by (le) (rate(fintrack_agent_duration_seconds_bucket{stage="request"}[5m])))
```

## Verification and residual limitations

Normal CI runs unit/race tests, real disposable PostgreSQL usage/guard regressions,
and browser tests alongside existing ledger contracts. Providers are scripted or
mocked: no production database or paid Gemini call is used. The unit tests cover
permission bypass, fresh lookup evidence, redaction, exact totals, malformed JSON,
provider usage/cost parsing, cancellation, concurrent requests and log privacy.

These guards reduce reachable capabilities; regexes and system instructions are
NOT a complete PII detector, semantic intent validator, prompt-injection defense,
or guarantee of financial-answer correctness. Formal model-quality/adversarial
live-model evaluations remain separate. No signed/durable approval tickets,
optimistic concurrency, cluster-wide quotas, automatic retries, immutable audit
ledger or non-transaction create idempotency are introduced here. A preview may
become stale after another client edits a record; normal API rules still apply.

References: Google GenerateContent usage metadata (https://ai.google.dev/api/generate-content),
Prometheus instrumentation practices (https://prometheus.io/docs/practices/instrumentation/),
and OWASP prompt-injection guidance (https://genai.owasp.org/llmrisk/llm01-prompt-injection/).
