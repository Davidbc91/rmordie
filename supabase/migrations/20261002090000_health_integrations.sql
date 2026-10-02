-- Health integrations foundation.
-- Provider tokens are intentionally not stored here. Native/SDK credentials must stay
-- outside the client and sensitive provider tokens should be handled server-side.

create table if not exists public.health_integrations (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null check (provider in ('huawei_health','apple_health','health_connect','garmin')),
  status text not null default 'disconnected' check (status in ('disconnected','connecting','connected','error')),
  last_sync_at timestamptz,
  scopes text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(profile_id, provider)
);

create index if not exists health_integrations_profile_idx
  on public.health_integrations(profile_id);

alter table public.health_integrations enable row level security;

-- The app currently uses profile + PIN rather than Supabase Auth.
-- Client CRUD is therefore not exposed. A future connector/Edge Function will
-- validate the active profile before mutating integration state.
revoke all on public.health_integrations from anon, authenticated;
grant all on public.health_integrations to service_role;

create table if not exists public.health_samples (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null check (provider in ('huawei_health','apple_health','health_connect','garmin')),
  sample_type text not null,
  recorded_at timestamptz not null,
  value numeric,
  unit text,
  source_id text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(profile_id, provider, sample_type, recorded_at, source_id)
);

create index if not exists health_samples_profile_time_idx
  on public.health_samples(profile_id, recorded_at desc);

create index if not exists health_samples_type_time_idx
  on public.health_samples(profile_id, sample_type, recorded_at desc);

alter table public.health_samples enable row level security;
revoke all on public.health_samples from anon, authenticated;
grant all on public.health_samples to service_role;

create or replace function public.touch_health_integration_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists health_integrations_touch on public.health_integrations;
create trigger health_integrations_touch
before update on public.health_integrations
for each row execute function public.touch_health_integration_updated_at();
