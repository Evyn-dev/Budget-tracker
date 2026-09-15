# Budget Tracker

The existing React + Vite budget app, with Supabase email accounts, per-user cloud autosave, and a public browser-only demo. The original budgeting interface and QBUD2 backup format are preserved.

## Features

- Income/expenses, paychecks, card/cash handling, split transactions, and refunds
- Digital, Wallet, and Savings balances, labels, and transfers
- Subscriptions, debts, credit cards and payment/charge history
- Custom/hidden categories and reassignment, search, sort, filters, weekly/monthly recaps
- Import/export, mobile navigation and swipe behavior
- Sign in, signup, email confirmation, password reset, and persistent sessions
- Debounced cloud saves with recovery copies and conflict detection
- Editable fictional demo data, Reset Demo Data, and Exit Demo

## Local setup

Use Node 24.x and npm (Node 22.12+ is also supported by the build tooling).

```sh
npm ci
npm run dev
```

Try Demo works without environment variables. For real accounts, configure Supabase and copy `.env.example` to a root `.env.local`, filling in `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. Never put service-role keys or other secrets in browser configuration.

```sh
npm test
npm run lint
npm run build
npm run preview
```

Tests cover auth UI, account persistence, migration, demo, backup compatibility, queue failures/conflicts, and the actual SQL migration/RLS using local PostgreSQL through PGlite. Hosted email/auth integration still requires a configured Supabase project.

## Supabase and Vercel

Follow [Supabase setup and release checklist](docs/SUPABASE_SETUP.md) before pushing `main`. It includes the SQL migration, auth URLs, email delivery, Vercel variables, tests, and recovery behavior.

The existing Vercel project uses repository root, Vite, `npm ci`, `npm run build`, `dist`, and Node 24.x. Production remains at https://budget-tracker-theta-indol.vercel.app/. Pushing `main` triggers production deployment. Keep the existing project/domain assignments; do not create a second project.

## Data storage

Cloud budgets live in `public.user_budget_data`, one versioned JSONB document per user, protected by RLS. No Blob or Supabase Storage bucket is needed. Demo data never enters Supabase. Existing browser data is offered for migration into an empty account and is never destructively removed.

Unsaved work is retained in a per-account local recovery copy; concurrent edits trigger a conflict instead of silently overwriting. Legacy data, recovery copies, and backups are private financial data: use a trusted browser profile and keep exports out of Git.

## Architecture

- `src/Root.jsx`: auth lifecycle and mode selection
- `src/components/AuthScreen.jsx`: sign-in, signup, password reset and demo entry
- `src/components/BudgetSession.jsx`: account/demo loading, migration and status UI
- `src/App.jsx`: existing budgeting state and UI, publishing complete snapshots
- `src/utils/cloudStorage.js`: authenticated repository and serialized save queue
- `src/utils/storage.js`: separate demo, legacy and per-user local storage
- `src/utils/budgetDocument.js`: versioning and validation
- `src/utils/demoData.js`: fictional sample dataset
- `supabase/migrations/`: database schema, RLS and revision-safe save function

## License

MIT; see LICENSE.
