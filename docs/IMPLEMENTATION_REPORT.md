# Accounts, cloud storage, and demo implementation

## Release status

September 17: the user explicitly approved publishing to main with a visible note that password resets currently do not work. The auth screen includes that note. This approval supersedes the earlier release hold below; unresolved test items remain documented.

Implemented locally on `codex/accounts-cloud-demo`, checkpoint `9fc0855c8ffbdee5f460ac8d74048305a608e142`. Hosted setup is now configured. No accounts code has been pushed to `main` or deployed to production. Forge is untouched. Production continues to serve the previous browser-local version. **Not ready for release approval: password-reset completion and remaining hosted checks are still pending.**

## Hosted setup and verification — September 15, 2026

Password-reset retesting is deferred at the user's request. The user authorized pushing updates to the feature branch; this does not approve merging or deploying production. The remaining hosted checks below are still recorded accurately.

- Project: **Budget Tracker**, ref `rslyrynvskjaxtsvsvqb`, US East, **Evyn's workshop**, Free plan. Supabase quoted $0/month; creation was explicitly approved.
- Included migration applied successfully through the migration connector. `public.user_budget_data` has enabled and forced RLS, ownership SELECT/INSERT/UPDATE policies, revision trigger, and the security-invoker `save_budget` RPC.
- Actual hosted PostgreSQL tests passed using two temporary JWT subjects under the authenticated role: cross-user reads/updates blocked, foreign-owner insertion denied, anonymous reads/RPC denied, idempotent retries and stale-write rejection. Test rows were rolled back. These are real database-role tests, not two independently logged-in browser accounts.
- Unauthenticated HTTP requests using the publishable key returned 401 for both table reads and save RPC. Security advisor returned no findings.
- Email/password signup and email confirmation enabled; anonymous sign-in disabled. Site URL and redirect allowlist use `https://budget-tracker-theta-indol.vercel.app/`, plus exact `http://localhost:5173/` for local testing.
- Only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are configured in ignored local `.env.local` and the existing Budget Tracker Vercel project for Production/Preview/Development. No secret/service-role/database credentials were used in the frontend. No redeployment triggered.
- User completed signup and confirmation. Hosted user record confirms email verification. User selected **Move it to my account**, and the migrated budget loaded successfully from Supabase.
- Browser-created test transaction autosaved and was confirmed in hosted SQL. A fresh page retained the signed-in session and loaded the saved transaction. Test transaction was then deleted through the UI and verified absent in the database. Logout and incorrect-password rejection passed.
- Demo loaded fictional data, accepted an edit, restored sample data on reset, and exited to login. Its unique test marker never appeared in cloud data. Namespace separation and zero demo repository calls are also covered by automated tests.
- Reset email was sent, but the user encountered `otp_expired` after opening it. The app previously hid that callback error behind the existing dashboard. Root now displays a clear email-link error while preserving the session/data; a regression test covers this case. A browser check confirmed the message.
- A fresh reset request returned **email rate limit exceeded**. Default SMTP currently allows two emails/hour and team addresses only. Keep it for initial team testing; public signup needs custom SMTP. See [Supabase SMTP limits](https://supabase.com/docs/guides/auth/auth-smtp).
- Hosted testing also exposed unnecessary saves after JSONB reordered object keys. SaveQueue now compares canonical JSON; a regression test verifies that reordered nested keys do not trigger a save while a real edit does. After the fix, a fresh browser page left the hosted revision unchanged.
- Hosted conflict recovery successfully archived local test edits and reloaded the unchanged cloud copy.
- After logout and login, the budget returned. Authenticated backup export/import passed in the browser: a temporary category was saved to Supabase, then importing the original QBUD2 backup restored the exact original document hash and removed the category. Hosted revision advanced from 11 to 12 to 13 as expected.
- Demo backup export/import also restored its original categories after a temporary edit. No cloud budget changes resulted.

### Remaining hosted checks

September 17 follow-up: recovery links now open account mode even when the tab previously used Demo Mode. Once Supabase emits PASSWORD_RECOVERY, the recovery screen survives refresh using a tab-local user-ID marker. The marker is UI state only, contains no token or password, is restricted to the matching authenticated account, and is cleared on successful password update or sign-out. Failed password updates keep the form available. All 26 tests, lint, and build pass. A fresh hosted reset email was accepted, but the user reports the link does not work; the exact symptom is awaiting clarification. Password-reset completion is still unverified.

Complete a fresh reset email and new-password submission after the sender limit clears, then verify login with the new password. The last successful reset email was sent at 18:25:59 UTC (2:25:59 PM Eastern); allow the default sender's hourly window to clear before requesting another. Hosted offline/retry recovery and Start Fresh/failed legacy upload checks on a separate test account/profile remain pending. Automated tests cover these paths but do not replace hosted verification. No production merge or deployment is approved.

## Verification

- Clean `npm ci`: passed; npm reported zero known vulnerabilities.
- `npm test`: 24 tests passed across three files after both hosted-test fixes.
- `npm run lint`: passed, no errors or warnings. Three narrow, documented exceptions preserve the existing category and scheduled-subscription reconciliation effects instead of rewriting those features.
- `npm run build`: passed with the real hosted project's public configuration after both fixes. The configured build has a non-blocking bundle-size warning (about 510 kB before compression).
- Git diff whitespace check: passed.
- Secret-pattern scan: no candidates in intended source files. Existing local token and Vercel metadata remain ignored.
- Browser check: login styling, populated demo dashboard, navigation controls, refund/split indicators, and balances rendered successfully.

The original 22 tests include real PostgreSQL migration execution using PGlite, with two synthetic users/roles for RLS checks. UI tests use mocked Supabase authentication/network responses. The hosted checks above extend that coverage; the expired-link regression test was added after the hosted finding.

## Added files

- `.env.example`
- `docs/SUPABASE_SETUP.md`
- `docs/IMPLEMENTATION_REPORT.md`
- `src/Root.jsx`
- `src/account.css`
- `src/components/AuthScreen.jsx`
- `src/components/BudgetSession.jsx`
- `src/lib/supabase.js`
- `src/utils/budgetDocument.js`
- `src/utils/cloudStorage.js`
- `src/utils/demoData.js`
- `supabase/migrations/20260915020323_user_budget_data.sql`
- `tests/app.test.jsx`
- `tests/database.test.js`
- `tests/persistence.test.js`
- `vitest.config.js`

## Modified files

- `.gitignore`: excludes local verification output and Supabase CLI state; allows the safe example environment file.
- `README.md`: updated features, setup, architecture, and deployment guidance.
- `package.json`, `package-lock.json`: pinned Supabase/test dependencies, test script, and compatible security updates.
- `src/main.jsx`: starts the auth/demo root.
- `src/App.jsx`: accepts an initial document and publishes one complete snapshot; removes direct browser-storage writes, validates imports, preserves budgeting UI, and fixes low-risk lint issues.
- `src/components/HomeTab.jsx`, `src/components/MoneyTab.jsx`: remove verified-unused prop declarations.
- `src/utils/storage.js`: isolated demo/account persistence and read-only legacy migration.

`src/utils/backup.js` and the QBUD2 backup format are unchanged. Historical JSON backups with omitted optional fields remain supported.

## Main behavior

- Email/password sign-in and signup, confirmation messaging, password reset, startup session detection, and sign out.
- Cloud JSONB budget documents with ownership RLS, automatic revision numbers/timestamps, and idempotent compare-and-swap saves.
- Debounced serial autosaves, pinned account identity, timeout/retry handling, local recovery, and explicit conflict resolution.
- Legacy import prompt only for an empty cloud account. Move uploads the existing document; Start Fresh preserves the original keys.
- Browser-only fictional demo with all tabs, transactions, refunds, splits, categories, cards, debts, subscriptions, transfers, and recaps. Reset restores the independent sample dataset; Exit returns to authentication.
- Account imports save to the cloud; demo imports remain in the demo namespace.

## Configuration still required

Project, migration, auth URLs, and frontend variables are configured. Custom SMTP remains necessary for general public email delivery; it is not required to finish initial team-address testing after the default sender limit clears. Never add service-role keys to the app.

Full steps, security considerations, recovery details, and the live release checklist are in [SUPABASE_SETUP.md](SUPABASE_SETUP.md). Keep the existing Vercel project and production URL. Only push `main` after setup and hosted verification, since it deploys automatically.
