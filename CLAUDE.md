# Working on this repo

- **One branch per piece of work.** Keep adding commits to it; open a single PR and only suggest
  merging once the whole piece is done and tested, along with any one-time steps.
- The main branch is `master`.
- Layout: a modular monolith. Each part of the app is a folder in `src/features/<name>/` (screens/, logic/,
  __tests__/) with two front doors: `index.ts` (screens too) and `api.ts` (data and logic only). Other
  features import only those (logic uses `api`); each feature owns its tables; `src/shared/` never imports
  a feature. `src/__tests__/architecture.test.ts` enforces this. New features get their own folder.
- Test-first (TDD): write the failing test, then the code. Run `npm test` (Jest + database tests).
- Database changes go in the idempotent setup files under `supabase/sql/` and are listed in
  `scripts/apply-database-setup.mjs`; merging to master applies them and deploys the bank function
  automatically (`.github/workflows/deploy-backend.yml`). Never ask the user to paste SQL for setup.
- The user is on Windows (VS Code terminal); explain steps in plain language.
