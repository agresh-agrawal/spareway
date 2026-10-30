-- Phase 0·Code — fixes from the Supabase security advisor (additive, re-runnable).

-- 1. Fixed search_path on functions that had none.
alter function public.set_updated_at() set search_path = public;
alter function public.km_between(double precision, double precision, double precision, double precision) set search_path = public;
alter function public.next_trip_code() set search_path = public;
alter function public.next_listing_code() set search_path = public;
alter function public.activate_load_plan(uuid) set search_path = public;
alter function public.create_loader_link(uuid) set search_path = public, extensions;  -- gen_random_bytes lives in extensions
alter function public.disable_loader_link(uuid) set search_path = public;

-- 2. Owner-only SECURITY DEFINER functions: not callable without signing in.
--    (loader_get_job / loader_update_step / loader_add_cargo stay open to anon on purpose: the no-login loader link.)
revoke execute on function public.accept_extra_load(uuid, int, int) from public, anon;
revoke execute on function public.seed_sample_data() from public, anon;
revoke execute on function public.reset_sample_data() from public, anon;
revoke execute on function public.current_company_id() from public, anon;
grant execute on function public.accept_extra_load(uuid, int, int) to authenticated;
grant execute on function public.seed_sample_data() to authenticated;
grant execute on function public.reset_sample_data() to authenticated;
grant execute on function public.current_company_id() to authenticated;

-- 3. The signup trigger function is never called through the API (trigger privileges are checked at CREATE TRIGGER).
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- route_cache has RLS with no policies on purpose: only the route-plan Edge Function (service role) uses it.
