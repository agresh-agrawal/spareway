# Decisions

| Date | Part | Decision | Why |
|---|---|---|---|
| 2026-10-29 | 0·Code | Repo root is the project folder; PDFs in `docs/` + `docs/phases/`, SQL in `supabase/`, POI CSVs in `data/pois/`, other reference CSVs in `data/reference/` | Spec layout; user asked for a clean structure |
| 2026-10-29 | 0·Code | Public `VITE_*` values committed in `.env`; secret keys only in gitignored `.env.secrets` and Supabase secrets | User wanted env in the repo; publishable key is public by design, secrets would leak and GitHub push protection blocks them |
| 2026-10-29 | 0·Code | Supabase uses the new `sb_publishable_…` key in `VITE_SUPABASE_ANON_KEY` | Project issues publishable keys; supabase-js accepts them the same way |
| 2026-10-29 | 0·Code | Vercel deploys from Phase 0 (not only Phase 4); `main` auto-deploys | User's choice |
| 2026-10-29 | 0·Code | Default language English; browser `hi*` → Hindi | User answer (spec default) |
| 2026-10-29 | 0·Code | TypeScript pinned to 6.0 | typescript-eslint does not support TS 7 yet |
| 2026-10-29 | 0·Code | shadcn/ui style: components written in `src/components/ui` on top of the `radix-ui` package | shadcn is a copy-in pattern, not a runtime package |
| 2026-10-29 | 0·Code | Logo drawn in-house (lime mark + "Spareway") | User asked Claude to make the logo |
| 2026-10-29 | 0·Code | Database was already created from `spareway_database.sql` in the SQL Editor (no migration history); not re-applied. Real POIs loaded (120 rows), `phase0code_security.sql` applied as a migration | Avoid running the schema twice |
| 2026-10-29 | 0·Code | Remaining advisor warnings accepted: `loader_*` callable by anon (no-login loader link), owner RPCs callable by authenticated, `route_cache` without policies (service role only) | By design (Architecture 5.1, 5.2) |
| 2026-10-29 | 0·Code | Supabase project region is eu-central-1, not Mumbai | Project was created that way; latency acceptable for the demo |
| 2026-10-30 | 0·Code | Phase 0 kept as setup only: all app code / UI removed (in history at `eb6ee88`) | Owner's request |
| 2026-10-30 | 0·Code | Gemini model for ai-cargo: `gemini-3.5-flash` (JSON schema output tested, ~9 s). `gemini-2.5-flash` is closed to new users; `gemini-3.8-flash` and `gemini-flash-latest` took > 40 s | Checked with both provided keys |
| 2026-10-30 | 0·Code | OpenAI key not used (spec uses Gemini only) | Architecture 3 |
| 2026-10-30 | 0·Code | Auth email via Supabase built-in mailer instead of Brevo; custom email templates not possible on it (free tier) | Owner's choice |
| 2026-10-30 | Git | Phase 0 foundation and Phase 1 local tasks built by Agent Code; Agent Git starts a part only when the owner says, from the newest tag | Owner's answer; avoids both agents writing the shared foundation |
| 2026-10-30 | Git | `docs/DECISIONS.md merge=union` in `.gitattributes`; foundation on `main` + tag before parallel phases | Simulated a parallel Phase 1 merge: DECISIONS rows and `domain.ts` conflicted |
| 2026-10-30 | 0·Code | Public URL is `spareway.vercel.app` (production alias); team URLs `*-agresh.vercel.app` stay behind deployment protection | Checked with the Vercel tools |
| 2026-10-31 | 0·Code | Foundation restored from `eb6ee88` and completed on `main`, tagged `v0.1` (start point for Phase 1 Code + Git) | Owner's request; start gate from Agent Git |
| 2026-10-31 | 0·Code | Fixture mode in `src/lib/fixtures`: in-memory copy of the SQL seed + the 3 views; `AuthProvider` fakes the owner; features branch in their own `api.ts` | Cloud agent has no database (Architecture 4.6) |
| 2026-10-31 | 0·Code | Problem cards show the alert title (one line) for seeded rows; meta templates for new rows | Design System 7.3 "one-line title" |
| 2026-10-31 | 1·Code | New trip saved by SQL `create_trip_with_stops` (one transaction) | Owner's answer; no half-saved trips |
| 2026-10-31 | 1·Code | Truck form keeps sizes in cm; ft shown with 2 decimals; only typed fields convert | Verify list: editing in feet must keep 975 / 243 / 243 (8.0 ft = 244 cm) |
| 2026-10-31 | 1·Code | Stops reorder with up / down buttons, not drag-and-drop | Native drag doesn't work on touch phones; buttons are bigger and accessible |
| 2026-10-31 | 1·Code | 40 hub names added to `src/i18n/data/hi.json` (additive) | Hindi mode showed new hub names in English |
| 2026-10-31 | 1·Code | Trip status changes write no activity rows (only `trip_created`, `truck_status`) | Only those kinds have Hindi templates (Engineering Reference 7.7) |
| 2026-10-31 | 0·Code | Hotfix on main: MapLibre worker via `setWorkerUrl(?url)`, `optimizeDeps.include` map libraries | Map was blank in dev and production (worker 404) |
| 2026-10-31 | 1·Git | Overhang allowed: support ratio = `company_settings.support_ratio` (0.5–1, seed 1.0) | User answer Q1 |
| 2026-10-31 | 1·Git | A box only rests on stackable, non-fragile boxes at least as heavy (heavyBelow on) | User answer Q2 (spec default) |
| 2026-10-31 | 1·Git | Phone: 3D first, lists below; low-data / no WebGL → top + side drawings only | User answer Q3 (spec default) |
| 2026-10-31 | 1·Git | "Space used" on the load plan = volume % (demo 34 %), same as Cargo and Earnings; free floor is its own tile | User answer; plan PDF example said 66 % (= length) |
| 2026-10-31 | 1·Git | Plans are saved only on "Use this plan"; a saved plan with the same input hash is reused instead of packing again | No draft rows on every view; spec "same input reuses the plan" |
| 2026-10-31 | 1·Git | unloadOrder = drop stop seq, loadOrder = pickup stop seq (0 = origin); box colour = stop colour of that seq | Matches StopChip colours and the stop order |
| 2026-10-31 | 1·Git | Placement choice: deepest (cab) → lowest → left extreme point, smallest length per orientation | Builds LIFO walls from the cab; demo uses 654 of 975 cm |
| 2026-10-31 | 1·Git | Stop order rule: nothing that leaves later may sit on, or door-side in the same lane of, a box that leaves earlier; nothing loaded earlier may block the door path of a box loaded later | "Nothing blocks a box that leaves earlier" made exact |
| 2026-10-31 | 1·Git | NO_SUPPORT only if the free volume could hold the item, else NO_SPACE | Avoids misleading reasons in a full truck |
| 2026-10-31 | 1·Git | Balance warnings: load centre front/back outside 15–60 % of the length, left/right outside 40–60 %; HEAVY_HIGH = box ≥ 40 kg in the upper half | Loading towards the cab is normal; demo stays "Balance OK" |
| 2026-10-31 | 1·Git | Synchronous SHA-256 inside the engine (tested against Web Crypto) | `pack()` stays synchronous in worker, main thread and tests |
| 2026-10-31 | 1·Git | Map labels in Latin script (`name_en` / `name:latin`), no uppercase | MapLibre can't shape Devanagari without a plugin |
| 2026-10-31 | 1·Git | Map style test validates with `@maplibre/maplibre-gl-style-spec` (installed with maplibre-gl) | No new package; WebGL map can't run in jsdom |
| 2026-10-31 | 1·Git | `tools/map-style.mjs` kept as a re-runnable generator (needs `NODE_USE_ENV_PROXY=1` in the cloud) | Spec edge case "base style URL changes" |
| 2026-10-31 | 1·Git | Light + dark theme, light by default (owner's request) via `<html data-theme>`; load plan + map styles ready in both; app tokens + switch = CONTRACT CHANGE REQUEST to Agent Code | Owner's request; overrides Design System 1.13 "dark only" |
| 2026-10-31 | 1·Git | Load plan treats a missing `data-theme` as dark | The app is dark until the switch lands — no light canvas inside a dark page |
| 2026-10-31 | Merge 1 | NextStepCard only on the Cargo step with cargo; "Add item" lime only while the list is empty | Design System 1.1 one lime button per view (Load plan has its own) |
| 2026-10-31 | Merge 1 | Load plan step ✓ from `trip_overview.active_plan_id` as well as the slot's `done()` | ✓ was missing after a reload |
| 2026-10-31 | 2·Code | `route-plan` deployed with `verify_jwt: false`; checks the owner session with `auth.getUser` and the trip with RLS | Project uses asymmetric JWT signing keys; the function authenticates itself |
| 2026-10-31 | 2·Code | Route geometry simplified (Douglas–Peucker ~40 m) before caching / returning | ORS returns ~11,000 points for the demo trip; ~1,400 keep the road shape |
| 2026-10-31 | 2·Code | Live map: real time since departure + ×60 since the page opened, capped at 98 %; straight line through stops until a route is chosen | Architecture F15 "speed ×60"; trucks stay on screen and visibly move |
| 2026-10-31 | 2·Code | Loader step ✓ once the link exists or loading started | Step is about sending the job to the loader |
