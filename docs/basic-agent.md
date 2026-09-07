# Basic financial agent

`POST /api/agent/message` is a single read-only Gemini agent, separate from the
existing `POST /api/agent/draft` transaction proposal endpoint. It selects fixed
financial tools, receives their results, and can ask for more data before
answering. It is not a multi-agent framework or a background worker.

## Use

Open **Assistant**, then **Ask finances**. Give separate consent for financial
summaries (the transaction-drafting consent does not cover these richer inputs).
Ask, for example, "Compare my spending this month with last month", "How much is
left on my savings goals?", or "Which subscriptions are coming up?". Follow-up
questions include at most four prior complete turns. Clear chat, close the panel,
or sign out to remove its in-memory conversation. FinTrack does not store chat
messages; provider processing/retention is governed by the operator's Google
account and agreement, not this UI.

The default **Draft transaction** tab and explicit save confirmation are unchanged.
The new agent has no mutation, arbitrary SQL, shell, URL-fetch, or bank-transfer
tools. It cannot change records, execute a savings plan, or cancel subscriptions.

## Configuration

Use the existing `AGENT_ENABLED`, `AGENT_MODEL`, and `GEMINI_API_KEY` settings. The
feature remains disabled by default; this PR does not activate a provider or
supply billing credentials. Configure a Gemini model supporting function calling.
There is no automatic escalation to a more expensive model and no paid live-model
call in CI. Keep the provider key on the Go server, never in VITE variables.

Production reads the existing Supabase PostgreSQL connection. Development and
integration testing keep using the local/disposable PostgreSQL setup from
`docs/relational-db-migration.md`; no hosted database is needed for tests.

## Request and response

```json
{"input":"Where did I spend money this month?","consent":true,"history":[]}
```

```json
{"answer":"...","toolsUsed":["get_spending_summary"]}
```

`history` contains alternating `{role:"user",content:"..."}` and
`{role:"assistant",content:"..."}` pairs only. It is untrusted conversational text,
not authenticated tool results. Request identity comes exclusively from the
existing Supabase-authenticated request context.

## Tools and semantics

| Tool | Scope |
| --- | --- |
| `get_financial_snapshot` | Current non-archived account/savings balances and their exact total. |
| `get_spending_summary` | Income, expenses, net recorded cash flow, category totals, and current monthly category budgets, for a UTC date range of at most 366 days. |
| `get_savings_goals` | Current savings balances, targets, remaining amounts, and optional target dates. |
| `get_upcoming_subscriptions` | The next payment for each active subscription before a 1-90 day horizon, including overdue payments. NOT every renewal in that window. |

All amounts returned by tools are exact decimal **strings in major currency
units**. PostgreSQL performs aggregation; arbitrary-precision conversion avoids
int64 overflow on summed balances. Transfers and tombstones are excluded from
income/expense totals. Date ranges are start-inclusive/end-exclusive and UTC.
Current monthly budget values are not historical or prorated budgets. Savings
progress and subscriptions are recorded state, not a comprehensive forecast.

Each call uses a read-only, repeatable-read database transaction scoped by owner
and ledger currency. It is released before another model generation starts.
Separate calls may see newer data; this is not one transaction across the whole
conversation. Results include currency, observation time, and truncation flags.
Details are capped at 100 rows; supplied aggregate totals cover all matched rows.
Transaction notes and full transaction histories are not sent to the model.

## Runtime and follow-up scope

The basic loop permits four model rounds and eight tool calls, with the last
round reserved for an answer. It preserves complete model content, including
opaque thought signatures, and matches function-call IDs when returning results.
The handler uses the existing auth/rate-limit pattern, explicit consent, bounded
input/history, and a 20-second deadline. These are basic application boundaries,
not a completed AI guardrail system. Answers are plain text, not executable HTML.

Dedicated prompt-injection guardrails, formal model-quality evaluations, cost
accounting, tracing/observability, and stronger policy enforcement are intentionally
deferred. No claim of production answer quality is made. The system prompt is not
a guarantee of factual grounding or prompt-injection resistance. Query results are
correctly scoped, but the model can still misinterpret them or produce bad advice.

## Verification

Ordinary tests remain part of CI, not a model-quality evaluation suite:

- `go test -race ./...`: scripted provider/tool round-trips, signature and call-ID
  preservation, argument correction, bounds, consent/history validation, and exact
  aggregate conversion. No Gemini credentials or live calls.
- `go test -race -tags=integration ./...` with the existing exact local fixture URL:
  real PostgreSQL tool results, tenant isolation, UTC boundaries, no ledger
  mutations, tombstones/transfers, next-only subscriptions, detail caps, and totals
  beyond int64. The existing migration/ledger contracts still run unchanged.
- Browser acceptance: real disabled API fallback plus a mocked-answer UI test for
  consent, follow-ups, text-only rendering, clearing, and modal lifetime. This is
  not a live Gemini acceptance test.

Provider protocol references:
- https://ai.google.dev/api/generate-content
- https://ai.google.dev/gemini-api/docs/generate-content/thought-signatures
