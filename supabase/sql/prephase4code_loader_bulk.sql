-- Loader page: mark several boxes at once ("all 12 cartons loaded", "this whole layer is loaded") instead of one
-- Done tap per box. Same checks as loader_update_step; status done / pending only (problems stay one at a time).

create or replace function public.loader_update_steps(p_token text, p_plan_id uuid, p_steps int[], p_status text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_trip uuid; v_company uuid; v_n int;
begin
  select trip_id, company_id into v_trip, v_company from public.loader_trip_for_token(p_token);
  if v_trip is null then return jsonb_build_object('error', 'LINK_INVALID'); end if;
  if p_status not in ('pending', 'done') then return jsonb_build_object('error', 'BAD_STATUS'); end if;
  if p_steps is null or cardinality(p_steps) = 0 or cardinality(p_steps) > 500 then
    return jsonb_build_object('error', 'BAD_ITEMS');
  end if;
  if not exists (select 1 from public.load_plans where id = p_plan_id and trip_id = v_trip and status = 'active') then
    return jsonb_build_object('error', 'PLAN_CHANGED');
  end if;

  update public.loading_progress set status = p_status, note = ''
   where load_plan_id = p_plan_id and step_index = any (p_steps);
  get diagnostics v_n = row_count;
  update public.trips set status = 'loading' where id = v_trip and status = 'planned';
  return jsonb_build_object('ok', true, 'count', v_n);
end;
$$;

revoke all on function public.loader_update_steps(text, uuid, int[], text) from public;
grant execute on function public.loader_update_steps(text, uuid, int[], text) to anon, authenticated;
