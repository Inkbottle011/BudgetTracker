---
sidebar_position: 5
title: "Deploying"
description: "What happens when you merge, and where each part of the app is published."
---

# Deploying

Merging a pull request into `master` publishes everything that changed. There's nothing to run by
hand.

| Part | Published by | Where |
|---|---|---|
| The app (website) | Netlify, on every push to `master` | [managemymulah.netlify.app](https://managemymulah.netlify.app) |
| Database setup and the `bank` function | **Deploy backend** (`.github/workflows/deploy-backend.yml`) | Your Supabase project |
| These docs | **Deploy docs** (`.github/workflows/deploy-docs.yml`) | [inkbottle011.github.io/BudgetTracker](https://inkbottle011.github.io/BudgetTracker/) |

Check each one in the GitHub **Actions** tab after merging.

## The app

Netlify builds the Expo web app and publishes it. When a new version is live, people using the app
see a bar offering to **Reload**, and **Settings → About this app** shows which version they're on.

## Database and the bank function

**Deploy backend** applies every new or changed setup file listed in
`scripts/apply-database-setup.mjs` (each is safe to run more than once, starting with the core tables
for a brand-new project), then deploys the `bank` function.

It needs two GitHub Actions secrets: `SUPABASE_DB_URL` (the **Session pooler** connection string) and
`SUPABASE_ACCESS_TOKEN`. Setting them up is in [Set up your own copy](./setup.md).

**Database changes** go in the idempotent setup files under `supabase/sql/<feature>/` and are listed
in `scripts/apply-database-setup.mjs`. Nobody should ever need to paste SQL by hand for setup.

## Keeping Supabase awake

Free Supabase projects pause after a quiet week. **Keep Supabase awake**
(`.github/workflows/keep-supabase-awake.yml`) pings the project regularly so that doesn't happen.

## The docs site

The pages are the Markdown files in `docs/` (readable on GitHub too). The Docusaurus setup is in
`website/`.

**See it on your computer:**

```bash
cd website
npm install       # once
npm start         # opens the site; pages reload as you save
```

**Before opening a pull request**, check it builds:

```bash
cd website
npm run build     # fails if any link points to a page that doesn't exist
```

**Adding a page:** create a Markdown file in `docs/guide/` (for people using the app) or
`docs/developers/` (for people working on it), starting with:

```md
---
sidebar_position: 11
title: The page's name
description: One sentence about it, used in search results.
---
```

It appears in the sidebar automatically, ordered by `sidebar_position`. Link to other pages with
relative paths, like `[Budget](./budget.md)` or `[Testing](../developers/testing.md)`.

**Publishing:** merging changes under `docs/` or `website/` into `master` runs **Deploy docs**, which
builds the site and publishes it to GitHub Pages.
