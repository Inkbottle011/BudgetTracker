# Budget Tracker — Feature & Fix Backlog

---

## 🔴 Critical (Do Before Sharing With Anyone)

- [ D] **Sign out** — users have no way to log out currently
- [ D] **Move anon key to environment variables** — currently hardcoded in `lib/supabase.ts`
- [ D] **Re-enable email verification** — disabled for testing, must be on for production
- [ D] **Error boundaries** — app shows blank screen on crash, needs graceful error handling

---

## 🟠 High Priority

### General / App-Wide
- [ ] **Tab icons** — tabs are text only, need icons
- [ ] **App name / logo in header**
- [ ] **Toast notifications** — replace inline banners with proper toasts
- [ ] **Settings screen** — logout, change password, account info
- [ ] **Delete account** — GDPR/privacy best practice
- [ ] **Password strength requirements** — currently only 6 character minimum
- [ ] **Rate limiting on login** — add UI lockout after X failed attempts

### Transactions
- [ ] **Date picker** — replace manual YYYY-MM-DD text input
- [ ] **Recurring indicator** — icon or label on rows that are recurring
- [ ] **Import from CSV** — upload a bank CSV to bulk add transactions
- [ ] **Undo delete** — brief toast with undo button after deleting
- [ ] **Auto-populate from bank** — CSV import (free) or Plaid/Teller (paid)

### Budget
- [ ] **Copy previous year** — duplicate last year's budget as a starting point
- [ ] **Rename budget items** — edit name without deleting and recreating
- [ ] **Export to CSV** — download budget spreadsheet

### Dashboard
- [ ] **Spending by category chart** — pie or bar chart for current month
- [ ] **Monthly trend chart** — income vs expenses over last 6 months
- [ ] **Budget health score** — overall indicator of how on track you are
- [ ] **Savings rate** — % of income being saved this month

---

## 🟡 Medium Priority

### General / App-Wide
- [ ] **Responsive layout** — improve for different screen/window sizes
- [ ] **Pull to refresh** — standard mobile pattern
- [ ] **Session timeout** — users currently stay logged in forever
- [ ] **Favicon / app icon** — replace default Expo icon

### Transactions
- [ ] **Custom categories** — let users create their own beyond budget items
- [ ] **Notes/attachment preview** — paperclip icon if transaction has details
- [ ] **Bulk edit** — select multiple rows and change type or category at once
- [ ] **Split transaction** — divide one transaction across multiple categories
- [ ] **Total transaction count** — show how many transactions exist in total
- [ ] **Warn on budget item delete** — alert that old transactions will have orphaned categories

### Budget
- [ ] **Reorder items** — drag to reorder rows within a section
- [ ] **Net savings row** — income minus all outflows shown at bottom
- [ ] **Percentage column** — each item as % of total income
- [ ] **Copy row** — duplicate a budget item with all its amounts
- [ ] **Notes per cell** — explain why a month's amount differs
- [ ] **Budget item ordering** — items currently show in creation order only

### Dashboard
- [ ] **Top spending categories** — ranked list of highest spend this month
- [ ] **Days until next paycheck** — based on recurring income transactions
- [ ] **Quick add transaction** — add without leaving dashboard
- [ ] **Alerts** — warn when close to or over budget in a category
- [ ] **Dashboard pagination** — recent transactions limited to 10 with no way to see more

---

## 🟢 Nice to Have / Polish

### General / App-Wide
- [ ] **Dark mode**
- [ ] **Animations and transitions**
- [ ] **Keyboard shortcuts**
- [ ] **Haptic feedback** (mobile)
- [ ] **Data backup / full export** — export all transactions + budget as one file

### Transactions
- [ ] **Recurring transactions auto-generate via edge function** ✅ Done — but consider adding a manual trigger button

### Budget
- [ ] **Budget templates** — start from 50/30/20 or other preset structures
- [ ] **Multi-currency support**
- [ ] **Shared budgets** — share with another user (requires major architecture changes)

### Dashboard
- [ ] **Net worth tracker** — total assets minus liabilities over time

---

## ✅ Completed

- [x] Email/password auth with validation
- [x] Sign up with success feedback
- [x] Supabase connected with RLS
- [x] Transaction add with type, category, name, amount, date, details
- [x] Transaction edit (edit mode)
- [x] Transaction delete with multi-select and confirmation
- [x] Transaction duplicate
- [x] Recurring transactions with weekly/biweekly/monthly/yearly
- [x] Recurring auto-generation via Supabase edge function + cron job
- [x] Transaction search
- [x] Transaction filter by type and date range
- [x] Transaction sort by date, type, amount
- [x] Running balance column
- [x] Transaction pagination (20 per page)
- [x] Transaction summary bar (income, expenses, net for visible rows)
- [x] Export transactions to CSV
- [x] Budget yearly planner with Income, Expense, Savings, Investment
- [x] Budget cell editing with save-one and fill-right
- [x] Budget row totals and monthly totals
- [x] Budget net row at top
- [x] Budget year navigation
- [x] Categories synced from budget items to transaction form
- [x] Dashboard with balance, income/expense summary
- [x] Dashboard actual vs planned with monthly/yearly toggle
- [x] Dashboard upcoming recurring transactions (next 30 days)
- [x] Recent transactions on dashboard