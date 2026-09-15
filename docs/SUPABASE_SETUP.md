# Supabase setup and release checklist

The accounts/demo implementation is prepared locally. Do not merge it into `main` until the target Supabase project and the two Vercel environment variables below are configured and live account tests pass. The existing Vercel project already deploys `main` automatically.

## 1. Choose the project

The dedicated **Budget Tracker** project is `rslyrynvskjaxtsvsvqb`, in **Evyn's workshop**, Free plan, US East. Creation was quoted at $0/month and approved. **Forge belongs to Portfolio and must not be used or modified.** Keep database credentials out of the app and Git.

## 2. Apply the migration

The included `supabase/migrations/20260915020323_user_budget_data.sql` was applied to this hosted project through the migration connector on September 15, 2026. Do not apply it again. Verify migration history before subsequent CLI migrations.

It creates:

- `public.user_budget_data`: one JSONB document per `auth.users.id`, with `revision`, `last_write_id`, and timestamps.
- RLS SELECT/INSERT/UPDATE policies restricted to `auth.uid() = user_id`; no anonymous table access and no client DELETE grant.
- An ownership-preserving revision/timestamp trigger.
- `public.save_budget(data, expected_revision, write_id)`, a SECURITY INVOKER function that derives the user from the session, rejects stale revisions, and safely retries an acknowledged write ID.

No Supabase Storage bucket, Vercel Blob store, Realtime subscription, or Edge Function is required. JSON documents use `schemaVersion: 1`, retain the full budget state, and have a 5 MiB database limit. Future document versions need an explicit upgrade path before the version check changes.

## 3. Authentication

In Supabase Authentication:

1. Enable email/password signup. Keep email confirmation enabled. Do not enable anonymous sign-ins for demo mode.
2. Set Site URL to `https://budget-tracker-theta-indol.vercel.app/`.
3. Add these exact redirect URLs:
   - `https://budget-tracker-theta-indol.vercel.app/`
   - `http://localhost:5173/` for local verification (configured)
   - The exact preview origin, only if testing email links on a Vercel preview
4. Configure a custom SMTP sender for public signup and password-reset emails. Supabase's default sender is restricted to authorized team addresses and is not a production email service. Keep SMTP credentials in Supabase, never in Vite variables.

Sources: [password authentication](https://supabase.com/docs/guides/auth/passwords), [redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls), [SMTP configuration](https://supabase.com/docs/guides/auth/auth-smtp).

## 4. App configuration

Copy `.env.example` to `.env.local` at the repository root and fill in:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

Use the project's HTTPS API URL and a modern `sb_publishable_...` key from Supabase's Connect/API Keys screen. Never use a secret key, legacy service-role JWT, database password, or SMTP credential. These two browser-facing values are public configuration; RLS protects the data.

Both values are configured in the **existing** Budget Tracker Vercel project for Production, Preview, and Development, and in ignored local `.env.local`. Vite embeds them at build time. No redeployment was triggered; production remains unchanged. Preserve the project name and all domain assignments. Build settings remain Vite, repository root, `npm ci`, `npm run build`, `dist`, Node 24.x. Deploy production only after explicit release approval.

Without configuration, signup/sign-in are disabled and the demo still works. This is a local setup fallback, not a reason to deploy before configuration is complete.

## 5. Verify before pushing main

```sh
npm ci
npm test
npm run lint
npm run build
```

Then verify against the configured project using two dedicated test accounts with email addresses you control:

- Signup and email confirmation; correct/wrong password; refresh; sign out; password-reset email and new-password screen.
- Save a transaction, refresh, sign out and back in, then sign in on a second browser/device.
- Each user sees only their own data; attempts to read/update the other user's ID return no rows or permission errors. Anonymous reads and RPC calls must fail.
- Temporarily interrupt networking: edits remain visible, status shows failure, retry/reconnect saves them. Closing before a successful save retains a recovery copy, subject to browser storage availability.
- Edit one budget on two devices: the stale writer must show a conflict without replacing the newer cloud copy.
- Seed legacy browser data in a test profile: migration is offered only for an empty account, and original keys survive failed and successful uploads. Start Fresh must leave the legacy source untouched.
- Try Demo, modify/delete entries, use all tabs and import/export, reset, exit; no budget requests should reach Supabase.

Tests in `tests/database.test.js` execute the actual migration in a local PostgreSQL engine (PGlite) with two simulated JWT subjects. UI tests exercise the actual app with mocked auth/network responses. These are not a substitute for the hosted Supabase/email tests above.

After successful hosted tests, report results and wait for explicit release approval before pushing/merging to `main` or deploying production. No second Vercel project is needed.

## Data behavior and recovery

- **Account startup:** the cloud load must succeed before the budgeting UI opens. A failed load never initializes and uploads an empty replacement budget.
- **Autosave:** changes are queued with a 650 ms debounce, written serially, and tagged with a unique write ID. Writes time out after 20 seconds and retry every 15 seconds or on reconnect/manual retry. The UI shows unsaved/saving/saved/failure status.
- **Conflicts:** optimistic revisions prevent silent overwrites. Export local QBUD2 data, then load the cloud copy; the displaced draft is also archived locally. Importing the export later is an explicit replacement decision.
- **Legacy migration:** original keys (`transactions`, `bucketTransfers`, `subscriptions`, `debtsOwedToMe`, category keys, `creditCards`, `bucketLabels`) are read only. Move to My Account creates a per-user recovery copy and queues the upload. Start Fresh uploads an empty document and leaves legacy keys intact. Derived `balance` is recalculated from transactions.
- **Demo:** fictional relative-date data is seeded under `budget-demo-data`. Resets create a fresh independent dataset. `budget-mode` in sessionStorage retains demo mode through refresh. No Supabase client is initialized when an existing demo session starts.
- **Backups:** QBUD2 compressed/raw text and historical JSON backups remain supported. Invalid/unsupported documents are rejected before replacement. Authenticated imports autosave; demo imports remain local.
- **Logout:** cloud data is never deleted. A clean local account draft is removed after successful logout. If saving fails, the user can export and explicitly sign out while retaining the per-user recovery copy.

## Security and practical limits

RLS is the authorization boundary, not the UI or an email field. Data requests pin the originating account's access token; stale sessions cannot send one account's document under another account's identity. Demo storage is separate from legacy and account drafts.

Legacy data and unsaved recovery copies deliberately remain in browser storage. They are not encrypted against someone with access to the same browser profile or device. Auth tokens are persisted by Supabase for refresh continuity. Use a trusted browser profile and keep exported backups private. Archived cross-tab drafts use `budget-recovery:<user-id>:...`; they can be recovered from browser storage if necessary.

The app loads cloud state when a session opens; it does not provide live collaborative editing. Concurrent edits require the explicit conflict workflow. Clearing browser storage can remove unsaved drafts and legacy data; export backups before clearing it.
