---
sidebar_position: 4
title: "Testing"
description: "Running the tests, what they cover, and working test-first."
---

# Testing

```bash
npm test               # everything: app tests (Jest) + database tests (Node)
npm run test:watch     # re-run app tests as you save
npm run test:db        # just the database SQL tests
```

Tests also run on every pull request (a type check, then `npm test`), in `.github/workflows/tests.yml`.

## What the tests check

| Where | What |
|---|---|
| `src/features/*/__tests__/` | Each feature's screens and logic: dashboard periods and totals, the budget (including the question guide's maths), transactions (CSV import, splits, renaming, categories), subscriptions (spotting them, price changes), two-factor, linked banks, appearance |
| `src/shared/**/__tests__/` | Money rules (amounts, dates, merchant matching), themes, loading every row past Supabase's 1,000-row limit, shared UI |
| `src/__tests__/architecture.test.ts` | The app's structure: [the rules](./architecture.md#the-rules) |
| `supabase/functions/_shared/bank/__tests__/` | The bank function: Plaid, SimpleFIN and Teller against fake banks, conversion, duplicate and transfer matching, pending charges, subscription charges |
| `supabase/sql/__tests__/` | The real SQL run against an in-memory Postgres: row-level security, subscription catch-up, setup that can run twice, setting up a brand-new project from nothing |

Tests run in **US Eastern time** on purpose, so date bugs that only appear west of UTC get caught.
Screen tests use a fake Supabase client (`test/fakeSupabase.ts`).

## Working test-first

1. Write a test that describes what should happen, and watch it fail.
2. Make the smallest change that makes it pass.
3. Tidy up, with the tests still passing.

Keep calculations in plain functions (in a feature's `logic/`) rather than inside screens: they're
much easier to test there.

## The docs site

The docs build fails if any link points to a page that doesn't exist, so run it after moving or
renaming a page. See [Deploying](./deploying.md#the-docs-site).
