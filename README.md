# BudgetTracker

A personal finance app for planning a budget, tracking every transaction (typed in, imported from a CSV, or synced from your bank), and seeing how the day, week, month or year is going against the plan. It runs on the web (live on Netlify), iOS and Android from one TypeScript codebase.

**Stack:** TypeScript · React Native (Expo) · Supabase (Auth, PostgreSQL, Edge Functions) · Plaid · Zustand

## Features

**Dashboard**
- Day, week (Monday to Sunday), month or year, with arrows to step back and forward
- What you spent against your plan, with a marker for where you'd be if you spent evenly, plus what you earned, saved and have left
- Budget bars per category, colored by how you're doing: on track, getting close (from 85%), or over
- Balances from your linked banks (checking, savings, owed on cards), a monthly trend chart, coming-up subscription charges and recent activity
- Charges your bank hasn't posted yet are shown as pending, not counted until they post

**Transactions**
- Add, edit, duplicate, split and delete; search, filter and sort; CSV export
- **CSV import wizard**: match columns (auto-guessed), review, then import; skips what you already have, leaves out card payments, suggests categories
- **Categorize in bulk**: uncategorized transactions are grouped by place with a suggested category
- **Rename** a place once ("SQ *BLUE BOTTLE #12" → "Blue Bottle") and future transactions use your name
- Pending charges from your bank appear in their own section until they post

**Linked banks** ([setup](docs/linking-banks.md))
- Plaid (Teller also supported); syncs every morning and on demand, read-only, tokens encrypted and never readable by the app
- Imports history from January 1; purchases are dated on the day you made them, not the day they posted
- Finds money moving between your own accounts: transfers aren't counted twice, money put into savings counts as saved and money taken out counts as a withdrawal
- Likely duplicates of transactions you entered yourself are held for you to review

**Subscriptions**
- Repeating charges and income with totals per month and year; each charge is added once, on its real date
- **Spotted for you**: charges that repeat on a schedule, from well-known services (Netflix, Spotify, Claude…) from the first charge, from bank wording like "recurring", or two exact charges a month apart. Add with one tap or dismiss for good
- **Price changes**: when the bank charges a different amount, update the subscription in one tap; the bank's real charge replaces the app's entry so it isn't counted twice

**Budget planner**
- Yearly grid by month across income, spending, savings and investment, with "fill right", totals and "left over each month"

**Split expenses and paybacks**
- Split an expense with others; "Owed to you" tracks who still has to pay you back
- Paybacks reduce spending in that category (in the month of the expense) instead of counting as income

**Security and accounts**
- Email and password sign-in, password reset, and two-factor sign-in with an authenticator app (required for linking banks)
- Add a **backup authenticator** so losing your phone doesn't lock you out
- Row-level security: each person only ever sees their own data

**Look and feel**
- Five color themes (Night sky, Ocean, Forest, Sunset, Classic) in light or dark; money colors mean the same in all of them
- An optional moving space background (stars, warp or nebula) that holds still if your device asks for reduced motion

## How it works

```
Expo app (web on Netlify, iOS, Android)
  ├─ src/features/*   one folder per part of the app (see Project structure)
  ├─ src/shared/*     UI pieces, themes, money rules, dates, Supabase client
  └─ Zustand store    shared transaction state
                │
Supabase ───────┘
  ├─ Auth (PKCE sessions, two-factor)
  ├─ PostgreSQL with row-level security
  │    transactions · budget_items · budget_amounts · subscriptions · split_shares
  │    bank_connections · bank_accounts · bank_possible_duplicates · bank_pending_transactions …
  └─ Edge Functions (Deno)
       bank                 linking, syncing (daily via cron) and unlinking, through Plaid
       generate-recurring   adds due subscription charges on a schedule
```

- **Bank syncing** happens only on the server: the `bank` function decrypts the stored token, fetches transactions, applies the same rules as the CSV import, pairs transfers, saves pending charges and refreshes balances.
- **Subscriptions** live in their own table; `generate_subscription_transactions()` adds every charge that's due, counted from the start date so monthly dates never drift, and a unique index means a charge is never added twice.

## Getting started

**Prerequisites:** Node.js 18+ and a free [Supabase](https://supabase.com) project.

```bash
git clone https://github.com/Inkbottle011/BudgetTracker.git
cd BudgetTracker
npm install
```

Create a `.env` file in the project root with your Supabase project values (Project Settings → API):

```
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Then start the app:

```bash
npm start         # then press w for the browser, or scan the QR code with Expo Go
npm run web       # straight to the browser
```

### Backend setup (automatic)

Database setup and the bank function deploy themselves: merging to `master` runs `.github/workflows/deploy-backend.yml`, which applies every new or changed file listed in `scripts/apply-database-setup.mjs` (each is safe to run more than once) and deploys the `bank` function. It needs two GitHub Actions secrets: `SUPABASE_DB_URL` (the Session pooler connection string) and `SUPABASE_ACCESS_TOKEN`.

For a brand-new Supabase project, the app also expects the tables `transactions`, `budget_items` and `budget_amounts` with row-level security limited to `user_id = auth.uid()`. Linking banks needs a Plaid account and a few function secrets: see [docs/linking-banks.md](docs/linking-banks.md).

Never put the service-role key or the database connection string in the app or in an `EXPO_PUBLIC_` variable.

## Testing

```bash
npm test               # everything: app tests (Jest) + database tests (Node)
npm run test:watch     # re-run app tests as you save
npm run test:db        # just the database SQL tests
```

Tests also run on every pull request (type-check, then `npm test`).

| Where | What the tests check |
|---|---|
| `src/features/*/__tests__/` | Each feature's screens and logic: dashboard periods and totals, budget, transactions (CSV import, splits, renaming, categories), subscriptions (including spotting them and price changes), two-factor, linked banks, appearance |
| `src/shared/**/__tests__/` | Money rules (amounts, dates, merchant matching), themes, loading every row past Supabase's 1,000-row limit, shared UI |
| `src/__tests__/architecture.test.ts` | The app's structure: features use each other only through their front doors, and only the owner of a table uses it |
| `supabase/functions/_shared/bank/__tests__/` | The bank function: Plaid and Teller against fake banks, conversion, duplicate and transfer matching, pending charges, subscription charges |
| `supabase/sql/__tests__/` | The real SQL run against an in-memory Postgres: row-level security, subscription catch-up, setup that can run twice |

Tests run in US Eastern time on purpose, so date bugs that only appear west of UTC get caught. Screen tests use a fake Supabase client (`test/fakeSupabase.ts`).

**Working test-first:** write a test that describes what should happen and watch it fail, make the smallest change that passes, then tidy up. Keep calculations in plain functions (in a feature's `logic/`) rather than inside screens.

## Project structure

One app, organised feature by feature (a "modular monolith"):

```
index.ts                     Expo's entry point (loads src/App)
src/App.tsx                  Top bar, tabs, sign-in gate
src/features/<feature>/      One part of the app:
    index.ts                   front door: everything other parts may use, screens included
    api.ts                     front door for other features' logic: data and logic only, no screens
    screens/                   what you see
    logic/                     calculations, hooks and database calls
    __tests__/
  account/                   sign-in, password reset, two-factor
  appearance/                the moving space background
  bank/                      linking banks, balances, possible duplicates, pending charges
  budget/                    the yearly plan
  dashboard/                 the summary of a day, week, month or year
  settings/                  the Settings page (built from other features' sections)
  subscriptions/             regular charges, spotting them, price changes
  transactions/              the list, adding/editing, CSV import, splits, categories, renaming
src/shared/                  used by everything, depends on no feature
  ui/                        buttons, sections, date field, toasts, error screen
  theme/                     colors, themes, light/dark, background settings
  money/                     money rules (entry.ts is copied to the bank function), formatting
  dates.ts, fetchAllRows.ts, supabase.ts
supabase/sql/<feature>/      database setup, applied automatically on merge
supabase/functions/          the bank function and generate-recurring
docs/                        design notes and bank-linking setup
```

The rules (checked by `src/__tests__/architecture.test.ts`):
1. Features use each other only through their front doors: `features/<name>` for screens, `features/<name>/api` from logic.
2. Each feature owns its database tables; others ask it (for example `loadAllTransactions()` from `transactions/api`).
3. `src/shared` never imports a feature.

## What's next

- Reminders: a subscription due tomorrow, a category past 85%, a high card balance
- Smarter automatic categories, to shrink the uncategorized pile
- Add to your phone's home screen as an app (full screen, with an icon)
- Undo after deleting a transaction
- Copy last year's budget, budget templates (such as 50/30/20) and reordering budget items
- Full data export (transactions and budget in one file) and account deletion
