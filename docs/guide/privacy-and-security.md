---
sidebar_position: 8
title: "Privacy and security"
description: "Two-factor sign-in, privacy mode, and how your data is kept safe."
---

# Privacy and security

## Two-factor sign-in

Two-factor sign-in asks for a 6-digit code from your phone when you sign in, as well as your
password. Even if someone learns your password, they can't get in without your phone. It's needed to
link a bank.

**Settings → Two-factor sign-in → Set up two-factor sign-in.** It takes about a minute:

1. **Get an authenticator app.**
   - **iPhone**: nothing to install. Point the Camera app at the code and tap
     **Add Verification Code in Passwords**. Codes are then in the Passwords app (Codes tab).
   - **Android**: install Google Authenticator, tap **+**, then **Scan a QR code**.
2. **Add Budget Tracker to it** by scanning the QR code. Reading this on the same phone? Copy the key
   shown instead and paste it into the authenticator app.
3. **Type the code it shows** and tap **Confirm**.

### Add a backup authenticator

If you lose your phone, you could be locked out. Tap **Add a backup authenticator** to add a second
one, such as a tablet or a password manager. Either works when you sign in.

### Turning it off

**Turn off** asks first. Linked banks stop syncing until you turn it back on.

## Privacy mode

For using the app in public. Tap the **eye** in the top bar and amounts are blurred. Point at or tap
one to see it (in the phone app they show as dots).

In **Settings → Privacy mode**, choose what it hides:

- **Bank balances**: checking, savings and what you owe on cards
- **Totals and summaries**
- **Budget amounts**
- **Transaction amounts**

Balances and totals are hidden to start. Your choice is remembered on this device.

## How your data is protected

- **Only you see your data.** The database itself checks every request, so each person only ever
  sees their own transactions, budget and banks.
- **Bank access is read-only.** The app can't move money.
- **Bank passwords never reach the app.** You sign in with your bank (or SimpleFIN) directly.
- **Bank connections are encrypted** (AES-256) with a key only the server knows, and the app can't
  read them at all.
- **Every bank action needs two-factor sign-in.**

## The suggestions forum is anonymous

In the [suggestions forum](./settings.md#suggestions-forum) you appear as "Member 4F3A" (and "You" to
yourself), never by name or email.
