create table if not exists public.custom_movements (
  id text primary key,
  name text not null,
  name_es text not null default '',
  aliases text[] not null default '{}',
  category text not null,
  equipment text[] not null default '{}',
  level text not null default 'Intermediate' check (level in ('Beginner', 'Intermediate', 'Advanced')),
  rm boolean not null default false,
  description text not null default '',
  technique text[] not null default '{}',
  common_mistakes text[] not null default '{}',
  progressions text[] not null default '{}',
  regressions text[] not null default '{}',
  muscles text[] not null default '{}',
  video_url text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.custom_movements enable row level security;

grant select on table public.custom_movements to anon;
grant select on table public.custom_movements to authenticated;
revoke insert, update, delete, truncate on table public.custom_movements from anon, authenticated;

drop policy if exists "custom movements are publicly readable" on public.custom_movements;
create policy "custom movements are publicly readable"
  on public.custom_movements
  for select
  to anon, authenticated
  using (true);

create index if not exists custom_movements_name_idx on public.custom_movements (lower(name));
