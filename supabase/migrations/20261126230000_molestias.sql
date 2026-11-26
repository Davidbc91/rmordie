-- Lesiones y molestias: cada atleta apunta dónde le molesta y cuánto, hace un
-- seguimiento diario y puede cambiar movimientos de su entreno. Su entrenador
-- lo ve solo si el atleta le dio permiso (coach_access).
-- Requiere antes 20261126200000_panel_entrenador.sql y 20261126220000_avisos.sql.

create table if not exists public.injuries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  zone text not null check (zone in ('cuello','hombro','codo','muneca','lumbar','cadera','rodilla','tobillo')),
  side text not null default 'none' check (side in ('left','right','both','none')),
  level integer not null check (level between 1 and 5),
  started_on date not null default current_date,
  note text check (note is null or char_length(note) <= 300),
  status text not null default 'active' check (status in ('active','healed')),
  healed_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists injuries_user_idx on public.injuries (user_id, status);

create table if not exists public.injury_checkins (
  injury_id uuid not null references public.injuries(id) on delete cascade,
  day date not null,
  level integer not null check (level between 1 and 5),
  created_at timestamptz not null default now(),
  primary key (injury_id, day)
);

create table if not exists public.injury_swaps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  month_key text not null,
  week integer not null,
  day_key text not null,
  block_key text not null,
  original text not null check (char_length(original) <= 80),
  replacement text not null check (char_length(replacement) <= 120),
  created_at timestamptz not null default now(),
  unique (user_id, month_key, week, day_key, block_key, original)
);

alter table public.injuries enable row level security;
alter table public.injury_checkins enable row level security;
alter table public.injury_swaps enable row level security;
revoke all on public.injuries, public.injury_checkins, public.injury_swaps from anon, authenticated;
grant select, insert, update, delete on public.injuries, public.injury_checkins, public.injury_swaps to authenticated;
grant all on public.injuries, public.injury_checkins, public.injury_swaps to service_role;

drop policy if exists injuries_own on public.injuries;
create policy injuries_own on public.injuries for all to authenticated
  using (user_id = private.current_profile_id()) with check (user_id = private.current_profile_id());

drop policy if exists injury_checkins_own on public.injury_checkins;
create policy injury_checkins_own on public.injury_checkins for all to authenticated
  using (exists (select 1 from public.injuries i where i.id = injury_id and i.user_id = private.current_profile_id()))
  with check (exists (select 1 from public.injuries i where i.id = injury_id and i.user_id = private.current_profile_id()));

drop policy if exists injury_swaps_own on public.injury_swaps;
create policy injury_swaps_own on public.injury_swaps for all to authenticated
  using (user_id = private.current_profile_id()) with check (user_id = private.current_profile_id());

-- Para el entrenador: molestias activas (y curadas en los últimos 30 días),
-- seguimiento de 14 días y cambios de movimientos de 14 días. Solo con permiso.
create or replace function public.coach_athlete_injuries(p_athlete uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, private
as $$
begin
  if not private.coach_can_see(p_athlete) then
    raise exception 'Este atleta no comparte sus entrenos contigo';
  end if;
  return jsonb_build_object(
    'injuries', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id, 'zone', i.zone, 'side', i.side, 'level', i.level, 'started_on', i.started_on,
        'status', i.status, 'healed_on', i.healed_on,
        'checkins', coalesce((select jsonb_agg(jsonb_build_object('day', c.day, 'level', c.level) order by c.day)
                              from public.injury_checkins c where c.injury_id = i.id and c.day >= current_date - 14), '[]'::jsonb)
      ) order by i.status, i.level desc)
      from public.injuries i
      where i.user_id = p_athlete and (i.status = 'active' or i.healed_on >= current_date - 30)
    ), '[]'::jsonb),
    'swaps', coalesce((
      select jsonb_agg(jsonb_build_object('original', s.original, 'replacement', s.replacement, 'created_at', s.created_at) order by s.created_at desc)
      from public.injury_swaps s where s.user_id = p_athlete and s.created_at >= now() - interval '14 days'
    ), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.coach_athlete_injuries(uuid) from public, anon;
grant execute on function public.coach_athlete_injuries(uuid) to authenticated, service_role;

-- Aviso al entrenador cuando un atleta apunta una molestia fuerte (4 o 5)
alter table public.notification_preferences
  add column if not exists coach_injury_enabled boolean not null default true;
