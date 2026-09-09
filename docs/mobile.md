# Native mobile beta

## Architecture and scope

`mobile/` is a React Native / Expo Android/iOS application. `packages/fintrack-client/`
contains portable contracts, exact money, response validation, synchronization and
transport. The existing web UI is retained, not embedded into a WebView. Go remains
the financial and agent authority and uses the existing Supabase project for auth
and PostgreSQL in production. The local native SQLite database is not a second
server ledger.

The beta has Today / Activity / Plan / Assistant destinations and a persistent
Quick Add action. Quick entry supports income, expense and transfers without AI.
Activity lists/searches/inspects transactions and supports confirmed deletion;
corrections are available through Assistant. Plan creates and edits accounts,
savings targets/deadlines, and category monthly budgets without AI. Other CRUD,
including recurring schedule management, uses the existing guarded assistant.
This is not complete native form parity with every desktop screen.

Sign-in and sign-up use the same Supabase email/password account. Email confirmation
is handled by the project's existing web confirmation flow; return to the app and
sign in after verification. Password management opens the website. OAuth, native
recovery deep links, native account deletion and store onboarding remain follow-up.
The shared client package is consumed by mobile; refactoring the existing web
services onto it is deliberately not bundled into this change.

## Running

Use Node 22.13+ within the Node 22 release line. From the repository root:

```sh
cd mobile
cp .env.example .env
# Edit the public configuration below.
npm ci
npm run android
# macOS / Xcode only:
npm run ios
# For an already installed development build:
npm start
```

Configure `EXPO_PUBLIC_API_URL` as the HTTPS origin of the web/API deployment,
`EXPO_PUBLIC_SUPABASE_URL` as its existing auth project, and
`EXPO_PUBLIC_SUPABASE_ANON_KEY` as the public anon/publishable key. Anything prefixed
EXPO_PUBLIC is embedded in the app: never use a service-role key, database password,
Gemini key, signing key or billing secret. The mobile client does not call Gemini
or PostgreSQL directly and cannot enable the server's disabled-by-default agent.

For local backend development, keep the existing `compose.dev.yaml` PostgreSQL
and Supabase Auth configuration. The normal development stack exposes its web/API
proxy on port 8088. Android emulator access to the host normally uses 10.0.2.2;
iOS Simulator uses the Mac host. Private HTTP origins are accepted only in JS
development mode; platform network policies still apply. Prefer an HTTPS staging
API for real devices and never disable production TLS or expose PostgreSQL to a
phone. An actual device cannot use the laptop's localhost as its API origin.

SQLCipher is enabled by the `expo-sqlite` config plugin. Expo Go is unsupported.
The runtime checks `PRAGMA cipher_version` and refuses to open a plaintext store.
A development build or native compilation is required after plugin changes.
`eas.json` supplies build profiles but no account/project credentials, signing
assets, paid build invocation or submission has been configured automatically.

## Local storage and offline behavior

Financial cache and drafts are scoped by SHA-256(API origin + authenticated user ID).
SQLite uses a random device-generated 256-bit SQLCipher key held in SecureStore.
Sessions use secure-store chunking with a write-last manifest because auth tokens
can exceed individual native item limits. Android backup is disabled. These
controls do not defeat a compromised/rooted OS or someone holding an unlocked app;
biometric reauthentication is not included. Validate OS snapshot/backup behavior on
actual target devices before a public release.

A first online sign-in/sync is required to obtain the immutable ledger currency,
owned accounts and categories. Afterwards, while the signed-in session is available,
quick entry can save local drafts without network access or AI. Expired/unavailable
auth sessions may require reconnection. Drafts and cached balances are clearly
separate; no pending amount is applied optimistically to a balance.

Draft state is written as uncertain BEFORE its first network submission. On a
lost response/app interruption the exact payload and idempotency key survive.
The user can inspect Activity and explicitly retry the same entry; there is no
background or automatic replay. The backend's existing transaction idempotency
prevents double-posting. Uncertain drafts are not editable into another payload
under the same key. Discard is available for unsubmitted drafts and local receipts.

Sign-out warns that all local drafts will be removed, drains in-flight cache work,
clears the account's cache/drafts, and signs out locally. It does not delete server
records. Late sync work cannot repopulate a sealed handle. Session/account changes
cancel pending network requests; a different owner gets a different database.

Chat and unconfirmed cards are in memory only. Switching screens, changing scopes,
or backgrounding clears chat. All changes still require explicit confirmation;
manual entry does not grant the model extra permissions. Successful saves refresh
canonical balances. Unknown generic create outcomes are never automatically retried:
inspect records first. Generic non-transaction creates still lack durable server
idempotency and an app termination can lose their in-memory status; this beta is
not an autonomous/offline CRUD engine.

## Exact sync and cross-device conflicts

Mobile requests `Accept: application/vnd.fintrack.exact-v1+ndjson` on existing sync
routes. The server returns decimal strings using original exact JSON lexemes,
without a float conversion. The normal web numeric transport is unchanged. A page
must contain its completion trailer before the native client commits it. Rows and
watermark are stored in one local transaction. Read views are bounded cached data,
not a guaranteed live bank balance or safe-to-spend forecast; pull to refresh or
foregrounding triggers synchronization.

Amounts are parsed with BigInt millionths and checked against currency precision.
Quick-entry dates are device-local calendar dates stored at noon with a visible
explanation. Monthly summaries use device-local month boundaries; agent queries
retain the existing UTC contract. No exchange-rate conversion is inferred.

Updated proposals include `recordVersion`, derived from the exact PostgreSQL
last_update value. Mobile PUT/DELETE requests use a quoted `If-Match` revision.
Go verifies it inside the same row lock or SQL UPDATE predicate as the write,
including ledger reversal. A mismatch returns 412 without partial postings.
Migration 005 makes revisions monotonically advance on updates, including older
web clients and recurring workers. Old clients without If-Match retain their old
contract; this is not a claim that all existing web forms now reject stale edits.
When a mobile card is stale, refresh/review instead of silently resubmitting.

## Verification and remaining release gates

Normal CI runs the existing Go/real PostgreSQL/browser/security/restore contracts
plus native-client dependency checks, TypeScript, lint, exact-money/sync/session/
retry tests, React Native component interactions, Android+iOS JS bundle export,
native project generation and Android debug compilation with SQLCipher. Public
fixture config points at reserved example domains; no production or paid AI call
is made. CI project generation is NOT an iOS Xcode build or physical-device test.

Before inviting paying customers, run a signed beta on actual Android and iPhone:
verify cold start and SQLCipher reopening, secure-session refresh, keyboard/safe
areas/large text/VoiceOver/TalkBack, offline draft recovery after force-stop, account
switch/sign-out wipe, lost-response exact retry, concurrent phone/web changes, and
agent confirmations while backgrounding. Check fresh install and uninstall/restore
behavior, especially iOS Keychain persistence. Test the chosen live model separately.

Store signing/publication, store privacy declarations, data export/deletion UX,
billing/entitlement restoration, push, biometrics, receipts/voice, bank sync and
broader accessibility/device coverage are not delivered or enabled by this PR.
The production data cutover and enabling Gemini remain deliberate deployment work.
