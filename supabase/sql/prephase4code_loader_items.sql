-- Loader link (Pre-Phase 4): see, correct and remove the items this loader added (only rows added by a loader on
-- this link's trip). Additive file; applied with the Supabase MCP.
create or replace function public.loader_my_cargo(p_token text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_trip uuid; v_company uuid;
begin
  select trip_id, company_id into v_trip, v_company from public.loader_trip_for_token(p_token);
  if v_trip is null then return jsonb_build_object('error', 'LINK_INVALID'); end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'label', c.label, 'lengthCm', c.length_cm, 'widthCm', c.width_cm,
            'heightCm', c.height_cm, 'weightKg', c.weight_kg, 'quantity', c.quantity, 'dropStopId', c.drop_stop_id,
            'fragile', c.fragile, 'uprightOnly', c.upright_only, 'stackable', c.stackable, 'source', c.source,
            'confidence', c.confidence) order by c.created_at)
          from public.cargo_items c where c.trip_id = v_trip and c.added_by_loader), '[]'::jsonb);
end;
$$;

create or replace function public.loader_update_cargo(p_token text, p_id uuid, p_item jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_trip uuid; v_company uuid;
begin
  select trip_id, company_id into v_trip, v_company from public.loader_trip_for_token(p_token);
  if v_trip is null then return jsonb_build_object('error', 'LINK_INVALID'); end if;
  if not exists (select 1 from public.trip_stops where id = (p_item ->> 'dropStopId')::uuid and trip_id = v_trip) then
    return jsonb_build_object('error', 'BAD_DROP_STOP');
  end if;
  update public.cargo_items set
    label = coalesce(nullif(p_item ->> 'label', ''), label),
    length_cm = (p_item ->> 'lengthCm')::numeric, width_cm = (p_item ->> 'widthCm')::numeric,
    height_cm = (p_item ->> 'heightCm')::numeric, weight_kg = (p_item ->> 'weightKg')::numeric,
    quantity = (p_item ->> 'quantity')::int, drop_stop_id = (p_item ->> 'dropStopId')::uuid,
    fragile = coalesce((p_item ->> 'fragile')::boolean, fragile),
    upright_only = coalesce((p_item ->> 'uprightOnly')::boolean, upright_only),
    stackable = coalesce((p_item ->> 'stackable')::boolean, stackable)
  where id = p_id and trip_id = v_trip and added_by_loader;
  if not found then return jsonb_build_object('error', 'BAD_ITEMS'); end if;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.loader_delete_cargo(p_token text, p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_trip uuid; v_company uuid;
begin
  select trip_id, company_id into v_trip, v_company from public.loader_trip_for_token(p_token);
  if v_trip is null then return jsonb_build_object('error', 'LINK_INVALID'); end if;
  delete from public.cargo_items where id = p_id and trip_id = v_trip and added_by_loader;
  if not found then return jsonb_build_object('error', 'BAD_ITEMS'); end if;
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.loader_my_cargo(text) from public;
revoke all on function public.loader_update_cargo(text, uuid, jsonb) from public;
revoke all on function public.loader_delete_cargo(text, uuid) from public;
grant execute on function public.loader_my_cargo(text) to anon, authenticated;
grant execute on function public.loader_update_cargo(text, uuid, jsonb) to anon, authenticated;
grant execute on function public.loader_delete_cargo(text, uuid) to anon, authenticated;
