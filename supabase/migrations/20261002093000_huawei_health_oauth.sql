alter table public.health_integrations
  add column if not exists provider_user_id text,
  add column if not exists access_token_ciphertext text,
  add column if not exists refresh_token_ciphertext text,
  add column if not exists token_expires_at timestamptz;

create table if not exists public.health_oauth_states (
  state text primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null check (provider = 'huawei_health'),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists health_oauth_states_profile_idx
  on public.health_oauth_states(profile_id);

alter table public.health_oauth_states enable row level security;
revoke all on public.health_oauth_states from anon, authenticated;
grant all on public.health_oauth_states to service_role;
