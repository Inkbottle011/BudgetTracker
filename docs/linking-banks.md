# Linking banks (Plaid)

New transactions from linked banks are added automatically every morning, and balances are
refreshed at the same time (credit cards show what's owed and credit left on the dashboard).
Access is read-only: the app can see transactions but can't move money. Bank passwords are typed
into Plaid's sign-in window (or the bank's own site) and never reach the app.

## How it fits together

```
Website ──(1) asks the server for a sign-in session ──► "bank" function ──► Plaid
        ──(2) Plaid sign-in window ──► you log in to your bank ──► one-time token
        ──(3) one-time token ──► "bank" function ──► exchanges it, encrypts the lasting token, syncs

Every morning (scheduled) ──► "bank" function ──► Plaid (read-only) ──► your transactions
```

- The lasting token is encrypted (AES-256) with a key only the function knows, and the database
  doesn't let the app read it at all.
- Every bank action requires two-factor sign-in.
- All Plaid-specific code is in `supabase/functions/_shared/bank/plaid.ts`. Teller is also
  supported (`teller.ts`); `testing/providerContract.ts` checks every provider behaves the same.

## Cost
- **Sandbox** (fake banks): free, unlimited.
- **Trial plan** (real banks): free for up to **10 bank connections**, including Chase, Bank of
  America and Wells Fargo. One connection = one bank login. More than 10 needs a paid plan.

## Setup

Start in **sandbox**, then switch to **production** (your Trial plan) for real banks.

### 1. Plaid account
1. Sign up at [dashboard.plaid.com/signup](https://dashboard.plaid.com/signup).
2. In the dashboard, open **Developers -> Keys** and note your **client_id**, the **Sandbox
   secret**, and (later) the **Production secret**.

### 2. Database
In Supabase, open **SQL Editor -> New query**, paste `supabase/sql/bank/01_setup.sql` and **Run**.
(Safe to run again after updates; it only adds what's missing.)

### 3. Function secrets
Supabase dashboard -> **Edge Functions -> Secrets**, add:

| Name | Value |
|---|---|
| `BANK_TOKEN_KEY` | Output of `openssl rand -base64 32`. **Keep a copy somewhere safe**: if it's lost, banks have to be linked again. |
| `CRON_SECRET` | Any long random string (e.g. another `openssl rand -base64 32`) |
| `PLAID_CLIENT_ID` | Your client_id |
| `PLAID_SECRET` | Your Sandbox secret (later: Production secret) |
| `PLAID_ENV` | `sandbox` (later: `production`) |

No `openssl`? Any password manager's generator works: 32+ random characters for `CRON_SECRET`;
for `BANK_TOKEN_KEY` it must be exactly 32 random bytes in base64 (44 characters ending in `=`),
so `openssl` (or an online "random base64 32 bytes" generator you trust) is easiest.

### 4. Deploy the function
From the project folder (the first command only once per computer):
```
supabase link --project-ref YOUR-PROJECT-REF
supabase functions deploy bank
```

### 5. Website
Nothing to configure: Plaid is the default. (For Teller, set `EXPO_PUBLIC_BANK_PROVIDER=teller`
and `EXPO_PUBLIC_TELLER_APP_ID` in Netlify and `.env`, and `BANK_PROVIDER=teller` in the function secrets.)

### 6. Try it (sandbox)
1. **Settings -> Two-factor sign-in -> Set up**, scan the QR code, enter the code.
   - iPhone: point the Camera app at the code and tap **Add Verification Code in Passwords**;
     codes are then in the Passwords app (Codes tab).
   - Android: install Google Authenticator, tap **+** -> **Scan a QR code**.
2. **Settings -> Linked banks -> + Link a bank -> Continue to your bank**. Pick any bank and sign
   in with username `user_good`, password `pass_good`.
3. If it says transactions are still loading, wait a minute and tap **Sync now**.
4. Check what was imported: purchases are expenses, paychecks income, refunds reimbursements.
   With a sandbox credit card linked, the dashboard shows a **Credit cards** panel.

### 7. Daily sync (recommended)
Edit the two placeholders in `supabase/sql/bank/02_daily_sync.sql` and run it in the SQL Editor.

### 8. Real banks
Change the function secrets `PLAID_SECRET` to your **Production** secret and `PLAID_ENV` to
`production`, then link your bank. Unlink the sandbox banks in Settings first.

## What gets imported
- History: banks are asked for transactions back to **January 1** of the current year (Plaid
  collects history once, when a bank is first linked). You pick the start date when linking; it
  defaults to the day after your latest transaction.
- Transactions you already have (typed in or from a CSV) aren't added again:
  - Same date, amount and wording, or the same amount at the same place within 3 days: skipped.
  - Same amount within 3 days but a different name (e.g. your "Groceries" vs. the bank's
    "WHOLE FOODS #10234"): held back under **Settings -> Linked banks -> Possible duplicates**,
    and not counted until you pick **Keep mine**, **Use bank's** or **Keep both**.
- Purchases: expenses (card purchases too). Interest and fees: expenses.
- Paychecks and other money in: income.
- Refunds, and any money coming back on a card that isn't a payment: reimbursements.
- Money moving between your own linked accounts (savings -> checking, between banks, vaults,
  paying off a card): saved as **Transfer**, shown in your list but never counted as income or
  spending. Both sides are paired by amount within 3 days. Zelle, Venmo, Cash App and PayPal are
  never treated as transfers, since those are usually other people. If a transfer is wrong, edit
  its type; your change sticks.
  - Checking -> a savings account (or SoFi vault): the checking side counts as **Savings** (your
    savings total goes up, your balance goes down); the savings side is a transfer.
  - Savings -> checking: the checking side is a **Withdrawal** (savings total down, balance back
    up); the savings side is a transfer.
  - Between savings accounts or vaults, between checking accounts, paying a card: both sides are
    transfers.
  - Anything you marked **Savings** or **Investment** yourself stays that way.
  - A card payment from checking stays spending unless the matching payment shows up on a linked
    card, since for an unlinked card it's the only record of that spending.
- Transfers imported before this existed are fixed automatically on the next sync.
- Pending transactions: added once they post.

## If something goes wrong
- **"Still loading" after linking**: normal for a minute or two with Plaid. Tap **Sync now** later.
- **"Needs relinking"**: the bank ended access (password change, consent expired). Unlink and link again.
- **Bank sign-in opens and closes immediately**: allow pop-ups for your site; some banks (e.g. Chase)
  open their own sign-in in a pop-up.
- **No balance shown**: balances are fetched on each sync; "Balance appears after the next sync"
  means none has been fetched yet.
- **Function logs**: Supabase dashboard -> Edge Functions -> bank -> Logs. Tokens are never logged.
