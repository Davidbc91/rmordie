-- Recordatorio diario del entreno y resumen semanal por notificación push.
--
-- Cada perfil elige si quiere el recordatorio, a qué hora (en su zona horaria)
-- y si quiere el resumen del domingo. El servidor de la app revisa cada 15
-- minutos quién tiene un aviso pendiente y lo envía una sola vez al día.

create table if not exists public.notification_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  daily_enabled boolean not null default false,
  daily_time text not null default '08:00' check (daily_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  weekly_enabled boolean not null default false,
  timezone text not null default 'Europe/Madrid',
  last_daily_on date,
  last_weekly_on date,
  updated_at timestamptz not null default now()
);

alter table public.notification_preferences enable row level security;

-- Mismo criterio que el resto de datos personales: cada perfil gestiona lo suyo.
-- (Mientras el aislamiento por usuario esté desactivado, private.is_data_owner
-- devuelve true para todos; al activarlo, quedará restringido al dueño.)
drop policy if exists notification_preferences_select on public.notification_preferences;
drop policy if exists notification_preferences_insert on public.notification_preferences;
drop policy if exists notification_preferences_update on public.notification_preferences;
drop policy if exists notification_preferences_delete on public.notification_preferences;

create policy notification_preferences_select on public.notification_preferences
  for select to anon, authenticated using (private.is_data_owner(user_id));
create policy notification_preferences_insert on public.notification_preferences
  for insert to anon, authenticated with check (private.is_data_owner(user_id));
create policy notification_preferences_update on public.notification_preferences
  for update to anon, authenticated
  using (private.is_data_owner(user_id)) with check (private.is_data_owner(user_id));
create policy notification_preferences_delete on public.notification_preferences
  for delete to anon, authenticated using (private.is_data_owner(user_id));

grant select, insert, update, delete on public.notification_preferences to anon, authenticated;
grant all on public.notification_preferences to service_role;

-- Tarea programada: cada 15 minutos llama al servidor de la app, que decide
-- qué avisos tocan. Llamarlo de más no envía nada repetido (se anota el día
-- del último envío), así que el endpoint no necesita secreto.
create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'training-reminders') then
    perform cron.unschedule('training-reminders');
  end if;
end $$;

select cron.schedule(
  'training-reminders',
  '*/15 * * * *',
  $$
    select net.http_post(
      url := 'https://rmordie.lovable.app/api/cron/reminders',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := '{}'::jsonb
    );
  $$
);
