-- Notification bar (owner request): every major change shows in the app's bell and, for the important ones, goes
-- to the owner's email (one digest mail every 10 minutes at most, sent by the notify-email Edge Function).
-- Filled by triggers from alerts (loader / driver / provider reports) and from trip status changes.
-- Additive file; applied with the Supabase MCP.

create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null default public.current_company_id() references public.companies (id) on delete cascade,
  trip_id     uuid references public.trips (id) on delete cascade,
  kind        text not null,
  severity    text not null default 'info' check (severity in ('info', 'warning', 'critical')),
  major       boolean not null default false,          -- major = also emailed
  title       text not null,                            -- English fallback; the app shows tm(kind, meta)
  meta        jsonb not null default '{}'::jsonb,
  link        text not null default '',                 -- app path to open, e.g. /trips/<id>
  read_at     timestamptz,
  emailed_at  timestamptz,
  is_sample   boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists notifications_company_created_idx on public.notifications (company_id, created_at desc);
create index if not exists notifications_email_idx on public.notifications (created_at) where major and emailed_at is null;

alter table public.notifications enable row level security;
drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications for select to authenticated
  using (company_id = public.current_company_id());
drop policy if exists notifications_update on public.notifications;
create policy notifications_update on public.notifications for update to authenticated
  using (company_id = public.current_company_id()) with check (company_id = public.current_company_id());
grant select, update (read_at) on public.notifications to authenticated;

-- owner's choice: email me major changes (default on)
alter table public.profiles add column if not exists email_notify boolean not null default true;

-- alerts → notifications
create or replace function public._notify_from_alert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (company_id, trip_id, kind, severity, major, title, meta, link, is_sample)
  values (new.company_id, new.trip_id, new.kind, new.severity,
          new.severity in ('warning', 'critical') or new.kind in ('provider_load', 'offer_answer')
            or (new.kind = 'driver_stop' and new.meta ->> 'status' = 'done'),
          coalesce(nullif(new.message, ''), new.title), new.meta,
          case when new.trip_id is not null then '/trips/' || new.trip_id
               when new.kind in ('provider_load', 'offer_answer') then '/loads' else '' end,
          new.is_sample);
  return new;
end;
$$;
drop trigger if exists alerts_notify on public.alerts;
create trigger alerts_notify after insert on public.alerts for each row execute function public._notify_from_alert();

-- trip started / finished / cancelled → notifications
create or replace function public._notify_from_trip()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_kind text;
begin
  if new.status is not distinct from old.status then return new; end if;
  v_kind := case new.status when 'in_transit' then 'trip_started' when 'completed' then 'trip_done'
                            when 'cancelled' then 'trip_cancelled' else null end;
  if v_kind is null then return new; end if;
  insert into public.notifications (company_id, trip_id, kind, severity, major, title, meta, link, is_sample)
  values (new.company_id, new.id, v_kind, case when v_kind = 'trip_cancelled' then 'warning' else 'info' end,
          v_kind <> 'trip_started',
          new.code || ' ' || replace(v_kind, '_', ' '),
          jsonb_build_object('code', new.code), '/trips/' || new.id, new.is_sample);
  return new;
end;
$$;
drop trigger if exists trips_notify on public.trips;
create trigger trips_notify after update of status on public.trips for each row execute function public._notify_from_trip();

revoke all on function public._notify_from_alert() from public, anon, authenticated;
revoke all on function public._notify_from_trip() from public, anon, authenticated;

-- owner: mark all as read
create or replace function public.mark_notifications_read()
returns int language sql security invoker set search_path = public as $$
  with u as (
    update public.notifications set read_at = now()
     where company_id = public.current_company_id() and read_at is null returning 1
  ) select count(*)::int from u;
$$;
revoke all on function public.mark_notifications_read() from public, anon;
grant execute on function public.mark_notifications_read() to authenticated;

-- realtime for the bell
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'notifications') then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;

-- every 10 minutes: email the unsent major notifications (same Vault token as the monthly report)
select cron.unschedule(jobid) from cron.job where jobname = 'spareway-notify-email';
select cron.schedule(
  'spareway-notify-email',
  '*/10 * * * *',
  $cron$
  select net.http_post(
    url := 'https://darwxazznvfocihderma.supabase.co/functions/v1/notify-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-report-token', (select decrypted_secret from vault.decrypted_secrets where name = 'monthly_report_token')
    ),
    body := '{"mode":"cron"}'::jsonb,
    timeout_milliseconds := 60000
  )
  where exists (select 1 from public.notifications where major and emailed_at is null and not is_sample
                  and created_at > now() - interval '1 day');
  $cron$
);
