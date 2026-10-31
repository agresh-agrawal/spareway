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

## Merge 1 — Phase 1 Code + Git into main (tag v1) — done 2026-10-31

Merged `code/phase1-trucks-trips` then `git/phase1-load-plan` into `main` — no conflicts, no `phase1git_*.sql`. `npm run check` 166 tests + `npm run build` pass, also without `.env`. Main bundle 243 KB gzip (three.js only in the lazy TruckScene chunk).
Integration fixes (trips + cargo, my lane): one lime button per view — NextStepCard shows only on the Cargo step when there is cargo ("Add item" is plain then, lime while the list is empty; other steps own their lime button); Load plan step ✓ also from `trip_overview.active_plan_id` (after a reload).
Code must verify (Phase 1·Git), real database, owner qa.owner2: ✓ step 2 Load plan — 34 % / 18 %, free floor 10.5 ft, weight left 12.4 t, Balance OK, Jaipur 65–104, Ahmedabad 33–64, Mumbai 1–32, "Everything fits"; 3D canvas renders · ✓ Use this plan → toast, "In use · v1", ✓ tab; DB v1 `active`, `sw-pack-1`, 104 placements, 104 `pending` progress rows, `plan_activated` activity · ✓ reload → still 1 plan · ✓ Home "Plan load" · ✓ truck "Load layout" tab · ✓ trip on the road → "already left", no lime button · ✓ 375 px Hindi, no sideways scroll.
Not run this time: steel-coil over-payload, realtime progress via SQL, support-ratio re-pack, real phone over the hotspot, low-data drawings — engine + hook tests cover them; re-check in Merge 2.
Open: theme CONTRACT CHANGE REQUEST (light / dark, Phase 1·Git section) — not applied yet, owner to schedule.

## Merge 2 — Phase 2 Code + Git into main (tag v2) — done 2026-10-31

Merged `code/phase2-loader-map` then `git/phase2-routes` into `main` — no git conflicts, no `phase2git_*.sql` (nothing to apply, `database.ts` unchanged). `npm run check` + `npm run build` after each merge; final 224 tests, build passes also without `.env`, main bundle 129 KB gzip.
Merge note: after the second merge 4 route tests failed only because Vitest's transform cache still held the `features/*/module.tsx` glob from before `routes` existed — clearing `node_modules/.vite*` / `.vitest-cache` fixed it; no code change.
Change requests applied (from 2·Git): `templates.route_chosen` + `templates.variants` (en/hi) and `tm()` translates the variant; "Mira-Bhayandar Vasai-Virar" in the Hindi demo dictionary (Surat, Indore were already there). Tests added.
Verified: `route-plan` live on `darwxazznvfocihderma` (no session → 401 `AUTH_REQUIRED`). Fixture mode, laptop + 375 px, English + Hindi: trip page steps Cargo · Load plan · Loader · Route; three costed routes, one Best, Choose → "Route chosen — ETAs saved", lime "Send on WhatsApp" with the Hindi driver message to +91 98270 00001; Home (Hindi) "TRP-2026-0031 का रूट चुना: सबसे तेज़, 1417 km" + no-entry alert in Hindi; /map in Hindi, Simulated badge; Loader step "Plan the load first"; no sideways scroll at 375 px. Live map reads `trips.selected_route_id` → `route_options.geometry` (code checked; trip 0031 is Planned so it does not move).
Not verified this time (the Supabase MCP on the new Claude account cannot see project `darwxazznvfocihderma`, and the agent does not sign in with passwords): real-DB Route step (3 ORS routes, `route_options` rows, cache on reload, `trip_financials.route_cost_inr`), loader link end to end on a real phone, map following a chosen route for a trip on the road. Owner to run these on https://spareway.vercel.app as qa.owner2.
Known: the `city_entry` alert's "(from–to)" shows arrival time → end of no-entry (e.g. 19:23–23:00), not the whole no-entry window — 2·Git's meta; fix in Phase 3 if wanted.

## Phase 1·Code — Trucks, trips and cargo (branch code/phase1-trucks-trips) status: merged (v1)

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

## Phase 1·Git — Packing engine, 3D load plan, map style (branch git/phase1-load-plan) status: merged (v1)

Started from tag `v0.1` (+ `origin/main` merged in). Only `src/features/load-planner`, `public/map`, `tools/` changed. No SQL file, no new packages.

Built:
- **F10 Packing engine** `load-planner/engine` (pure TS, synchronous, deterministic): `buildPackItems(cargoRows, stops, truck)` → `{container, items}`; `pack`, `fitAdditional` (boxes already loaded stay fixed), `computeInputHash` (SHA-256), `validatePlan` (independent rule checker). Extreme points; deepest (cab) → lowest → left; 6 orientations (2 if upright). Rules: inside, no overlap, payload, support ≥ `support_ratio` of the base on stackable non-fragile boxes at least as heavy, stop order (nothing that leaves later sits on or door-side of goods that leave earlier). Reasons TOO_LARGE / OVER_PAYLOAD / NO_SPACE / NO_SUPPORT / ORDER_CONFLICT; warnings COG_LONGITUDINAL / COG_LATERAL / HEAVY_HIGH. Demo trip: **104 placed, 0 unplaced, ~90 ms**, space 34.4 %, weight 17.6 %, used length 654 cm (free floor 10.5 ft), Balance OK; Mumbai at the cab, Jaipur by the doors.
- **Worker + hooks**: Comlink worker (falls back to the main thread without Workers); `api.ts` (+ fixture mode copying `activate_load_plan`); `usePlanForTrip(tripId)` — reuses a saved plan with the same input hash, else packs in the worker; "Use this plan" saves the next version (draft) + `plan_unplaced` alert `{code, count}` if something didn't fit, then `activate_load_plan`; live progress via `useRealtime('loading_progress')`; cargo via `useRealtime('cargo_items')`.
- **F11 3D load plan** (Design System 7.7 / 9): bars Space used + Weight; tiles Free floor · Weight left · Balance OK; 3D (react-three-fiber, instanced boxes, open doors, cab, 50 cm grid, render on demand, dpr ≤ 1.5, own lazy chunk) with 3D / From top / From side, Play loading order (slider instead of animation with reduced motion), Show in truck (others fade), loaded solid / waiting faded / problem red; Packages by stop; Didn't fit with plain reason + advice; lime "Use this plan" / "In use · vN" / "cargo changed" / "trip has left". No WebGL or low-data → SVG `TopView` / `SideView`. Full screen `/trips/:tripId/plan`.
- **Slots**: `trip.steps` Load plan (order 2, `done` = trip has an active plan), `home.actions` Plan load (next planned trip without a plan; hidden when nothing to plan), `truck.tabs` Load layout (top + side drawing of the current / next trip's active plan).
- **Public API** `load-planner/index.ts`: `pack`, `fitAdditional`, `buildPackItems`, `computeInputHash`, `TruckScene` (lazy), `TopView`, `SideView`, `usePlanForTrip`, `usePacker`, `resultFromRow`.
- **F12 Map style**: `public/map/spareway-dark.json` + `spareway-lite.json` (+ light theme `spareway-light.json` / `spareway-light-lite.json`) (OpenFreeMap dark base, Design System 8 colours, attribution on the source; lite = no buildings / minor roads, city labels only), icons `public/map/icons/*.svg` (truck, truck-selected, stop-pin, toll, dhaba, parking, fuel, checkpoint, no-entry), generator `tools/map-style.mjs`, preview `tools/map-preview.html`.
- Tests: 46 new (engine incl. random-cargo invariants, hooks with a fake worker + mocked api, fixture-mode api, screen + slots in fixture mode incl. Hindi, map style). `npm run check` 130 tests + `npm run build` pass, also without `.env`. Main bundle 238 KB gzip; three.js only in the lazy TruckScene chunk.

How to demo (fixture mode): `npm run dev` → `http://localhost:5173/trips/00000000-0000-4000-8000-000000000031/plan?fixture=seed` → see the packed truck → From top / From side → Play loading order → Packages by stop → Show in truck → Use this plan → "In use · v1" → tap हिंदी. Home shows "Plan load". Map: `http://localhost:5173/tools/map-preview.html` (Dark / Lite).

Stubs / fixtures left: none in the app. Engine fixtures in `engine/__fixtures__/demoTrip.ts` (built from the seed, + LD-1051 steel coils for over-payload).

~~CONTRACT CHANGE REQUEST — MapView worker~~ — done on `main` in `42e7238` (merged into this branch); `tools/map-preview.html` sets the worker URL the same way.

CONTRACT CHANGE REQUEST — from 1·Git (owner's request 2026-10-31: light + dark theme, light by default)
File/contract: `src/index.css`, `src/lib` (new theme provider), `src/components/shell` (switch), Settings, `src/components/common/MapView.tsx`, `index.html`, Toaster in `src/app/providers.tsx` — all Phase 0 files (Agent Code).
Change:
1. Contract: the app always sets `<html data-theme="light" | "dark">` (and `color-scheme`). **Default `light`**; choice saved on the device (`localStorage` key `spareway.theme`); optional: a `profiles.preferred_theme` column via `supabase/sql/phase1code_theme.sql` so it follows the owner across devices.
2. `index.css`: light values for every token (canvas, rail, surface 1–3, line, ink 1–3, accent-soft, ok/warn/crit/info) under `html[data-theme='light']`, dark values under `html[data-theme='dark']`. Lime `#e3f58c` stays the main-button colour (dark text on it); lime **text or thin lines** on white fail contrast → use a darker accent for `text-accent` / borders in light (e.g. `#4d7c0f`). Stop colours: stop-1 lime and stop-3 amber need darker text/edges in light.
3. Switch: one pill next to the Hindi button in the top bar (Sun / Moon icon + word "Light" / "Dark", Hindi "लाइट" / "डार्क") and a "Look" card in Settings; one tap switches instantly, no reload. Phone: in the top bar too (not hidden in More).
4. `MapView`: light theme → `/map/spareway-light.json` (low-data → `/map/spareway-light-lite.json`); dark → `spareway-dark.json` / `spareway-lite.json`. Toaster `theme` follows. `index.html` sets `data-theme` before React starts (no dark flash).
5. Design System 1.13 says "dark only" → record the change in DECISIONS.
Why: owner's request. Already done in my lane: the load plan 3D scene, top/side drawings and canvas follow `data-theme` live (`load-planner/lib/theme.ts`; attribute missing = dark, so nothing changes until the switch lands); light map styles `public/map/spareway-light.json` + `spareway-light-lite.json` (tested). Owner to apply: Agent Code (it owns every file above).

Code must verify (Git only) — fresh owner account, real database, laptop + phone:
- [ ] `rm -rf node_modules/.vitest-cache` then `npm run check`: if module/slot tests don't see `load-planner`, the Vitest file cache holds an old transform of `src/app/modules.ts` (it happened here).
- [ ] TRP-2026-0031 → step 2 "Load plan" (Boxes icon): 3D truck, Space used 34 %, Weight 18 %, Free floor 10.5 ft, Weight left 12.4 t, Balance OK; Packages: Jaipur steps 65–104, Ahmedabad 33–64, Mumbai 1–32; "Everything fits in the truck".
- [ ] "Use this plan" → toast "Load plan in use", card "In use · v1", step tab ✓. DB: one `load_plans` row v1 `active`, `engine_version` `sw-pack-1`, 104 placements; 104 `loading_progress` rows (`pending`, steps 1–104); Home activity "Load plan v1 in use — 34.4% space used" (also in Hindi).
- [ ] Reload → no new `load_plans` row (same input hash reuses v1).
- [ ] Add 1 cargo item → plan shows "The cargo changed after plan v1…" → Use this plan → v2 `active`, v1 `superseded`.
- [ ] Add 4 × Steel coils 150×150×120 cm, 4,000 kg, drop Mumbai → Didn't fit "1 × Steel coils — Too heavy: 4 t > 362 kg left"; Use this plan → Home problem "1 items didn't fit in TRP-2026-0031" (warning) with `meta {code, count}`.
- [ ] Realtime: SQL `update loading_progress set status='done' where step_index <= 10 and load_plan_id = <active>` → boxes 1–10 solid, rest faded, "10 of 104 loaded"; one row `issue` → red box, "1 problem".
- [ ] Settings → stacking support 0.8 → plan packs again (new hash), Use this plan → new version.
- [ ] TRP-2026-0029 (on the road) `/trips/<id>/plan`: "This trip has already left…", no lime button.
- [ ] Home "Plan load" opens TRP-2026-0031's plan. Truck MP09 HG 4821 → tab "Load layout" shows top + side drawing after activation; GJ01 KT 2208 → "This plan was saved without a layout" (seed plan).
- [ ] Phone 375 px over the hotspot: 3D drags smoothly (≥ 30 fps), no sideways scroll, हिंदी everywhere incl. item names / places; Low-data mode → drawings + "3D is off in low-data mode".
- [ ] MapView (after `42e7238`) with `VITE_MAP_STYLE_URL=/map/spareway-dark.json` shows the dark style; Low-data → `/map/spareway-lite.json`; attribution visible.
- [ ] After the theme switch lands: tap Light / Dark on the load plan → canvas, 3D truck, drawings and the map switch at once; selected box outlined dark olive in light.

Notes for the other agent:
- Trip page: the Load plan step has its own lime "Use this plan"; while that step is open the NextStepCard should not show a second lime button (Design System 1.1). After activation the next step is "send to loader" (Phase 2).
- `trip.steps` `done()` is synchronous; it reads a flag set when this trip's plans load (`lib/stepState.ts`), so ✓ shows after the plan query ran once this session. If the Trip page wants ✓ from the start it can use `trip_overview.active_plan_id`.
- Query keys: plans use `queryKeys.tripPlans(id)` (load_plans rows, newest first); my trip/stops/cargo reads are sub-keys of `trip(id)` / `tripStops(id)` / `tripCargo(id)`, so invalidating those refreshes the plan.
- Loader page (2·Code): `TopView` / `SideView` take `highlightKey`, `states`, `bare`; no three.js in them.

## Phase 2·Code — Loader link, route service, live map (branch code/phase2-loader-map) status: merged (v2)

Built (from `v1`; owner's answers: ORS key given, loader page Hindi by default, simulate trucks):
- **F14 `route-plan` Edge Function** (`supabase/functions/route-plan`, deployed with the MCP, `verify_jwt: false` because it checks the owner session itself — works with the project's asymmetric JWT keys). Contract exactly Architecture 9.1: `{ tripId, coordinates (≤ 50), variants, truck }` → `{ ok, data: { routes: [{ variant, distanceKm, durationMin, geometry, restricted, cached }] } }`; errors `AUTH_REQUIRED` (401), `TRIP_NOT_FOUND`, `ORS_QUOTA`, `ORS_ERROR`. ORS driving-hgv, one variant after another, `no_tolls` avoids tollways, truck restrictions with retry without them, SHA-256 cache in `route_cache`, geometry simplified (~40 m) to ~1,300–1,500 points. Secret `ORS_API_KEY` set. Pure logic in `lib.ts` (14 tests).
- **F13 Loader step** (`trip.steps` order 3): Send to loader → 48 h link (`create_loader_link`), QR 220 px, Copy, lime Send on WhatsApp ("Spareway loading job TRP-…: link — valid till …"), Valid till, Turn off (confirm), New link; live "38 of 104 loaded" + loader problems (realtime). No active plan → "Plan the load first" + Open load plan.
- **F13 Loader page** `/load/:token` (no login, no shell, Hindi first on a new phone, Hindi button): truck + trip, "Step n of 104" + bar (sticky), one big card (item 26 px, drop stop chip + colour, size + kg, fragile, where in words "Cab side · Left · Floor", top / side drawing with the box highlighted — load-planner `TopView` / `SideView`, no three.js), Done ✓ (56 px lime), Problem (Missing / Damaged / Different size / Other + note → owner alert), Back; "Truck loaded ✓"; "This link has ended…"; "Owner is still planning"; PLAN_CHANGED → refetch, same step number. `loader_get_job` every 5 s while visible (10 s low-data), paused when hidden. Slot `loader.actions` rendered.
- **F15 Live map** `/map` (nav Map, phone tab): chips with counts, Show routes / Show problems, truck markers (lime when selected), problem dot, selected-truck card (bottom on phone, top-left on laptop): route leg, trip done %, "Arrives … · … km left", "Speed … km/h · Fuel …%", amber "Break due in …", Call driver, Open trip; trucks without position listed; footer **Simulated — updates every 3 s** (10 s low-data, lite style). Simulation: real time since departure + ×60 since the page opened along the chosen route, or a straight line through the stops (marked). Slots: Home "Live map", truck tab "Location".
- Fixture mode for every new `api.ts`. en + hi for every string.

Verified 2026-10-31 (`npm run check` 191 tests, `npm run build` with and without `.env`; main bundle 127 KB gzip, LoaderPage 3.7 KB):
- route-plan, real DB + ORS: demo trip → fastest 1,423 km / 1,099 min, shortest 1,323 km, no_tolls 1,496 km; 2nd call all `cached`; no session → 401. Key only in Supabase secrets + `.env.secrets`. ✓
- Loader link: created (QR, valid 48 h, one lime button) → loader page step 1 "Refrigerator 260 L · Mumbai · Cab side · Left · Floor" → Done → step 2 → Problem "Different size" (via the same public RPC) → owner step live "1 of 104 loaded · 1 problem · Loader reported a problem — TRP-2026-0031 · step 2: …" (alert meta {code, step, note}); trip status → Loading. Turn off → loader page "This link has ended". Wrong token → LINK_INVALID. ✓
- /map: 6 markers + 1 truck listed without position, chips, selected card (GJ01 KT 2208 "Vadodara → Surat · Arrives … · 16 km left · Speed 39 km/h · Fuel 42%", approximate line note), Simulated badge; low-data → `/map/spareway-lite.json`, 10 s. 375 px: loader page + map no sideways scroll. ✓

Not verified end to end: re-plan while the loader page is open (code path: PLAN_CHANGED → refetch, covered by RPC behaviour); real Android phone over the hotspot (do at Merge 2). A signed-in owner opening the loader link keeps the owner's language (a loader's phone has no session → Hindi).

**Code must verify at Merge 2 (with Agent Git's Route step):** choosing a route sets `trips.selected_route_id` → /map follows that route instead of the straight line; route step calls `route-plan` with the session token (`supabase.functions.invoke('route-plan', { body })`).

## Phase 2·Git — Route planning and trip cost (branch git/phase2-routes) status: merged (v2)

Started from tag `v1`. Only `src/features/routes` changed. No SQL file, no new packages. Owner's answers: **no departure entry** (uses the trip's departure, else tomorrow 6:00 am IST, shown read-only); Settings rest rules; driver message Hindi by default; driving time = route duration but never faster than Settings average speed; no unloading time; no-entry wait when a stop is inside a city's circle or the route passes a corridor zone whose rule names the stop's town.

Built (F16):
- **Logic** `routes/lib` (pure, tested): chainage + projection (`line.ts`); tolls within 0.5 km × the truck's axle rate from `pois.data.rate_inr`; check posts within 1 km × `checkpoint_delay_min`; `planSchedule` — break every `break_after_drive_h` at a dhaba / parking within 3 km ahead (else "by the road"), night rest after `max_drive_h_per_day` (taken instead of a break when due within the hour), no-entry waits in IST before entering a city (`city_entry` POIs, windows from `data.no_entry`), stop ETAs, LATE warnings vs `window_end`; `costRoute` — diesel = km ÷ mileage × price, tolls, driver = all hours × wage, waiting = (no-entry + check post) hours × waiting cost; Best = lowest total + value of time.
- **Data** `routes/api.ts`: reads trip, truck, stops, settings, `route_options`, POIs in the route's bbox (`queryKeys.pois`); calls `route-plan` (body exactly as Engineering Reference 6.1) only when the trip has no saved routes or the stops changed (saved lines no longer pass the stops) → saves the 3 rows; `ORS_QUOTA` / `ORS_ERROR` / non-2xx bodies mapped to AppError. **Choose** writes `route_options.is_selected` + costs + halts + warnings on the chosen row, `trips.selected_route_id` (+ `planned_departure` when it was empty), `trip_stops.eta`, activity `route_chosen` meta `{code, variant, km}`, and one `city_entry` alert meta `{code, city, from, to, wait}` when the route waits for no-entry hours.
- **Route step** (slot `trip.steps`, order 4, ✓ when a route is chosen): "Leaves 1 Nov, 6:00 am" + "Tolls and times are estimates"; map (lime = route being looked at, grey = others, numbered stops, toll / dhaba / check post / no-entry icons from zoom 8; lazy MapLibre chunk); three cards — name + Best, km · time, total ₹ hero + Estimated, "Diesel · Tolls · Driver" (+ Waiting), "breaks · tolls", up to 2 plain warnings ("Reaches Mira-Bhayandar Vasai-Virar at 6:31 pm — no entry until 9:00 pm, wait 2 h 29 min"); one lime button: Choose on Best until a route is chosen, then "Send on WhatsApp". Journey list (start, stops with "After the delivery time", breaks, night rest, waits, check posts with times). Driver message with हिंदी / English switch → `wa.me/91<driver phone>?text=…`.
- **Public API** `routes/index.ts`: `costRoute`, `planSchedule`, `tollsOnRoute`, `RouteLine`, `useSelectedRoute`, `useRoutePlanner`, `departureFor`, line helpers.
- **Fixtures** (fixture mode + tests only): real POIs parsed from `supabase/sql/phase0_pois_real.sql` (lazy chunk, never loaded with a real database); mocked route-plan lines for the demo trip through the real NH48 toll plazas (fastest), a shorter cut past Udaipur (shortest) and a line off the plazas (no tolls).
- Tests: 29 new (route logic, fixture-mode hook + screen + Hindi, route-plan contract and error mapping, driver message, slot). `npm run check` 195 tests + `npm run build` pass, also without `.env`. Main bundle 245 KB gzip.

Demo numbers (fixture lines, Settings defaults, leaving 1 Nov 6:00 am): Fastest 1,417 km ₹54,282 (22 tolls, waits at Ahmedabad 3 h 37 min and Mira-Bhayandar 2 h 29 min) · Shortest 1,393 km ₹54,547 · No tolls 1,720 km ₹50,710 = Best. Real routes from ORS will differ.

How to demo (fixture mode): `npm run dev` → `http://localhost:5173/trips/00000000-0000-4000-8000-000000000031?step=route&fixture=seed` → three routes → Show (map switches) → Choose on Best → toast, ✓ on the Route tab → driver message → हिंदी / English → Send on WhatsApp → tap हिंदी for the whole screen.

CONTRACT CHANGE REQUEST — from 2·Git
File/contract: `src/i18n/common/{en,hi}.json` templates (Engineering Reference 7.7)   Change: add `templates.route_chosen` — en "Route chosen for {{code}}: {{variant}}, {{km}} km", hi "{{code}} का रूट चुना: {{variant}}, {{km}} km" (variant words: fastest/shortest/no_tolls → "Fastest/Shortest/No tolls", "सबसे तेज़/सबसे छोटा/बिना टोल").
Why: Choose writes activity `route_chosen` with meta `{code, variant, km}`; without a template the Hindi Home shows the stored English line. Workaround meanwhile: stored English message. Owner to apply: Agent Code at merge.

CONTRACT CHANGE REQUEST — from 2·Git
File/contract: `src/i18n/data/hi.json` (demo dictionary)   Change: add the no-entry towns from the POI data: "Mira-Bhayandar Vasai-Virar" → "मीरा-भायंदर वसई-विरार", "Surat" → "सूरत", "Indore" → "इंदौर" (others already there).
Why: the `city_entry` alert passes `meta.city` through `td()`; Route step uses its own copy (`routes/i18n places`) meanwhile. Owner to apply: Agent Code at merge.

Code must verify (Git only) — real database, after Agent Code's `route-plan` is deployed:
- [ ] TRP-2026-0031 → step 4 "Route": loading line, then 3 cards from ORS (Fastest · Shortest · No tolls), one "Best", map shows the lines + numbered stops; zoom to 8+ → toll / dhaba icons. DB: 3 `route_options` rows (`provider` ors / ors-cache, geometry), no second call on reload (Edge Function logs: 1 call).
- [ ] Tolls / costs look sane for MP09 HG 4821 (3 axles): diesel ≈ km ÷ 3.6 × ₹90, toll count 15–25 on NH48, driver = hours × ₹120.
- [ ] A route that reaches Bhiwandi 6–10 am or 5–9 pm shows "Reaches Mira-Bhayandar Vasai-Virar at … — no entry until …, wait …"; same at Ahmedabad (Narol) 8 am–11 pm.
- [ ] Choose → toast "Route chosen — ETAs saved", ✓ on the Route tab, trip header shows stop ETAs. DB: chosen row `is_selected = true` with total / tolls / halts, others false; `trips.selected_route_id`; `trip_stops.eta` filled; activity `route_chosen` meta {code, variant, km}; with a wait → `city_entry` alert on Home (template "… reaches … in no-entry hours (from–to) — wait …", also in Hindi). `trip_financials.route_cost_inr` = chosen total.
- [ ] Driver message in Hindi by default, English switch; "Send on WhatsApp" opens WhatsApp to +91 98270 00001 (or asks whom to send to when no driver phone).
- [ ] Settings → diesel ₹100 → reopen Route step → totals change without a new ORS call.
- [ ] Edit / new trip with different stops → Route step fetches fresh routes (old rows replaced).
- [ ] Route service off / quota → "Routes are unavailable right now…" with Retry; with saved routes the step still works.
- [ ] 375 px in Hindi: no sideways scroll, warnings wrap; laptop 1280 px three cards side by side.

Notes for the other agent:
- **Departure:** the owner asked to drop departure entry ("too much data entry"). The Route step has none. If the New trip wizard should drop its departure step too, that's 1·Code's lane (`planned_departure` can stay empty — Route then uses tomorrow 6:00 am and saves it on Choose).
- Trip page: the Route step owns its lime button (Choose / Send on WhatsApp) — keep NextStepCard off on this step as on Load plan. `done` via `lib/stepState.ts`; after a reload ✓ can also come from `trips.selected_route_id`.
- `route-plan`: I send `weightT` = gross weight (t) and `axleloadT` = gross ÷ axles; routes are read from `data.routes`; non-2xx bodies `{ ok: false, error: { code } }` are read too.
- Extra loads (3·Git) / earnings (4·Git): `useSelectedRoute(tripId)` gives the chosen route's geometry, plan (ETAs, halts, tolls) and cost.

## Phase 3·Code — Camera and Hindi voice (branch code/phase3-camera-voice) status: ready to merge

Built (from `v2`; owner's answers: Gemini key + `GEMINI_MODEL=gemini-3.5-flash` already in `.env.secrets`, A4 sheet as size reference, "ऊपर से / नीचे से 10 बाई 10" = top / base is 10 × 10, height separate). Only `src/features/smart-input` and `supabase/functions/ai-cargo` changed; no SQL, no new packages.
- **F17 `ai-cargo` Edge Function** (`supabase/functions/ai-cargo`, contract Engineering Reference 6.2): loader token first (`loader_trip_for_token`, service role) else owner session (trip via RLS); 1–3 photos ≤ 700 KB (TOO_LARGE), stored at `cargo-images/<company>/<trip>/<uuid>.jpg`; Gemini `generateContent` with a JSON `responseSchema`, 45 s timeout, `GEMINI_API_KEY_1` as fallback key on 429/5xx; every call logged in `ai_scans` (parsed / failed); warnings COUNT_MISMATCH · SIZE_MISSING · SIZE_OUT_OF_RANGE · LOW_CONFIDENCE · NOTHING_FOUND. Voice mode for sentences the rule parser is unsure about. Pure logic in `lib.ts` (16 tests). Deployed 2026-10-31 (v1, `verify_jwt: false`); Gemini secrets were already set on the project.
- **F18 voice parser** `voice/parse.ts`: Devanagari digits, एक…निन्यानवे, सौ/हज़ार, डेढ़/ढाई/सवा/साढ़े/पौने, बाई/बाय/by/x/×, cm/सेमी/इंच/फुट/मीटर, kg/किलो/टन, पीस/नग/बॉक्स/बोरी…, लंबाई/चौड़ाई/ऊँचाई cues, नाज़ुक / सीधा रखें / ऊपर कुछ न रखें, Hinglish + English, several items split at और/and only when the next part has its own size. Missing sizes are reported, never guessed. 27 sentences + 12 more tests.
- **Screens** (Design System 7.12), slot `cargo.addMethods` (owner) and `loader.actions` (loader page): "Scan with camera" — tip "Keep an A4 sheet next to the boxes", 1–3 photos (compressed to ≤ 1280 px / ≤ 700 KB in the browser), Analyse ("Reading photos… about 10 s"), error → Try again / Type instead; "Speak" — 80 px hold-to-talk mic (hi-IN / en-IN, हिंदी/English switch), live text, asks "ऊँचाई कितनी है?" for each missing size (answer by voice or typing), "Type instead" (always; the only way outside Chrome/Edge); **Check items** — editable rows, AI badge + "82% sure", drop stop + kg required, "Drop all at", fragile / upright / nothing-on-top chips, warnings (count differs between photos, unusual size, not sure), "Add N items"; nothing saved before confirm. Owner rows → `cargo_items` (source camera/voice, image_path, confidence) + scan `confirmed`; loader rows → `loader_add_cargo(token, items, source)` → owner alert "Loader added cargo".
- Fixture mode: mocked ai-cargo answer (6.2 example, counts 16 / 15) and in-memory inserts. en + hi for every string.

Verified 2026-10-31 (`npm run check` 289 tests, `npm run build`; SmartAdd chunk 11 KB gzip, lazy): fixture mode in the browser, Hindi — typed "साठ बाय चालीस, सोलह कार्टन, वजन बारह किलो" → asks ऊँचाई → "पैंतालीस" → Check items 60 × 40 × 45, 16, 12 kg; Add blocked until a drop stop is chosen → cargo 104 → 120 pieces, 2,638 → 2,830 kg. Camera: generated 3000 × 2000 photo → thumbnail → Analyse → two AI lines (82 % / 64 %), "फ़ोटो में गिनती अलग है: 16 / 15". 375 px: nothing wider than the screen. No console errors.

Real endpoint, 2026-10-31 (temporary loader link on QA Transport's TRP-2026-0031, removed afterwards; the 4 test `ai_scans` rows deleted; one 320 × 240 test PNG left in `cargo-images/6bcfb922…/f22accb2…/`):
- no session → 401 `AUTH_REQUIRED` · wrong token → 403 `LINK_INVALID` · 1 MB photo → 413 `TOO_LARGE` ✓
- voice "दस बाई दस का बॉक्स, ऊँचाई बीस, पचास पीस, नाज़ुक है" → Box 10 × 10 × 20, 50, fragile, 0.95 (7 s) ✓; Hinglish "do carton hai, kuch 2 foot ke, aur ek bada fridge" → Carton 61³ × 2 + Refrigerator with sizes 0 and `SIZE_MISSING` (the app asks for them) ✓
- photo (box + white A4-sized sheet) → Carton ≈ 45 × 48 × 42, "estimated using the adjacent A4 reference sheet", stored at `cargo-images/<company>/<trip>/<uuid>.png` (11 s) ✓
- every call logged in `ai_scans` (status parsed, model `gemini-3.5-flash`) ✓
- Note: sending Hindi with `curl -d` from Git Bash on Windows turns it into "???" — test with a UTF-8 file or the app.

Still open: phone over `npm run dev:https` with a real camera + mic, owner and loader (do at Merge 3).

CONTRACT CHANGE REQUEST — from 3·Code
File/contract: `src/i18n/data/hi.json` (demo dictionary)   Change: add the labels the parser / AI store: "Box" → "बॉक्स", "Carton" → "कार्टन", "Crate" → "पेटी", "Sack" → "बोरी", "Drum" → "ड्रम", "TV" → "टीवी", "Refrigerator" → "फ्रिज".
Why: cargo rows added by camera / voice show the English label in Hindi. Owner to apply: Agent Code at Merge 3.

## Phase 3·Git — Extra loads and marketplace (branch git/phase3-extra-loads) status: ready to merge

OWNER ADDITION (2026-10-31, written by Agent Code for the owner) — **Additional Cargo Evaluation Engine**, part of F19. Build it inside `src/features/extra-loads` (`lib/evaluate.ts`, pure and tested); every candidate — a marketplace listing **or** a load the owner types in — goes through this one engine.
- **Inputs, reused (no new truck/trip profiles):** truck inside L×W×H, payload kg, ₹/km (`cost_per_km_inr`), axles; trip stops in order, selected route (`useSelectedRoute`, else straight line through stops marked Approximate), existing cargo + active plan (`fitAdditional`). Missing value → plain message + NEEDS REVIEW, never a guess.
- **"Enter a load" form** on the Extra loads step (beside the listings): cargo name, quantity, L/W/H per item (cm), kg per item, pickup, drop, offered freight ₹; optional fragile, non-stackable, upright only, allowed orientations, handling ₹, waiting ₹. One batch per row ("40 cartons" = 1 row × 40), several batches per load. Validate in the form (zod) and again in the engine.
- **Checks, in order:** payload (remaining = payload − existing kg; proposed = Σ qty × kg) · space (`fitAdditional` with orientation / no-stack / fragile flags; items larger than the inside never count; if placement can't be established → NEEDS REVIEW "Needs manual verification", never PASS) · sequence (pickup before drop along the route; drop not before pickup; existing stop order unchanged; corridor + direction as F19) · cost (only what this load adds: extra km × ₹/km + extra tolls if known + handling + waiting; never subtract the whole trip cost) · earnings = offer − extra costs.
- **Result:** ACCEPT (all checks pass, earnings > 0, ≥ minimum profit) · REJECT (any physical / sequence failure — profit never overrides it) · NOT PROFITABLE (feasible, costs ≥ offer or below minimum profit) · NEEDS REVIEW (missing or uncertain data). Card shows the decision first, then PASS/FAIL for Payload · Space · Delivery order, then offer, extra km, fuel/operating ₹, tolls ₹, handling ₹, total extra cost, expected extra earnings (+₹ green / −₹ red), with Estimated badges; detour km from geometry/road factor is labelled **Estimated**, never shown as live navigation. Also "fit is by box size only — check loading safety and axle load" note.
- **Tests (at least):** 1 remaining 1,500 kg, load 500 kg, offer ₹1,000, extra cost ₹300 → ACCEPT, +₹700 · 2 remaining 1,000 kg, load 1,200 kg → REJECT (payload) even with a high offer · 3 fits by weight but no space → REJECT (space) · 4 feasible, cost ₹1,300 > offer ₹1,000 → NOT PROFITABLE, −₹300 · 5 missing size or no route/stops → NEEDS REVIEW · 6 drop before pickup along the route → REJECT (delivery order) · 7 item bigger than the truck inside → REJECT · 8 batch qty 40 = 40 boxes in the fit · plus the F19 decoys LD-1049…1052.
- en + hi for every label; the four decisions in Hindi too (स्वीकार करें · मना करें · फ़ायदा नहीं · जाँच ज़रूरी).

Report (Agent Git, 2026-10-31). Started from tag `v2`, `origin/main` (owner addition `8da0b8c`) merged in. Changed: `src/features/extra-loads` + one owner-approved engine fix in `src/features/load-planner/engine` (below). No SQL file, no new packages. Owner's answers: look **40 km** off route, minimum profit from Settings (₹500); unsuitable loads in a collapsed list; after "Add to trip" re-pack everything if loading hasn't started, else keep loaded boxes fixed; **delivery deadlines ignored** (date shown on the card).

Built:
- **Evaluation engine** `extra-loads/lib/evaluate.ts` (owner addition, pure, tested): one function for listings and typed loads. Inputs reused from the truck (inside L×W×H, payload, ₹/km), stops, chosen route (else straight line through stops, Approximate), existing cargo + plan. Checks in order payload · space (piece bigger than the inside → FAIL without packing; else the packer) · delivery order (corridor, direction, would-block) · cost (only what the load adds: extra km × ₹/km + tolls "not known yet" + handling + waiting). Decisions **ACCEPT · REJECT · NOT PROFITABLE · NEEDS REVIEW** (missing truck size / stops / load size / offer, or placement not established — never PASS). Batches: "40 cartons" = 40 boxes in the fit.
- **F19 Extra loads step** (slot `trip.steps` order 5): tiles Free floor · Weight left · Possible extra earning; route strip (km line, stops, an arc per load; tap ↔ card); load cards ACCEPT first by profit — decision chip, goods + from → to, size · kg, Profit big green, offer · cost, Payload / Space / Delivery order ✓, "Take it: ₹… extra after ₹… costs — … km detour" + Estimated, "More details" (offer, extra km, running, tolls, handling, waiting, total, expected extra earnings), shipper date; one lime "Add to trip" (best card), "See in truck" (3D / drawings, planned boxes faded, the new load pink); collapsed "Not suitable (n)" with decision + plain reason + checks; "Fit is by box size only — check loading safety and axle load." **"Enter a load"** sheet (batches with name, qty, L/W/H cm, kg each, orientation any / upright, fragile, don't stack; pickup, drop, offer ₹, optional handling ₹ / waiting ₹) → result card (decision first, checks, +₹ / −₹ earnings, money breakdown open).
- Space check = the same rule as Add to trip (re-pack all before loading, else fit around loaded boxes) and **nothing may drop out** — neither the new load nor cargo that fitted before.
- **Add to trip**: `trip_extra_loads` row (suggested, costs, profit) → `accept_extra_load(id, pickupAfterSeq, dropAfterSeq)` (stops reused within 2 km) → new plan (pack all / fit around loaded) → save next version + activate (`activate_load_plan`; `plan_unplaced` alert if needed) → toast "Added LD-1045 — space used 34% → 4x%" (+ "Stops changed — choose the route again" when a route was chosen). "This load was just taken — refreshing" on LISTING_NOT_OPEN / ALREADY_ACCEPTED.
- **F20 Loads** `/loads` (nav Loads, phone More): chips Open · Taken · All, cards "Kishangarh → Ahmedabad (Narol) · Marble tiles · 1,440 kg · ₹16,000 · Ready now", Demo / Public / Mine / Taken, "Find a trip for this load" (→ best planned trip's Extra loads step), remove my own open posts (confirm). `/loads/new`: shipper, phone, goods, from / to (hub list), L/W/H, kg each, qty, fragile, offer ₹, ready date → lime "Post for everyone" (public, code from `next_listing_code()`, toast "Posted as LD-2001").
- **Home**: quick button "Find extra loads" (`home.actions`) and widget "Extra earnings available" (`home.widgets`, Sample + Estimated, best profit on the next planned trip).
- Public API `extra-loads/index.ts`: `evaluateCandidates`, `evaluateLoad` (via lib), `listingPackItems`, `checkSpace`, `useExtraLoads`, `addToTrip`.
- Tests: 34 new, incl. 1 in load-planner (engine owner cases 1–8 + costs + decoys, candidates, space, fixture hook / Add to trip incl. loading started + taken meanwhile / screen + Hindi / Enter a load form / marketplace / schema / slots). `npm run check` 258 tests + `npm run build` pass, also without `.env`. Main bundle 133 KB gzip.

Demo (fixture, NH48 route chosen): ACCEPT LD-1041 Marble tiles ₹14,392 · LD-1045 Auto parts ₹12,507 · LD-1048 · LD-1046 · LD-1047 (+ LD-1044 when the route allows); REJECT LD-1049 342 km off route, LD-1050 goes the opposite way, LD-1051 too heavy (16 t > 12.4 t), LD-1042 / LD-1043 would block goods that leave earlier (picked up between Jaipur and Ahmedabad for a later drop); NOT PROFITABLE LD-1052.

How to demo (fixture mode): `npm run dev` → `http://localhost:5173/trips/00000000-0000-4000-8000-000000000031?step=route&fixture=seed` → Choose a route → tab "Extra loads" → cards → See in truck → Add to trip (toast 34% → …%) → Load plan tab shows the new plan in use → Not suitable (n) → Enter a load (e.g. 40 × 60×40×30 cm, 25 kg, Vadodara → Mumbai (Bhiwandi), ₹15,000 → Accept) → `/loads` → Post a load → Home widget. Tap हिंदी on every screen.

**Change outside my lane (owner-approved 2026-10-31):** `src/features/load-planner/engine/pack.ts` + `validate.ts` — a box only blocks another while both are on the truck (a box that leaves before a pickup can't block it). Without it a load picked up mid-trip (LD-1045 at Vadodara) was blocked by Jaipur / Ahmedabad boxes already unloaded. Demo plan unchanged (104 / 0, all engine tests pass, + 1 test).

CONTRACT CHANGE REQUEST — from 3·Git
File/contract: `company_settings.corridor_km` default (`supabase/spareway_database.sql` → new `supabase/sql/phase3code_corridor.sql`)   Change: default 20 → **40**, and `update company_settings set corridor_km = 40 where corridor_km = 20` for existing companies (owner's answer).
Why: the step reads the old default 20 as 40 meanwhile (`corridorKm()`); a company that really wants 20 km can't choose it until this lands. Owner to apply: Agent Code at merge.

Code must verify (Git only) — real database:
- [ ] TRP-2026-0031 → Route → Choose → step 5 "Extra loads": cards as above (ACCEPT first, decoys in Not suitable with REJECT / NOT PROFITABLE + reasons), Payload / Space / Delivery order ✓, one lime "Add to trip". Without a chosen route: "No route chosen yet — distances are approximate" + Approximate badges.
- [ ] See in truck → 3D: planned boxes faded, new load pink; low-data → drawings.
- [ ] Add to trip LD-1045 → toast "Added LD-1045 — space used 34% → …%". DB: `trip_extra_loads` row `accepted` with costs + profit; `trip_stops` Vadodara inserted (seq 3), Mumbai seq 4; `cargo_items` "Auto parts (LD-1045)" × 18 `extra_load`; `freight_listings` LD-1045 `accepted`; activity `extra_load_accepted` (Home line in Hindi via template); new `load_plans` version `active` with 122 placements, 122 `loading_progress` rows. Load plan tab shows it in use. Route step fetches new routes (stops changed); `trip_financials.extra_revenue_inr` = 14,000 after choosing the route again.
- [ ] Same load from a second company in another tab → "This load was just taken — refreshing".
- [ ] Loading started (Start loading + mark steps done via the loader page) → Add to trip keeps the loaded boxes at the same positions.
- [ ] Enter a load: 40 × 60×40×30 cm, 25 kg, Vadodara → Mumbai, ₹15,000 → Accept, +₹…; 4 × 4,000 kg → Reject (Payload); pickup Mumbai → drop Vadodara → Reject (Delivery order); offer ₹500 → Not profitable; truck without inside size (edit a truck) → Needs review.
- [ ] /loads: chips, Demo badges on the 12 sample loads; Post a load → "Posted as LD-2001"; second account sees it as Public and can Find a trip / add it; owner can Remove it (confirm).
- [ ] Home: "Find extra loads" button + "Extra earnings available" widget (Sample, Estimated).
- [ ] 375 px in Hindi: step, sheet, loads, post form — no sideways scroll (checked here in fixture mode).

Notes for the other agent:
- Trip page: the Extra loads step owns its lime button — keep NextStepCard off on this step (as on Load plan / Route). ✓ via `lib/stepState.ts` when the trip has an extra-load cargo row.
- The `city_entry` "(from–to)" meta note from Merge 2 is unchanged (2·Git); can be done in Phase 4 if wanted.
- Typed loads are checked only (not saved); to carry one on the trip, post it on /loads and add it from the Extra loads step.

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
