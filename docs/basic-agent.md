# Financial chat agent

The default **Assistant > Chat** tab can investigate recorded finances and prepare
create, update, or delete changes. All changes are reviewed and confirmed in the
conversation; users do not need to switch to the legacy Draft transaction tab.
The legacy draft endpoint/tab remains available for compatibility.

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
to 18", "Transfer 50 from Wallet to Trip savings", "Set Food's monthly budget to
300", "Remove Food's budget but keep the category", "Rename Travel to Japan", or
"Delete the duplicate lunch transaction". Ambiguous matches should cause a
clarification. Always check the actual proposal card: model intent recognition
has not yet been evaluated with a live provider.

## Tools and execution

`POST /api/agent/message` implements one bounded GenerateContent/function-call
loop. There are eleven tools:

- Existing analytics: `get_financial_snapshot`, `get_spending_summary`,
  `get_savings_goals`, `get_upcoming_subscriptions`.
- `find_records`: list/search/read transaction, account, saving, category, budget,
  or subscription records. Owner/currency come from verified request context.
  Names and transaction notes use literal substring search; optional transaction
  dates are start-inclusive/end-exclusive UTC and at most 366 days apart. Pages
  contain at most 25 records, with `nextAfterId` for stable ID-keyset pagination.
  ID order is not transaction-date order. Archived records are excluded.
- `propose_transaction`, `propose_account`, `propose_saving`, `propose_category`,
  `propose_budget`, `propose_subscription`: validate one proposed change and
  return a typed `ChangeProposal`. These tools do not execute any write.

Discovery and proposal construction use read-only repeatable-read PostgreSQL
transactions, released before model generation. Updates merge explicitly supplied
fields into the current owned record for a complete preview. Money uses exact
major-unit decimal strings. References, currency, amount precision/range, record
existence, and immutable fields are checked before returning a proposal.

One valid proposal ends the turn immediately; remaining tool calls are not run.
The UI shows exact values, before/after differences, reference IDs/names, and
warnings. Only the **Confirm change** button calls the existing authenticated
POST/PUT/DELETE API. Those endpoints revalidate ownership and financial rules.
Model text, including "yes" or a claim that a change was saved, cannot execute it.
This is a ledger-management feature, not bank-payment initiation.

The card ID is the transaction-create idempotency key. A synchronous UI lock
prevents repeat clicks on all domains. There are no automatic write retries. A
failed or ambiguous response retires the card and reloads canonical records;
users must inspect their records before requesting another change. Generic
non-transaction creates do not gain durable server idempotency in this PR.

A new message supersedes previous unconfirmed cards, allowing corrections without
leaving stale actionable proposals. Application save/discard status and proposal
fields accompany subsequent text history, but are not trusted evidence: the model
must read records again. Closing the panel or signing out removes in-memory chat.
Closing the modal, clearing chat, or switching to legacy drafts is blocked while
a confirmation is in flight. There is no persisted proposal queue or chat log.

## Configuration and consent

Keep using `AGENT_ENABLED`, `AGENT_MODEL`, and `GEMINI_API_KEY`; disabled by default.
The configured Gemini model must support function calling. No provider is enabled
implicitly, no more expensive model is selected, and no paid model runs in CI.
Keys remain server-side. Production uses the existing Supabase PostgreSQL
connection; development and CI use disposable local PostgreSQL.

Chat consent explicitly covers selected transaction details/notes, names,
balances, budgets, savings, subscriptions, and recent conversation. This is richer
than the legacy transaction-drafting consent. The application does not persist
chat; Google's processing/retention depends on the operator's provider agreement.

Defaults shown on the card: opening balance 0, savings goal 0/no deadline,
transaction timestamp now, subscription repetition limit 0 (unlimited), and
reminder days 0. Existing balances cannot be overwritten by metadata updates.
Budget limits are current monthly settings, not historical or prorated amounts.
Subscription summaries contain one next payment per active schedule, including
overdue payments, not every renewal or a full cash-flow forecast. Different tool
calls can observe newer snapshots. Analytics details remain capped at 100, with
full aggregate totals and truncation indicators.

## Verification and deferred work

Normal CI runs scripted provider/tool-loop tests, proposal validation tests, real
PostgreSQL tool/HTTP contract tests, and browser tests. New PostgreSQL tests verify
that proposal creation changes no rows, then submit the same payload through the
ordinary API and check CRUD, exact balances, reversals, budget clearing, reference
checks and tenant isolation. Browser tests use mocked model answers with real
API/database writes to verify confirmation, discard, double-click protection,
superseding cards, and uncertain-outcome handling. They are not live-model tests.

Dedicated AI guardrails, model-quality evals, cost accounting and observability
remain deferred. The prompt is not an injection defense or correctness guarantee.
Bulk/dependent multi-record changes require separate confirmations. This feature
reuses the normal API's update semantics, not durable transactions spanning
preview and confirmation; concurrent edits in another client can make a preview
stale. Durable approval state, optimistic concurrency and generic cross-session
idempotency need separate design before expanding to autonomous operations.

No merge, deployment, live-data access or live-provider calls are part of this PR.

Provider protocol references:
- https://ai.google.dev/api/generate-content
- https://ai.google.dev/gemini-api/docs/function-calling
- https://ai.google.dev/gemini-api/docs/generate-content/thought-signatures
