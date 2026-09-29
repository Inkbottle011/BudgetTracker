# BudgetTracker

A cross-platform personal finance app for planning a yearly budget, tracking transactions, and seeing how actual spending compares to the plan. It runs on iOS, Android, and the web from one TypeScript codebase.

**Stack:** TypeScript · React Native (Expo) · Supabase (Auth, PostgreSQL, Edge Functions) · Zustand · Victory Native

## Features

**Dashboard**
- Balance and current-year totals for income, expenses, and savings
- Actual vs. planned spending per budget item, switchable between monthly and yearly views
- Spending by category (bar or pie), monthly trend chart, and top spending categories
- Recent transactions and upcoming recurring transactions for the next 30 days

**Transactions**
- Add, edit, duplicate, and multi-select delete
- Search, filter by type and date range, and sort by date, type, or amount
- Running balance, summary bar for the visible rows, and pagination (20 per page)
- Recurring transactions (weekly, biweekly, monthly, yearly) with optional end dates
- **CSV export** and a **CSV bank-import wizard**: pick a file, map columns (auto-guessed from headers), preview, then import in batches of 50

**Budget planner**
- Yearly grid by month across Income, Expense, Savings, and Investment
- Cell editing with "save one" or "fill right" to copy a value across the remaining months
- Row totals, monthly totals, a net row, and year navigation
- Budget items feed the category list in the transaction form, so plan and actuals stay linked

**Accounts and polish**
- Email/password sign-up and login with validation and password-strength rules
- Sign out, toast notifications, and an error boundary so a crash doesn't blank the screen

## How it works

```
Expo app (React Native + web)
  ├─ Screens ──────── Dashboard · Transactions · Budget · Settings
  ├─ Hooks ────────── useDashboardLogic · useTransactionLogic · useBudgetLogic
  │                    (data fetching and calculations, kept out of the UI components)
  ├─ Zustand store ── shared transaction state
  └─ Supabase client ─ auth (PKCE, persisted session) + PostgreSQL queries
                                   │
Supabase ─────────────────────────┘
  ├─ Auth
  ├─ PostgreSQL: transactions · budget_items · budget_amounts
  └─ Edge Function (Deno): generate-recurring
```

- **Data isolation:** every row carries a `user_id`, and the database is designed around Supabase row-level security so each user only sees their own data.
- **Recurring transactions:** the `generate-recurring` edge function runs on a schedule. For each recurring transaction it creates any occurrences that came due since the last run (so missed days are backfilled), then advances the original's date.
- **Separation of concerns:** each screen has a logic hook for fetching and calculations, so the UI components stay mostly presentational.

## Tech stack

| Layer | Tools |
|---|---|
| App | TypeScript, React Native 0.85, Expo 56, React Navigation, React Native Web |
| State | Zustand |
| Charts | Victory Native, React Native SVG |
| Backend | Supabase Auth, PostgreSQL, Edge Functions (Deno) |
| CSV | PapaParse, Expo Document Picker |

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
npm run web       # browser
npm run ios       # iOS simulator (macOS)
npm run android   # Android emulator
npm start         # Expo dev menu (scan the QR code with Expo Go)
```

### Backend setup

The app expects three tables: `transactions`, `budget_items`, and `budget_amounts`. Enable row-level security on each, with policies that limit access to rows where `user_id = auth.uid()`.

To enable recurring transactions, deploy the edge function and schedule it (for example daily with Supabase cron):

```bash
supabase functions deploy generate-recurring
```

The function reads `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`, which Supabase provides automatically. Never put the service-role key in the app or in `.env`.

## Project structure

```
App.tsx                 Navigation (bottom tabs) and sign-out
app/dashboard/          Dashboard screen, charts, and logic hook
app/transactions/       List, form, CSV import, and logic hook
app/budget/             Yearly planner table and logic hook
app/auth.tsx            Sign-in / sign-up
components/, context/   Toasts, error boundary, shared UI
store/                  Zustand transaction store
lib/supabase.ts         Supabase client
supabase/functions/     generate-recurring edge function
```

## What's next

**Foundation**
- Commit database migrations and seed data to the repo so a new Supabase project can be set up in one step
- Add automated tests for the budget, dashboard, and recurring-transaction calculations
- Show clear errors when a CSV import row fails, instead of skipping it silently
- Deploy the web version so the app can be tried without installing anything

**Features**
- Date picker in place of typing dates by hand
- Undo after deleting a transaction
- Custom categories beyond budget items
- Budget templates (such as 50/30/20) and copy-last-year's-budget
- Alerts when a category is close to or over budget, plus a savings rate and budget health score

**Polish**
- Dark mode, pull to refresh, and full data export
- Login lockout after repeated failed attempts, and account deletion
