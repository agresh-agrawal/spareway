# Spareway

Fleet app for small Indian truck owners: plan trips, pack cargo in 3D, send the job to the loader and driver by link, pick truck routes, fill empty space with extra loads, and see what each trip earned. English and Hindi, light and dark, works on a phone.

**Live:** https://spareway.vercel.app

## What it does

- **Trucks and trips** — inside size and payload per truck; trips with stops, departure and driver.
- **Cargo** — type it, scan it with the camera (Gemini) or say it in Hindi. Every line is checked against physics, the truck and your past trips; impossible data is refused ("Data looks irrelevant"), unusual data needs a photo or a reason, and a weighbridge slip is the only measured weight. Full change history.
- **Load plan** — packing engine in a Web Worker: stop order (nothing that leaves later blocks something that leaves earlier), fragile / upright / no-stack rules, support under every box; 3D view, top and side drawings, loading order.
- **Loader link** (no login) — step-by-step loading on a phone, live progress for the owner, loader can add or fix items.
- **Routes** — three truck routes (OpenRouteService HGV) with fuel, tolls, driver cost, no-entry hours and delivery times.
- **Driver link** (no login) — next stop, navigation, "I reached" / "Delivered", costs and challans.
- **Extra loads** — market of open loads, fit check on weight / space / stop order, pick the best automatically; traders and shippers post loads by link.
- **Earnings and Misc** — net earnings per trip and fleet, challan risks and trip costs, trip history with CSV export, monthly email report.
- **Offline** — installable PWA; cargo adds and loader taps queue without internet.

## Tech

React 19, TypeScript, Vite, Tailwind CSS v4, Radix UI, React Router, TanStack Query, react-hook-form + zod, i18next, MapLibre (OpenFreeMap tiles), three.js / React Three Fiber, Recharts, Vitest.
Backend: Supabase (Postgres with row-level security per company, RPCs, triggers, Storage, Realtime, Edge Functions `route-plan`, `ai-cargo`, `monthly-report`, `notify-email`, `photo-cleanup`, pg_cron). Hosting: Vercel.

## Structure

```
src/app            router, slots, auth provider
src/components     ui (Radix), common (design system), shell
src/features/<id>  one folder per feature: api.ts, hooks.ts, components, pages, i18n/{en,hi}.json, module.tsx
src/lib            supabase client, i18n, format, units, geo, realtime, fixtures (sample data mode)
supabase/          spareway_database.sql (schema), sql/ (later changes), functions/ (Edge Functions)
data/              real POIs (tolls, weighbridges, dhabas …) and reference CSVs
docs/              spec PDFs, PROGRESS.md, DECISIONS.md
```

Features plug into the app only through their `module.tsx` (routes, nav, slots such as `home.widgets` or `trip.steps`).

## Run it

```bash
npm ci
npm run dev        # http://localhost:5173
```

`.env` holds only public values (Supabase URL, publishable key, map style). Open `http://localhost:5173/?fixture=seed` to try the whole app with sample data and no account (dev builds only).

```bash
npm run check      # typecheck + lint + tests
npm run build      # production build (PWA)
```

Database: run `supabase/spareway_database.sql`, then the files in `supabase/sql/` in name order. Edge Function secrets (`ORS_API_KEY`, `GEMINI_API_KEY`, `GEMINI_MODEL`, Brevo) are set in Supabase, never in the repo.
