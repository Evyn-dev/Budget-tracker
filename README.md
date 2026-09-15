# Budget Tracker

A mobile-friendly personal budget app built with React 19, JavaScript, and Vite 8. This repository preserves the supplied current app, including its interface, behavior, filenames, and imports.

## Features

- Income, expenses, paychecks, card/cash payments, split transactions, and refunds
- Digital, Wallet, and Savings buckets, customizable labels, and transfers
- Subscriptions, debts, credit cards, and card payment/charge history
- Custom and hidden categories; transaction search, sorting, and filters
- Weekly/monthly recaps and import/export backups

## Local setup

Use Node.js 22.12+ in the Node 22 release line and npm.

```sh
git clone https://github.com/Evyn-dev/Budget-tracker.git
cd Budget-tracker
npm ci
npm run dev
```

Open the URL printed by Vite. The development server listens on all network interfaces, as in the supplied configuration.

## Commands

```sh
npm run build    # Production output: dist/
npm run preview  # Serve the build locally
npm run lint     # Existing ESLint checks
```

Commit package-lock.json when dependencies change. Develop on branches and merge verified changes into main.

## Data and environment variables

Data is saved in browser localStorage. This version has no Supabase login or cloud sync; that integration is deferred. No app environment variables are required, so no .env.example is needed.

Export a backup from the live app before migration. Data belongs to the exact site origin and browser profile; localhost and preview URLs have separate storage. Keeping the production origin unchanged preserves access to its local data if browser storage is retained. Backups contain personal financial data and should not be committed.

Environment files and Vercel metadata are ignored. The supplied local Vercel token is not needed to build or run this app and is excluded from the repository. Never put secrets in VITE_ variables, which are exposed to the browser.

## Connect the existing Vercel project

This source migration does not change or deploy the Vercel project.

1. Export a backup and record the exact current production URL.
2. Open the existing Vercel project, then Settings > Git. Connect Evyn-dev/Budget-tracker, authorizing GitHub access if prompted.
3. Set production branch to main. Use repository root as Root Directory, Vite as Framework Preset, npm ci as Install Command, npm run build as Build Command, and dist as Output Directory. Use compatible Node.js, such as Node 22.12+.
4. Keep the existing project name and domain assignments. No replacement project or DNS change is needed. No app environment variables need to be added.
5. When ready to update production, create a deployment of main in Vercel, verify the build, and check the app at its existing production URL. Future pushes to main deploy automatically after Git is connected.

For a preview first, push a development branch after connecting Git and test its preview before promoting a verified deployment. Preview URLs have separate browser storage.

References: [GitHub integration](https://vercel.com/docs/git/vercel-for-github), [Git deployments](https://vercel.com/docs/git), [production domains](https://vercel.com/docs/domains/working-with-domains/deploying-and-redirecting).

## License

MIT; see LICENSE.

## Migration verification

npm ci and npm run build passed with Node 24.14.1. The supplied app code and lockfile were preserved. npm run lint reports 15 existing errors and 4 warnings (React hook checks, unused variables, and a duplicate style key); these do not block the Vite build and were left unchanged to keep this migration focused.

