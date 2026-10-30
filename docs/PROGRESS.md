# Progress

## Phase 0·Code — Setup (branch main) status: done (tag v0) — setup only, no app code

The owner asked for Phase 0 to be **setup only**: all app code and UI was removed on 2026-10-30
(it stays in git history, commit `eb6ee88`). `src/` holds only an empty entry (`main.tsx`), the generated
`types/database.ts` and the test setup.

Ready:
- Repo `agresh-agrawal/spareway` (private), `main` pushed; layout: `docs/`, `docs/phases/`, `supabase/`, `data/pois/`, `data/reference/`, `scripts/`, `public/brand`, `public/icons`.
- Every package from Architecture 4.2 installed (Vite 8, React 19.3, TS 6.0, Tailwind 4, Supabase JS, React Query, i18next, three/R3F, MapLibre, …); configs for build, lint, test; `npm run check` + `npm run build` green without `.env`.
- Supabase `darwxazznvfocihderma`: full schema + functions + views + storage + realtime (from `supabase/spareway_database.sql`), 120 real route POIs from Vansh's CSVs (`npm run pois`), security fixes `supabase/sql/phase0code_security.sql`. First-login seeding verified in SQL: Home numbers 3 of 6 / 1 / 4, demo trip 104 units / 2,638 kg, company isolation, reset.
- `src/types/database.ts` matches the live database (incl. relationships).
- Vercel project `spareway` (team agresh) linked to the repo; env `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_MAP_STYLE_URL`; every push to `main` deploys to https://spareway-agresh.vercel.app.
- Logo + favicon / PWA icons; `.env` (public values), `.env.secrets` (local only: AI, Brevo, Google keys, QA test owner).

Auth configured 2026-10-30 (Management API): Google sign-in ON (client 305717058870-…), Site URL https://spareway.vercel.app, redirect URLs localhost:5173/4173 (http + https), spareway.vercel.app and its preview URLs, password ≥ 8 with a letter and a number. Email: Supabase built-in mailer (owner's choice).

Open (owner):
- [x] Supabase → Authentication → Sign In / Providers → Email: turn **Confirm email OFF** (built-in mailer sends 2 emails/hour, only to project team members — judges could not confirm). Spec fallback (Architecture 10).
- [x] Edge Function secret `GEMINI_API_KEY` (set 2026-10-30).
- [ ] Edge Function secret `GEMINI_MODEL=gemini-3.5-flash` (before Phase 3).
- [ ] Edge Function secret `ORS_API_KEY` (before Phase 2 — key from openrouteservice.org).
- [ ] Agent Git: claude.ai/code environment `spareway-cloud` + Claude GitHub App on the repo.
- [ ] Revoke the Supabase access token used for setup after the hackathon.

Vercel URLs (checked 2026-10-30 with the Vercel tools, answer to Agent Git): `spareway.vercel.app` is a production alias of project `spareway` and is public (200) — the Supabase Site URL / redirect URLs are correct, no fix needed. `spareway-agresh.vercel.app` and `spareway-<hash>-agresh.vercel.app` are behind Vercel deployment protection (302 to Vercel login); give judges `spareway.vercel.app` only.

Merged `claude/lucid-wright-jyyee3` (working agreement, `.gitattributes` union rule) into `main` on 2026-10-30. Foundation (`v0.1`) not built yet — waiting for the owner.

Notes: dhaba / no-entry coordinates are town centres (`data.approx_location = true`). A QA owner `qa.owner@spareway.test` exists in Auth (password in `.env.secrets`).

## Phase 1·Code — Trucks, trips and cargo (branch code/phase1-trucks-trips) status: not started

## Phase 1·Git — Packing engine, 3D load plan, map style (branch git/phase1-load-plan) status: not started

## Phase 2·Code — Loader link, route service, live map (branch code/phase2-loader-map) status: not started

## Phase 2·Git — Route planning and trip cost (branch git/phase2-routes) status: not started

## Phase 3·Code — Camera and Hindi voice (branch code/phase3-camera-voice) status: not started

## Phase 3·Git — Extra loads and marketplace (branch git/phase3-extra-loads) status: not started

## Phase 4·Code — Offline, public link, final check (branch code/phase4-offline-deploy) status: not started

## Phase 4·Git — Earnings and analytics (branch git/phase4-earnings) status: not started

## Working together — Agent Code (local) + Agent Git (cloud) (added 2026-10-30 by Agent Git)

Owner's plan (2026-10-30): the Phase 0 app foundation (removed in `b96d7b1`, still in git at `b96d7b1^`) and the Phase 1 local tasks are built by **Agent Code** locally. Agent Git starts a phase part only when the owner says so.

**Start gate (tested 2026-10-30).** A parallel Phase 1 started from `v0` conflicts at the merge: both agents need `src/types/domain.ts`, slots, router, i18n, `components/common`, so both create them (add/add conflict). So:
1. Agent Code merges this branch (`claude/lucid-wright-jyyee3`, docs + `.gitattributes` only) into `main` first.
2. Agent Code puts the foundation (contracts `domain.ts` exactly as Engineering Reference 1, modules + slots, router, `queryKeys`, `errors`, `supabase`, i18n + `td()`/`tm()`, `components/common`, shell, Home, Settings) on **`main`** — not on a phase branch — and tags it (e.g. `v0.1`).
3. Only then do both Phase 1 parts start, from that tag. Agent Git checks the tag exists before writing code.
4. If Agent Git is asked to start before the tag: it writes only in its own folders (pure engine, worker, map style, preview page), keeps temporary types in `src/features/load-planner/types.ts` copied from Engineering Reference 1.4, never creates shared files, and wires slots/i18n/API after the tag lands (by merging `main` into its branch).

**While both run.**
- Each file has one owner (Plan 4.4). A change to a shared file → CONTRACT CHANGE REQUEST in this file.
- Pick up new `main` with `git merge origin/main` (no rebase, no force-push).
- Agent Git pushes only its own branch and writes the branch's real name in its section heading (a cloud session may be given a name other than `git/phase<n>-…`); the merge session merges that branch.
- PROGRESS.md: edit only your own section (sections merge cleanly — tested). DECISIONS.md: only add rows at the end (`merge=union` in `.gitattributes` keeps both sides — tested).
- Agent Code merges into `main` (Engineering Reference 11), applies `supabase/sql/phase<n>git_*.sql`, regenerates `database.ts`, runs Git's "Code must verify" list.
- Agent Git holds no secrets and never connects to Supabase; Edge Functions are mocked from Engineering Reference 6.

Cloud check 2026-10-30 (on `v0`): GitHub App works; `npm ci`, `npm run check`, `npm run build` pass.

Cloud environment — owner to set (environment menu → Edit):
- [ ] Network: allow `tiles.openfreemap.org` (blocked 2026-10-30; needed for the map style, F12).
- [ ] Setup script `[ -f package.json ] && npm ci || true` (dependencies were not pre-installed in this session).

For Agent Code to check: Supabase Site URL / redirect URLs list `spareway.vercel.app`, but Vercel deploys `spareway-agresh.vercel.app` — if that is not an alias, auth emails and Google sign-in on the deployed app will fail.
