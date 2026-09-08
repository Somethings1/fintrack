# FinTrack mobile beta

Native Android/iOS client sharing FinTrack's Go/PostgreSQL API and Supabase Auth.
This branch is under active implementation. Native device acceptance, signing,
store submission, and billing are separate from source/CI verification.

SQLCipher requires a development/native build, not Expo Go. Financial drafts are
local-only until explicitly submitted; no background financial posting is added.
