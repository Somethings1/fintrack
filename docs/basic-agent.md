# Financial chat agent

The default **Assistant > Chat** tab investigates recorded finances and, when the
user enables change proposals, prepares create/update/delete changes directly in
chat. Every change requires a separate confirmation card. The legacy transaction
drafting tab remains available; chat users do not need to switch to it.

## Capabilities

| Domain | Read | Create | Update | Delete |
| --- | --- | --- | --- | --- |
| Transactions | List/search notes or dates; inspect by ID | Income, expense, transfer | Requested fields with balance reversal/reposting | Reverse postings and soft-delete |
| Accounts | List/search/inspect | Named account and opening balance | Name/icon, never overwrite ledger balance | Archive subject to reference checks |
| Savings | List/search/goals | Savings account, optional opening balance/target/date | Name/icon/target/date; funding uses a transfer | Archive subject to reference checks |
| Categories | List/search/inspect | Income/expense category | Name/icon/budget; type is immutable | Archive subject to reference checks |
| Budgets | Expense-category monthly limits | Set limit on an existing category | Change monthly limit | Clear limit to zero; retain category/history |
| Subscriptions | List/search/inspect and next-payment summary | Tracked recurring schedule | Name/amount/references/reminder/repetition limit; posted start/interval immutable | Stop future FinTrack postings, not merchant billing |

Examples: "I spent 20 from Wallet on lunch in Food", "Correct yesterday's lunch
to 18", "Transfer 50 from Wallet to Trip savings", or "Set Food's monthly budget
to 300". Ambiguous matches should produce a clarification. Always inspect the
actual proposal: model intent recognition is not yet live-provider evaluated.

## Tools and execution

`POST /api/agent/message` runs one bounded GenerateContent/function-call loop.
The eleven available definitions are four analytics tools, `find_records`, and
`propose_transaction`, `propose_account`, `propose_saving`, `propose_category`,
`propose_budget`, `propose_subscription`. Request permissions control which are
exposed AND which may execute; the default read-only request has five tools.

Discovery is owner/currency scoped. `find_records` uses literal name/note substring
search and optional UTC transaction dates (inclusive start, exclusive end, maximum
366 days). Pages contain 25 records with `nextAfterId`; ID ordering is not date
ordering. Stored notes are omitted from results unless separately enabled.

Queries and proposal construction use read-only repeatable-read PostgreSQL
transactions, released before model generation. Updates preserve omitted fields.
Money uses exact major-unit decimal strings. Targets and explicit references
must be returned by owned lookups in the current request, not merely mentioned
in history. Underlying ownership/currency/precision/immutable-field checks remain.

One valid typed proposal ends the turn. Its card shows values, before/after
changes, reference names/IDs and warnings. Only **Confirm change** invokes the
normal authenticated financial API; the model has no write tool. Text such as
"yes" or "saved" cannot trigger execution. This does not initiate bank payments.

Transaction creates use the card ID as their idempotency key. A synchronous UI
lock prevents repeat clicks. Failed or uncertain saves retire the card without
automatic retries and refresh canonical records. Non-transaction creates do not
have durable cross-session idempotency. Inspect records before repeating them.

New messages supersede pending cards. Changing permissions or withdrawing consent
clears the conversation and proposals. Closing/signing out removes in-memory
chat. Confirmed-save status in later history is untrusted and must be refreshed
from tools. Closing/clearing/switching away is blocked while a save is in flight.

## Configuration, consent and observability

`AGENT_ENABLED`, `AGENT_MODEL`, and `GEMINI_API_KEY` remain server-side and disabled
by default. Production uses the existing Supabase PostgreSQL connection; local
Docker PostgreSQL supplies development/testing. CI never makes a paid model call.

Users separately enable change proposals, delete/archive proposals and stored
transaction notes. Changing any scope starts a new chat. Typed user questions are
still shared with the provider under the primary consent, so never paste secrets.
The operator switch `AGENT_CHANGES_DISABLED` blocks new proposals in both modes,
not existing cards or ordinary manual CRUD endpoints.

See `docs/agent-guardrails-observability.md` for enforced limits, credential
filtering, request/tool/provider correlation, private Prometheus metrics,
account-linked usage records, optional tariff snapshots, retention and alerts.
Chat content is not persisted by FinTrack; provider processing/retention depends
on the operator agreement. Operational usage metadata is not anonymous.

Opening balance defaults to zero; savings target zero means no target; omitted
savings date means no deadline; transaction timestamp defaults to now. Subscription
limit zero means unlimited and reminder default is zero days. Budgets are current
monthly settings, not historical/prorated figures. Subscription summaries include
one next payment per active schedule, including overdue payments, not every
renewal. Separate calls can see newer snapshots; analytics details are capped at
100 with full totals and truncation indicators.

## Verification and remaining limits

Normal CI runs scripted provider/tool tests, real PostgreSQL ledger/proposal/usage
contracts, and browser tests. Browser model responses are mocked while confirmed
CRUD uses real disposable API/database writes. Permission/redaction/cancellation/
concurrency tests are code regressions, not live-model-quality evaluations.

Formal model-quality evals remain separate. Code-enforced capabilities reduce
risk but do not guarantee prompt-injection resistance or financial correctness.
There is no durable approval queue, signed confirmation ticket, optimistic
concurrency, distributed spend quota, immutable audit ledger or automatic batch
execution. Concurrent edits can stale a preview; normal API rules still apply.
No deployment, live-data access or provider enablement is part of this PR.

Provider protocol references:
- https://ai.google.dev/api/generate-content
- https://ai.google.dev/gemini-api/docs/function-calling
- https://ai.google.dev/gemini-api/docs/generate-content/thought-signatures
