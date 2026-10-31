# Progress

## Phase 0·Code — Setup and foundation (branch main) status: done (tag v0.1)

Built (restored from `eb6ee88` on the owner's request, then completed) — on `main`, tag **`v0.1`** = the start point for both Phase 1 parts:
- Contracts `src/types/domain.ts` (Engineering Reference 1), module + slot system with all 8 slots (`home.actions`, `home.widgets`, `settings.sections`, `truck.tabs`, `trip.steps`, `trip.actions`, `cargo.addMethods`, `loader.actions`; empty slot → nothing), router with publicRoutes, query keys, `AppError` + error mapping.
- `src/lib`: supabase (lazy env), env, queryKeys, errors, format, units, geo, lowData, realtime, i18n (`td()`, `tm()`), **fixtures** (dev fixture mode).
- `src/i18n`: common en/hi (glossary, errors 5, templates 7.7), demo dictionary `data/hi.json` (7.6).
- Design System: tokens in `src/index.css`, `components/ui` (radix), `components/common` (section 5), `components/shell` (rail / bottom tabs, top bar, search, bell, avatar menu, low-data, About, 404, fixture banner).
- Features: auth (F2 — 5 pages, guards, first-login seeding), home (F5), settings (F6).
- **Fixture mode** `?fixture=seed` (dev only): fake owner + the SQL seed's data (6 trucks, 3 trips, demo cargo 104 / 2,638 kg, 12 listings, 4 alerts, 6 activity, 30 days of stats) and the three views computed like SQL. See CLAUDE.md for how features use it.
- Database, route data, Vercel, auth settings — as in v0 (see below).

Verified 2026-10-31:
- `npm run check` (84 tests) + `npm run build` pass, also with `.env` renamed. Main bundle 272 KB gzip.
- Fresh sign-up through the real form (qa.owner2@spareway.test) → straight in → "Setting up your demo trucks…" → Home **3 of 6 / 1 / 4**, problems as one-line titles, activity 6 rows, chart with Sample badge.
- हिंदी: every label + demo data + problems + activity in Hindi; kept after reload; saved in `profiles.preferred_lang`.
- Second account sees only its own data (each company its own 6 trucks / 3 trips; RLS test from v0).
- Settings: diesel 96.5 saved for that company only.
- 375 px Hindi: no sideways scroll. Fixture mode on / off works, no console errors.
- Design System 13 by review: one lime button per view, icon + word, ≤ 3 numbers per card, tokens only, badges, loading / empty / error states.

Not checked here: Google sign-in end to end (needs a real Google login in the browser — the redirect to Google works); a real Android phone over the hotspot (do it in the Phase 1 merge).

Open (owner):
- [ ] Google Cloud Console → APIs & Services → Credentials → OAuth client (Web): add Authorized redirect URI `https://darwxazznvfocihderma.supabase.co/auth/v1/callback` (live test 2026-10-31 gave `redirect_uri_mismatch`); Authorized JavaScript origins `https://spareway.vercel.app`, `http://localhost:5173`.
- [ ] Rotate keys pasted in chat on 2026-10-30 (OpenAI, both Gemini, Brevo, Google client secret; also the Supabase secret key and access token), put the new ones in `.env.secrets`.
- [ ] Edge Function secrets `GEMINI_MODEL=gemini-3.5-flash` (before Phase 3) and `ORS_API_KEY` (before Phase 2; key from openrouteservice.org). `GEMINI_API_KEY` is set — replace it after rotation.
- [ ] Cloud environment: allow `tiles.openfreemap.org`; setup script `[ -f package.json ] && npm ci || true`.

Infra (from v0): Supabase `darwxazznvfocihderma` — schema, functions, views, storage, realtime, 120 real POIs, `phase0code_security.sql`; Google sign-in ON; Confirm email OFF (built-in mailer); Site URL + redirects for localhost and `spareway.vercel.app`. Vercel project `spareway` auto-deploys `main` to https://spareway.vercel.app (public alias; `*-agresh.vercel.app` URLs are behind Vercel login). QA owners `qa.owner@spareway.test`, `qa.owner2@spareway.test` (passwords in `.env.secrets`). Dhaba / no-entry coordinates are town centres (`data.approx_location = true`).

## Phase 1·Code — Trucks, trips and cargo (branch code/phase1-trucks-trips) status: ready to merge

Built (from `v0.1`; owner's answers: presets yes, delivery times optional, step order as spec, trip save in one DB function):
- **DB:** `supabase/sql/phase1code_trips.sql` — `create_trip_with_stops(truck, departure, freight, stops jsonb)` (trip + ordered stops + `trip_created` activity in one transaction, next trip code, owners only). Applied with the MCP; `database.ts` has the new function.
- **F7 Trucks** (`/trucks`, `/trucks/:truckId`): filter chips with counts, board by status on laptop / list on phone, truck cards (size · payload, driver + call, open-trip chip). Add / Edit sheet with 8 size presets ("typical — check your truck"), inside size in ft with a cm switch (cm kept exact: only typed fields are converted), payload in t, cost per km, driver, status, More details (axles, mileage, body), box preview. Truck page: Repair / Off / Free to work, Edit, lime "New trip for this truck", tabs Overview · Trips · Problems + slot `truck.tabs`. Duplicate number → field error; truck with trips can't be deleted → offer Off. Status change → `truck_status` activity (meta {reg, status}).
- **F8 Trips** (`/trips`, `/trips/new`, `/trips/:tripId?step=`): chips Planned · Loading · On the road · Done, board on laptop, cards with route, drops, truck chip, departure, space used. 3-step wizard (Truck · Stops from 60 hubs or the map, up/down to reorder, optional deliver-by · Departure + freight) → one DB call. Trip page: header with stops, big status button (Start loading → Leave (confirm, ends the loader link) → Mark delivered), NextStepCard, StepTabs 1 Cargo + slot `trip.steps` (✓ via `done`), slot `trip.actions`. Home quick button "New trip" (`home.actions`).
- **F9 Cargo** (trip step 1): bars "Weight x% / Space y% of truck" (booked), groups per drop stop, item cards (size, kg × qty, Fragile / Keep upright / Don't stack, Won't fit, Added by loader + AI badges), add / edit / copy / delete, cm ⇄ inch, slot `cargo.addMethods`, realtime on `cargo_items`, one `overload` alert (meta {code, kg, payloadKg}) when booked weight goes over payload.
- Public APIs: trucks → `useTruck`, `useTrucks`, `TruckChip`; trips → `places`, `searchPlaces`, `StopChip`, `useTrip`, `useTripStops`, `useTrips`, `unloadOrderForStops`; cargo → `CargoList`, `useCargoItems`, `cargoTotals`.
- Every `api.ts` works in fixture mode (`?fixture=seed`). en + hi for every string; 40 hub names added to the demo dictionary `src/i18n/data/hi.json` (additive).

Verified 2026-10-31 (`npm run check` 117 tests, `npm run build` with and without `.env`):
- Edit MP09 HG 4821 in feet (cost 34 → 35) → DB 975 / 243 / 243 cm unchanged. ✓
- Add a truck from the 32 ft MXL preset → MH12 QA 0001, 975 / 243 / 243, 15 t, 3 axles. ✓
- New trip Indore → Nashik → Pune (Chakan) (2 drops) → TRP-2026-0032 in Trips, `trip_overview` 2 drops, activity "New trip TRP-2026-0032". ✓
- Demo trip Cargo: 104 units, 2,638 kg, bars 18% / 34%. ✓ Add item → bars update, NextStepCard moves on. ✓
- 375 px in Hindi: trucks, trips, trip page — no sideways scroll. Production preview: map with worker + tiles. ✓

Hotfix on `main` (Phase 0 shared files, commit `42e7238`, merged into this branch): MapLibre 6 worker was never shipped (blank map in dev + production) → `setWorkerUrl` with `?url` import in `MapView.tsx`; `optimizeDeps.include` for the map libraries in `vite.config.ts` (dev reload left two copies of React). **Agent Git: `git merge origin/main`** — and if you create a MapLibre map yourself (map preview page), call `setWorkerUrl` the same way.

Not built (noted for later): editing a trip's stops after creation (the "plan must be redone" warning comes with it); real drag-and-drop (up / down buttons instead — works on touch).

**Code must verify at the merge:** with Agent Git's load planner merged — trip page shows step 2 "Load plan" with ✓ after "Use this plan"; Home shows "Plan load" next to "New trip"; truck page shows the "Load layout" tab; demo trip packs 104 / 0 unplaced.

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
