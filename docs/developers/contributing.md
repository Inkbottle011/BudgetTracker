---
sidebar_position: 7
title: "Making changes"
description: "How work on Budget Tracker is done, from a branch to a merged pull request."
---

# Making changes

## The workflow

1. **One branch per piece of work.** Keep adding commits to it, and open a single pull request.
2. **Test first.** Write the failing test, then the code. See [Testing](./testing.md).
3. **Keep to the structure.** New parts of the app get their own folder in `src/features/`, and
   features use each other only through their front doors. See [How it works](./architecture.md).
4. **Database changes** go in the setup files under `supabase/sql/` and are listed in
   `scripts/apply-database-setup.mjs`, so merging applies them. See [Deploying](./deploying.md).
5. **Update the docs** in `docs/` when what people see or do changes.
6. **Merge** once the whole piece is done and tested, along with any one-time steps (like a new
   secret) written in the pull request.

Tests run on every pull request. After merging, check the **Actions** tab: **Deploy backend** and
**Deploy docs** should both be green.

## Words and looks

- Plain verbs. Buttons say what happens ("Save changes", "Add transaction").
- Errors say what went wrong and how to fix it. Empty screens say what to do next.
- Sentence case everywhere; no ALL-CAPS labels and no emoji in the interface.
- Colors come from the theme, never hard-coded. See [Design](./design.md).

## Ideas and problems

People using the app post ideas and problems in the suggestions forum, and moderators mark them
**Planned**, **Done** or **Not planned**. To become a moderator: Supabase → **Authentication → Users**,
copy your user ID; **Table Editor → `forum_moderators` → Insert row**, paste it into `user_id`, and
**Save**.

## What's next

- Reminders: a subscription due tomorrow, a category past 85%, a high card balance
- A cash flow forecast: what your balance will be over the coming weeks
- Savings goals with progress
- "Always put this place in this category" rules, and smarter automatic categories
- Privacy mode turning itself on in public
- Add to your phone's home screen as an app (full screen, with an icon)
- Budget templates (such as 50/30/20)
- Full data export (transactions and budget in one file) and account deletion
