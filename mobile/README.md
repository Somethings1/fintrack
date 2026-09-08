# FinTrack mobile beta

Native React Native / Expo Android and iOS client sharing FinTrack's Go API,
Supabase Auth, PostgreSQL ledger and guarded assistant. See [the mobile runbook](../docs/mobile.md).

```sh
cd mobile
cp .env.example .env
# Set your public HTTPS API URL, Supabase URL and public anon/publishable key.
npm ci
npm run android
# On macOS with Xcode configured:
npm run ios
```

Use a native development build, **not Expo Go**: the encrypted SQLite store
requires SQLCipher. `npm start` starts Metro for an already-installed development
client. Device signing, simulator setup, and any external EAS account setup are
operator actions, not performed by this PR.

The beta includes quick entry without AI, explicit offline drafts, activity,
account/saving/category editors and the existing guarded chat CRUD. PostgreSQL
remains authoritative; local drafts do not alter balances until confirmed online.
No automatic financial replay, app-store billing, biometric unlock, push alerts,
receipt scanning, or bank synchronization is included.
