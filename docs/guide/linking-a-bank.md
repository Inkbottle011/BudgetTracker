---
sidebar_position: 6
title: "Linking a bank"
description: "Have new transactions and balances come in by themselves every morning."
---

# Linking a bank

A linked bank adds new transactions every morning and keeps your balances up to date. Access is
**read-only**: the app can see transactions but can never move money. Your bank password is never
typed into this app.

## Before you start

- Turn on **[two-factor sign-in](./privacy-and-security.md#two-factor-sign-in)** in Settings. Linking
  a bank needs it.
- Link from the **website** version of the app.

## Link through SimpleFIN

SimpleFIN is a service that connects to your bank for you. You pay it directly: $1.50 a month or $15
a year.

1. Sign up at [bridge.simplefin.org](https://bridge.simplefin.org) and connect your banks there.
2. In SimpleFIN Bridge, open **Apps → New connection** and tap **Create setup token**. Copy it.
3. In Budget Tracker: **Settings → Linked banks → Link a bank**, paste the token into
   **SimpleFIN setup token**, and tap **Link with SimpleFIN**.

A setup token works only once. If the app says it was already used and that wasn't you, disable it in
SimpleFIN Bridge and make a new one.

SimpleFIN usually refreshes about once a day, so a new purchase can take a day to show up.

:::note Plaid
The app's owner can link through Plaid instead, using the bank's own sign-in window. It isn't open to
everyone because Plaid charges per linked bank.
:::

## Choosing where to start

When you link, you pick the date to start importing from. It suggests the day after your latest
transaction, so nothing you already have is doubled up. History can go back to January 1 of this
year.

## What comes in

- **Purchases, interest and fees**: expenses.
- **Pay and other money in**: income.
- **Refunds**: reimbursements, which take away from spending in their category.
- **Money moving between your own accounts** (checking to savings, paying off a card, between
  banks): saved as **Transfer**. It's shown in your list but never counted as spending or income.
  - Checking to savings counts as **Savings**; savings back to checking is a **Withdrawal**.
  - Zelle, Venmo, Cash App and PayPal are never treated as transfers, since those are usually other
    people.
  - If one is wrong, change its type. Your change sticks.
- **Pending charges**: shown as pending, and added for real once they post.
- Purchases are dated on the day you made them, not the day they posted.

## Possible duplicates

If the bank sends something that looks like a transaction you typed in yourself (same amount within 3
days, but a different name, like your "Groceries" and the bank's "WHOLE FOODS #10234"), it's held
back under **Settings → Linked banks → Possible duplicates**. It isn't counted until you choose
**Keep mine**, **Use bank's** or **Keep both**.

## Paying off a card

Your card company only lowers its balance once a payment **posts**, often 1 to 3 business days later.
Until then, a payment that's still processing on a linked card is already taken off
**Owed on cards** on the Dashboard, with "payment processing" shown underneath. Once it posts, the
card company's own balance takes over.

## Sync now and unlinking

- **Sync now** fetches new transactions and balances straight away.
- **Unlink** stops syncing. It can't be undone: to sync again you'd link the bank again. For
  SimpleFIN, also remove the app in SimpleFIN Bridge (**Apps**) to stop sharing completely.

Something not right? See [Questions and problems](./troubleshooting.md#linked-banks).
