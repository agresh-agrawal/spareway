-- Phase 3 (Merge 3) — change request from 3·Git: look 40 km off the route for extra loads (owner's answer).
-- Additive: new default + existing companies still on the old default 20.
alter table public.company_settings alter column corridor_km set default 40;
update public.company_settings set corridor_km = 40 where corridor_km = 20;
