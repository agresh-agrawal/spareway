-- Demo trip delivery windows (owner, 2026-11-01). Additive file; applied with the Supabase MCP.
-- The old windows (Ahmedabad by +28 h, Mumbai by +46 h) could not be met by any route once the driver's rest stops
-- and city no-entry hours are counted, so every route showed "after the delivery time". New: Ahmedabad +26..46 h,
-- Mumbai +52..70 h. Same change in src/lib/fixtures/seed.ts.

-- 1. Seeding for new sample accounts: patch the two windows inside _seed_company (rest of the function unchanged).
do $$
declare d text;
begin
  d := pg_get_functiondef('public._seed_company(uuid)'::regprocedure);
  d := replace(d, 'dep + interval ''18 hours'', dep + interval ''28 hours''', 'dep + interval ''26 hours'', dep + interval ''46 hours''');
  d := replace(d, 'dep + interval ''34 hours'', dep + interval ''46 hours''', 'dep + interval ''52 hours'', dep + interval ''70 hours''');
  execute d;
end $$;

-- 2. Existing sample demo trips that still have the old windows.
update public.trip_stops s
set window_start = t.planned_departure + case s.seq when 2 then interval '26 hours' else interval '52 hours' end,
    window_end   = t.planned_departure + case s.seq when 2 then interval '46 hours' else interval '70 hours' end
from public.trips t
where t.id = s.trip_id and t.is_sample and t.code = 'TRP-2026-0031' and s.seq in (2, 3)
  and s.window_end = t.planned_departure + case s.seq when 2 then interval '28 hours' else interval '46 hours' end;
