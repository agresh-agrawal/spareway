-- Privacy (roadmap item 15): an owner can delete their account from Settings. If they are the only person in the
-- company, the whole company goes with it (trucks, trips, loads, providers, notifications — all cascade).
-- The caller must pass the word DELETE. Additive file; applied with the Supabase MCP.

create or replace function public.delete_my_account(p_confirm text)
returns jsonb language plpgsql security definer set search_path = public, auth as $$
declare v_uid uuid := auth.uid(); v_company uuid; v_others int;
begin
  if v_uid is null then raise exception 'NOT_SIGNED_IN'; end if;
  if coalesce(p_confirm, '') <> 'DELETE' then return jsonb_build_object('error', 'BAD_ITEMS'); end if;
  select company_id into v_company from public.profiles where id = v_uid;
  select count(*) into v_others from public.profiles where company_id = v_company and id <> v_uid;
  delete from auth.users where id = v_uid;              -- profile cascades
  if v_others = 0 and v_company is not null then
    delete from public.companies where id = v_company;  -- everything of the company cascades
  end if;
  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.delete_my_account(text) from public, anon;
grant execute on function public.delete_my_account(text) to authenticated;
