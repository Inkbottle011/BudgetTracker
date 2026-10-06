# Linking banks (Teller)

New transactions from linked banks are added automatically every morning, and account balances are
refreshed at the same time (credit cards show what's owed and credit left on the dashboard).
Access is read-only: the app can see transactions but can't move money. Bank passwords are typed into Teller's own sign-in
window and never reach the app.

## How it fits together

```
Website ──(1) Teller sign-in window──► Teller ──► gives a one-time access token
   │
   └──(2) token ──► Supabase "bank" function ──► encrypts it, stores it, syncs
                         │
     every morning ──────┘ (scheduled) ──► Teller API (read-only) ──► your transactions table
```

- The token is encrypted (AES-256) with a key that only the function knows, and the database
  doesn't let the app read it at all.
- Every bank action requires two-factor sign-in.
- All Teller-specific code is in `supabase/functions/_shared/bank/teller.ts`. Switching provider
  later means adding one file like it; `testing/providerContract.ts` checks any provider behaves the same.

## Setup

Start in Teller's **sandbox** (fake banks, no certificate needed), then switch to **development**
for your real banks (free up to 100 connections).

### 1. Teller account
1. Sign up at [teller.io](https://teller.io) and create an application.
2. Note the **Application ID** (`app_...`).
3. For real banks later: download your **certificate** (`certificate.pem`) and **private key**
   (`private_key.pem`) from the Teller dashboard. Never commit these (`*.pem` is ignored).

### 2. Database
In Supabase, open **SQL Editor -> New query**, paste `supabase/sql/bank/01_setup.sql` and **Run**.

### 3. Function secrets
Supabase dashboard -> **Edge Functions -> Secrets**, add:

| Name | Value |
|---|---|
| `BANK_TOKEN_KEY` | Output of `openssl rand -base64 32` (or any 32 random bytes, base64). **Keep a copy somewhere safe**: if it's lost, banks have to be linked again. |
| `TELLER_ENV` | `sandbox` to start, then `development` |
| `CRON_SECRET` | Any long random string (e.g. another `openssl rand -base64 32`) |
| `TELLER_CERT` | Contents of `certificate.pem` (only needed outside sandbox) |
| `TELLER_KEY` | Contents of `private_key.pem` (only needed outside sandbox) |

### 4. Deploy the function
From the project folder (the first command only once per computer):
```
supabase link --project-ref YOUR-PROJECT-REF
supabase functions deploy bank
```

### 5. Website settings
Add to Netlify (**Site configuration -> Environment variables**) and to your local `.env`:
```
EXPO_PUBLIC_TELLER_APP_ID=app_...
EXPO_PUBLIC_TELLER_ENV=sandbox
```
Then redeploy the site.

### 6. Try it
1. **Settings -> Two-factor sign-in -> Set up**, scan the QR code, enter the code.
2. **Settings -> Linked banks -> + Link a bank**. In sandbox, pick any bank and sign in with
   username `username`, password `password`.
3. Check the imported transactions: purchases should be expenses, paychecks income, and refunds
   reimbursements (they reduce spending in the purchase's category).
4. If a sandbox credit card is linked, the dashboard shows a **Credit cards** panel with its balance.

### 7. Daily sync (optional but recommended)
Edit the two placeholders in `supabase/sql/bank/02_daily_sync.sql` and run it in the SQL Editor.

### 8. Real banks
Set `TELLER_ENV=development` (function secret) and `EXPO_PUBLIC_TELLER_ENV=development` (Netlify),
add `TELLER_CERT` and `TELLER_KEY`, redeploy both, and link your bank. Sandbox connections can be
unlinked from Settings.

## What gets imported
- Purchases: expenses (card purchases too). Interest and fees: expenses.
- Paychecks and other money in: income.
- Refunds, and any money coming back on a card that isn't a payment: reimbursements.
- Paying a card off: left out on the card; also left out on checking when that card is linked,
  so spending isn't counted twice.
- Pending transactions: added once they post.

## If something goes wrong
- **"Needs relinking"**: the bank or Teller ended access (password change, consent expired).
  Unlink and link again.
- **Linking fails with a certificate or TLS error** (development only): check `TELLER_CERT` and
  `TELLER_KEY` contain the full files including the `-----BEGIN ...-----` lines. If Supabase's
  function host can't present the certificate, the same code can run as a Netlify function instead.
- **No balance shown**: balances are fetched on each sync; "Balance appears after the next sync"
  means none has been fetched yet. Banks linked before balances were requested may need relinking.
- **Function logs**: Supabase dashboard -> Edge Functions -> bank -> Logs. Tokens are never logged.
