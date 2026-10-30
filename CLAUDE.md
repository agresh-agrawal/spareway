# Spareway — rules for Claude Code

**Who am I?** Local Claude desktop app with the Supabase MCP = **Agent Code**. Cloud session on claude.ai/code (no Supabase, no secrets) = **Agent Git**.

**Read first:** `docs/Spareway_01_Plan_Architecture_and_Spec.pdf`, `docs/Spareway_02_Design_System.pdf`,
`docs/Spareway_03_Engineering_Reference.pdf`, `docs/phases/<your phase>.pdf`, `docs/PROGRESS.md`.

## Rules
- Ask first, plan, then build. Never guess names: DB names come from `supabase/spareway_database.sql` and `src/types/database.ts`; library APIs from the installed version in `node_modules`.
- **Stay in your folders** (Plan PDF section 4.4). Shared Phase 0 files (`src/app`, `src/lib`, `src/types/domain.ts`, `src/components/shell`, `src/index.css`, `package.json`, `vite.config.ts`, `CLAUDE.md`) are not edited later — write a CONTRACT CHANGE REQUEST in `docs/PROGRESS.md` instead. New files in `src/components/common` are fine.
- Plug in only through slots and your feature's `module.tsx`; import other features only through their `index.ts`.
- No new npm packages. Every package is installed in Phase 0.
- Design: Design System section 1 (simple UI) + section 6 (Hindi button). Contracts: Engineering Reference section 1.
- Every string in en + hi (`features/<id>/i18n/{en,hi}.json`); stored demo values via `td()`; alerts/activity via `tm(kind, meta)`.
- Honest numbers: Sample / Simulated / AI / Estimated badges where due.
- Database: only Agent Code touches Supabase. Changes are additive files `supabase/sql/phase<n><code|git>_*.sql`; Agent Code applies them and regenerates `src/types/database.ts`. Never hand-edit `database.ts`.
- Secrets live only in Supabase secrets / `.env.secrets` (gitignored). The browser only gets the `VITE_*` values in `.env`.
- Keep the repo clean: no scratch scripts, notes or test output committed. Only these three Markdown files hold agent notes: `CLAUDE.md`, `docs/PROGRESS.md`, `docs/DECISIONS.md`.

## Git
- Branches: `code/phase<n>-…` (Agent Code), `git/phase<n>-…` (Agent Git). Only Agent Code merges to `main` and tags.
- Commits `feat(scope): …`, `fix(scope): …`, `test(scope): …`, `chore: …`; small, pushed at least hourly. Never force-push, never rewrite another agent's commits.

## Commands
`npm run dev` · `npm run dev:https` (phone over LAN) · `npm run check` (typecheck + lint + test) · `npm run build` · `npm run pois` (regenerate POI SQL from `data/pois/*.csv`).
Dev fixture mode: `?fixture=seed` (dev builds only).

**Done** = check + build pass (also without `.env`), Verify list done, PROGRESS + DECISIONS updated, branch pushed.
