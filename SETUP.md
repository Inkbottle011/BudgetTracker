# Setting up Budget Tracker

Everything needed to run your own copy of the app, from an empty account to a live website. It takes
about 30–45 minutes and everything here has a free plan.

| Piece | What it does | Needed? |
|---|---|---|
| **GitHub** | Holds the code; runs the tests and sets up the database when you merge | Yes |
| **Supabase** | Sign-in, the database, and the bank server function | Yes |
| **Netlify** | Hosts the website | For a public website |
| **Plaid** | Linking real bank accounts | Optional |

Commands below are for a terminal (on Windows, the VS Code terminal or PowerShell). Where Windows
needs something different, it's shown separately.

---

## 1. Get the code

1. Install **Node.js 22** (the LTS version) from [nodejs.org](https://nodejs.org) and **Git** from
   [git-scm.com](https://git-scm.com).
2. Fork the repository on GitHub (top right, **Fork**), or use your own copy.
3. Download it and install what it needs:

```bash
git clone https://github.com/YOUR-NAME/BudgetTracker.git
cd BudgetTracker
npm install
```

---

## 2. Create the Supabase project

1. Sign up at [supabase.com](https://supabase.com) and click **New project**. Pick a name, a region
   near you, and a **database password**. Save that password in your password manager; you need
   it in step 4.
2. When the project is ready, collect four things:

| What | Where to find it in Supabase |
|---|---|
| **Project URL** (`https://abcd….supabase.co`) | Project Settings → Data API (or the **Connect** button) |
| **Project ref** (the `abcd…` part of the URL) | Project Settings → General |
| **Publishable key** (or legacy **anon** key) | Project Settings → API Keys |
| **Session pooler connection string** | **Connect** button → Connection string → **Session pooler**. Replace `[YOUR-PASSWORD]` with your database password |

The publishable/anon key is safe to put in the website. The connection string is **not**: it gives
full access to your database. Only ever put it in GitHub secrets (step 4) or your own terminal.

3. Sign-in settings, under **Authentication**:
   - **URL Configuration**: set **Site URL** to your website's address (for now
     `http://localhost:8081`; change it in step 6). Under **Redirect URLs** add
     `http://localhost:8081/**`. Password-reset emails link back to these addresses.
   - **Multi-Factor**: make sure **TOTP (authenticator app)** is enabled. It's on by default and is
     needed for two-factor sign-in and linking banks.
   - **Sign In / Providers → Email**: leave email sign-in on. With **Confirm email** on, new
     accounts must click the link in their email before signing in.

---

## 3. Point the app at your project

Copy `.env.example` to a new file called `.env` in the project folder and fill in your values:

```
EXPO_PUBLIC_SUPABASE_URL=https://abcd.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-publishable-or-anon-key
```

Anything starting with `EXPO_PUBLIC_` is built into the website where anyone can see it, so never
put a secret key or the connection string in this file. `.env` isn't uploaded to GitHub.

---

## 4. Set up the database

The database is set up by the files in `supabase/sql/` (the list and their order are in
`scripts/apply-database-setup.mjs`). Each one is safe to run more than once: it only adds what's
missing. There's nothing to paste into Supabase's SQL Editor.

### Automatically, every time you merge (recommended)

1. In GitHub open your repository → **Settings → Secrets and variables → Actions → New repository
   secret**, and add:

| Secret | Value |
|---|---|
| `SUPABASE_DB_URL` | The Session pooler connection string (with your password) |
| `SUPABASE_ACCESS_TOKEN` | Generate one at [supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens) |
| `SUPABASE_URL` | Your Project URL |
| `SUPABASE_ANON_KEY` | Your publishable/anon key |

2. In `.github/workflows/deploy-backend.yml`, change the `PROJECT_REF:` line to your project ref
   and commit it.
3. Run it the first time: **Actions** tab → **Deploy backend** → **Run workflow**. It sets up the
   database, then deploys the `bank` server function.

From then on, merging a pull request into `master` that changes the database setup or the server
function runs it again automatically.

`SUPABASE_URL` and `SUPABASE_ANON_KEY` are for **Keep Supabase awake**, which runs twice a week. Free
Supabase projects pause after about a week with no activity, and this stops that from happening.

### Or once, from your computer

macOS or Linux:
```bash
SUPABASE_DB_URL="postgresql://…your session pooler string…" node scripts/apply-database-setup.mjs
```

Windows (PowerShell or the VS Code terminal):
```powershell
$env:SUPABASE_DB_URL="postgresql://…your session pooler string…"
node scripts/apply-database-setup.mjs
```

It lists each file as it's applied, and skips any it has already run.

---

## 5. Try it on your computer

```bash
npm run web     # opens the app in your browser
npm start       # or: then press w for the browser, or scan the QR code with Expo Go on your phone
```

Create an account, confirm your email, and sign in. Then try **Plan with questions** on the Budget
page, or import a CSV on the Transactions page.

To check everything works:
```bash
npm test        # the app's tests and the database tests (no Supabase needed)
npx tsc --noEmit
```

---

## 6. Put the website online (Netlify)

1. Sign up at [netlify.com](https://netlify.com) → **Add new site → Import an existing project →
   GitHub**, and pick your repository.
2. Build settings:

| Setting | Value |
|---|---|
| Branch to deploy | `master` |
| Build command | `npx expo export -p web` |
| Publish directory | `dist` |

3. **Environment variables** (Site configuration → Environment variables): add
   `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` with the same values as your
   `.env`, and `NODE_VERSION` = `22` so the site is built with the same Node.js as the tests.
4. Deploy. Netlify gives you an address like `https://your-site.netlify.app`. You can rename it
   under Site configuration → Change site name.
5. Back in Supabase → **Authentication → URL Configuration**: set **Site URL** to that address, and
   add `https://your-site.netlify.app/**` to **Redirect URLs**.

Netlify rebuilds the site whenever `master` changes, and builds a preview for each pull request.
To see which version is running, open **Settings → About this app**. When a newer version is
online, a "new version is ready" bar appears at the top of the app.

---

## 7. Optional: link real banks (Plaid)

Plaid's sandbox (fake banks) is free; its trial plan covers up to 10 real bank logins. Follow
[docs/linking-banks.md](docs/linking-banks.md) to:
- create a Plaid account;
- add the function secrets (`BANK_TOKEN_KEY`, `CRON_SECRET`, `PLAID_CLIENT_ID`, `PLAID_SECRET`,
  `PLAID_ENV`) in Supabase → Edge Functions → Secrets;
- turn on the daily sync.

The `bank` function itself is deployed by **Deploy backend** (step 4). Keep a copy of
`BANK_TOKEN_KEY` somewhere safe: if it's lost, every bank has to be linked again.

## 8. Optional: add subscription charges on a schedule

The app adds any subscription charges that have come due each time you open it, so nothing is
missed. To also add them while nobody has the app open:

1. Deploy the function once: `npx supabase functions deploy generate-recurring --project-ref YOUR-PROJECT-REF`
   (it asks you to sign in to Supabase the first time).
2. In Supabase → **Integrations → Cron → Create job**: run it daily, as an HTTP request (POST) to
   `https://YOUR-PROJECT-REF.supabase.co/functions/v1/generate-recurring`.

---

## Where every secret lives

| Name | Where it goes | Safe to share? |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` | `.env` and Netlify | Yes, they're in the website |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | GitHub Actions secrets | Yes, the same public values |
| `SUPABASE_DB_URL` (connection string) | GitHub Actions secrets only | **No**: full database access |
| `SUPABASE_ACCESS_TOKEN` | GitHub Actions secrets only | **No**: controls your Supabase account |
| `BANK_TOKEN_KEY`, `CRON_SECRET`, `PLAID_SECRET` | Supabase Edge Function secrets only | **No** |

Never put a secret in a file that's committed to GitHub, in an `EXPO_PUBLIC_` variable, or in a
chat or screenshot. If one leaks, make a new one (and update it everywhere it's used).

---

## Something not working?

| What you see | What to do |
|---|---|
| "supabaseUrl is required" | `.env` is missing or misnamed. Check it, then restart with `npx expo start --web --clear` |
| The website doesn't show your latest changes | Check the Netlify deploy finished, then reload with **Ctrl+Shift+R**. **Settings → About this app → Check for updates** tells you which version is live |
| **Deploy backend** fails with "Missing SUPABASE_DB_URL" or "…ACCESS_TOKEN" | Add the secret from step 4, then run the workflow again from the Actions tab |
| Deploy backend can't connect to the database | Use the **Session pooler** string (not "Direct connection") and check the password is filled in |
| Password-reset or confirmation emails open the wrong site | Fix **Site URL** and **Redirect URLs** in Supabase (steps 2 and 6) |
| The app suddenly can't load anything after a quiet week | The free Supabase project was paused. Restore it in the Supabase dashboard, and make sure **Keep Supabase awake** has its two secrets |
| Linking a bank says two-factor sign-in is needed | Turn it on in **Settings → Two-factor sign-in** first |
