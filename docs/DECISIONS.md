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
