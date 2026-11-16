---
sidebar_position: 1
title: "How it works"
description: "The pieces of Budget Tracker, how they fit together, and how the code is organised."
---

# How it works

Budget Tracker is one TypeScript codebase that runs on the web (hosted on Netlify), iOS and Android.

**Stack:** TypeScript · React Native (Expo) · Supabase (Auth, PostgreSQL, Edge Functions) · Plaid and
SimpleFIN · Zustand

## The big picture

```
Expo app (web on Netlify, iOS, Android)
  ├─ src/features/*   one folder per part of the app
  ├─ src/shared/*     UI pieces, themes, money rules, dates, Supabase client
  └─ Zustand store    shared transaction state
                │
Supabase ───────┘
  ├─ Auth (PKCE sessions, two-factor)
  ├─ PostgreSQL with row-level security
  │    transactions · budget_items · budget_amounts · subscriptions · split_shares
  │    bank_connections · bank_accounts · bank_possible_duplicates · bank_pending_transactions …
  └─ Edge Functions (Deno)
       bank                 linking, syncing (daily via cron) and unlinking banks
       generate-recurring   adds due subscription charges on a schedule
```

- **The app talks to Supabase directly** for everyday reads and writes. Row-level security in the
  database makes sure each person only ever sees their own rows.
- **Bank syncing happens only on the server.** The `bank` function decrypts the stored token, fetches
  transactions, applies the same rules as the CSV import, pairs transfers, saves pending charges and
  refreshes balances. See [Linking banks (server setup)](./linking-banks.md).
- **Subscriptions** live in their own table. `generate_subscription_transactions()` adds every charge
  that's due, counted from the start date so monthly dates never drift, and a unique index means a
  charge is never added twice.

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
  forum/                     the suggestions forum: posts, replies, upvotes, moderation
  settings/                  the Settings page (built from other features' sections)
  subscriptions/             regular charges, spotting them, price changes
  transactions/              the list, adding/editing, CSV import, splits, categories, renaming
src/shared/                  used by everything, depends on no feature
  ui/                        buttons, sections, date field, toasts, error screen
  theme/                     colors, themes, light/dark, background settings
  money/                     money rules (entry.ts is copied to the bank function), formatting
  dates.ts, fetchAllRows.ts, supabase.ts
supabase/sql/<feature>/      database setup, applied automatically on merge (core/ first)
supabase/functions/          the bank function and generate-recurring
scripts/                     apply-database-setup.mjs (run by the deploy workflow)
docs/                        these docs (the site's setup is in website/)
```

## The rules

Checked on every test run by `src/__tests__/architecture.test.ts`:

1. **Features use each other only through their front doors**: `features/<name>` for screens,
   `features/<name>/api` from logic.
2. **Each feature owns its database tables.** Others ask it, for example `loadAllTransactions()` from
   `transactions/api`.
3. **`src/shared` never imports a feature.**

New parts of the app get their own folder under `src/features/`.

## Where the money rules live

Rules about money (what counts as spending, how amounts and dates are read, matching the same place
across different spellings) are in `src/shared/money/`. `entry.ts` is also used by the bank function:
`npm run sync:shared` copies it to `supabase/functions/_shared/entry.ts`, so imports from a CSV and
from a bank follow exactly the same rules.
