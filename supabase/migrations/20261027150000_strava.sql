-- Conexión con Strava (fase 1 de datos del reloj): pulso y calorías de cada
-- entreno. Los tokens solo los maneja la función «strava» con la clave de
-- servicio y van cifrados; el usuario solo lee sus actividades.

-- Strava como proveedor en las tablas de integraciones ya existentes
alter table public.health_integrations drop constraint if exists health_integrations_provider_check;
alter table public.health_integrations add constraint health_integrations_provider_check
  check (provider in ('huawei_health','apple_health','health_connect','garmin','strava'));

alter table public.health_oauth_states drop constraint if exists health_oauth_states_provider_check;
alter table public.health_oauth_states add constraint health_oauth_states_provider_check
  check (provider in ('huawei_health','strava'));

-- Actividades del reloj (de Strava u otras fuentes en el futuro)
create table if not exists public.training_activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  source text not null default 'strava',
  external_id text not null,
  name text,
  sport_type text,
  start_at timestamptz not null,
  local_date date not null,
  duration_s integer,
  distance_m numeric,
  avg_hr numeric,
  max_hr numeric,
  calories numeric,
  created_at timestamptz not null default now(),
  unique (user_id, source, external_id)
);

create index if not exists training_activities_user_date_idx
  on public.training_activities (user_id, local_date desc);

alter table public.training_activities enable row level security;

drop policy if exists training_activities_owner_read on public.training_activities;
create policy training_activities_owner_read
  on public.training_activities
  for select
  to authenticated
  using (private.is_data_owner(user_id));

drop policy if exists training_activities_owner_delete on public.training_activities;
create policy training_activities_owner_delete
  on public.training_activities
  for delete
  to authenticated
  using (private.is_data_owner(user_id));

revoke all on public.training_activities from anon;
grant select, delete on public.training_activities to authenticated;
grant all on public.training_activities to service_role;
