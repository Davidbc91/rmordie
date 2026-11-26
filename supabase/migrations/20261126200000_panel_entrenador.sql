-- Panel de entrenador: el atleta decide si su entrenador (quien le comparte
-- planificación) ve sus entrenos; el entrenador puede dejar comentarios.
-- Los datos se leen con funciones del servidor que comprueban el permiso,
-- sin abrir las tablas de resultados.

create table if not exists public.coach_access (
  coach_id uuid not null references public.profiles(id) on delete cascade,
  athlete_id uuid not null references public.profiles(id) on delete cascade,
  allowed boolean not null,
  decided_at timestamptz not null default now(),
  primary key (coach_id, athlete_id),
  constraint coach_access_not_self check (coach_id <> athlete_id)
);
create index if not exists coach_access_athlete_idx on public.coach_access (athlete_id);

alter table public.coach_access enable row level security;
revoke all on public.coach_access from anon, authenticated;
grant select, insert, update, delete on public.coach_access to authenticated;

-- El atleta gestiona sus permisos; el entrenador ve los que le afectan
drop policy if exists coach_access_athlete_all on public.coach_access;
create policy coach_access_athlete_all on public.coach_access
  for all to authenticated
  using (athlete_id = private.current_profile_id())
  with check (athlete_id = private.current_profile_id());

drop policy if exists coach_access_coach_read on public.coach_access;
create policy coach_access_coach_read on public.coach_access
  for select to authenticated
  using (coach_id = private.current_profile_id());

-- ¿Puede el perfil actual ver los entrenos de este atleta?
create or replace function private.coach_can_see(p_athlete uuid)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select private.is_video_admin()
     and exists (
       select 1 from public.coach_access a
       where a.coach_id = private.current_profile_id()
         and a.athlete_id = p_athlete
         and a.allowed
     );
$$;
revoke all on function private.coach_can_see(uuid) from public;
grant execute on function private.coach_can_see(uuid) to authenticated, service_role;

-- Comentarios del entrenador en un entreno del atleta
create table if not exists public.workout_comments (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles(id) on delete cascade,
  athlete_id uuid not null references public.profiles(id) on delete cascade,
  month_key text not null,
  week integer not null,
  day_key text not null,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists workout_comments_athlete_idx on public.workout_comments (athlete_id, created_at desc);

alter table public.workout_comments enable row level security;
revoke all on public.workout_comments from anon, authenticated;
grant select, insert, delete on public.workout_comments to authenticated;
grant update (read_at) on public.workout_comments to authenticated;

drop policy if exists workout_comments_read on public.workout_comments;
create policy workout_comments_read on public.workout_comments
  for select to authenticated
  using (coach_id = private.current_profile_id() or athlete_id = private.current_profile_id());

drop policy if exists workout_comments_coach_insert on public.workout_comments;
create policy workout_comments_coach_insert on public.workout_comments
  for insert to authenticated
  with check (coach_id = private.current_profile_id() and private.coach_can_see(athlete_id));

drop policy if exists workout_comments_coach_delete on public.workout_comments;
create policy workout_comments_coach_delete on public.workout_comments
  for delete to authenticated
  using (coach_id = private.current_profile_id());

drop policy if exists workout_comments_athlete_read_mark on public.workout_comments;
create policy workout_comments_athlete_read_mark on public.workout_comments
  for update to authenticated
  using (athlete_id = private.current_profile_id())
  with check (athlete_id = private.current_profile_id());

-- Atletas del entrenador: a quienes comparte planificación, con su permiso y resumen
create or replace function public.coach_athletes(p_from date, p_to date)
returns table (
  athlete_id uuid,
  name text,
  allowed boolean,
  decided boolean,
  plan_keys uuid[],
  trained_days date[],
  avg_rpe numeric,
  prs integer,
  last_trained date
)
language plpgsql
stable
security definer
set search_path = public, private
as $$
declare
  me uuid := private.current_profile_id();
begin
  if not private.is_video_admin() then
    raise exception 'Solo el administrador';
  end if;

  return query
  with ath as (
    select s.recipient_id as aid, array_agg(distinct s.plan_key) as keys
    from public.planning_shares s
    where s.owner_id = me
    group by s.recipient_id
  ),
  acc as (
    select a.athlete_id as aid, a.allowed as ok from public.coach_access a where a.coach_id = me
  ),
  res as (
    select r.user_id as aid,
           coalesce(r.trained_on, (r.updated_at at time zone 'Europe/Madrid')::date) as d,
           r.rpe
    from public.workout_results r
    where r.status = 'completed'
      and r.user_id in (select ath.aid from ath join acc on acc.aid = ath.aid and acc.ok)
  )
  select ath.aid,
         pr.name::text,
         coalesce(acc.ok, false),
         acc.aid is not null,
         ath.keys,
         case when coalesce(acc.ok, false) then (select array_agg(distinct res.d order by res.d) from res where res.aid = ath.aid and res.d between p_from and p_to) end,
         case when coalesce(acc.ok, false) then (select round(avg(res.rpe)::numeric, 1) from res where res.aid = ath.aid and res.d between p_from and p_to) end,
         case when coalesce(acc.ok, false) then (
           select count(*)::integer from public.personal_record_history h
           where h.user_id = ath.aid and (h.changed_at at time zone 'Europe/Madrid')::date between p_from and p_to
         ) end,
         case when coalesce(acc.ok, false) then (select max(res.d) from res where res.aid = ath.aid) end
  from ath
  join public.profiles pr on pr.id = ath.aid
  left join acc on acc.aid = ath.aid
  order by pr.name;
end;
$$;
revoke all on function public.coach_athletes(date, date) from public, anon;
grant execute on function public.coach_athletes(date, date) to authenticated, service_role;

-- Entrenos de un atleta (solo con su permiso)
create or replace function public.coach_athlete_results(p_athlete uuid, p_from date, p_to date)
returns table (
  month_key text, week integer, day_key text, block_key text, status text,
  weight numeric, sets integer, reps integer, time_seconds integer, rpe numeric,
  notes text, trained_on date, updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, private
as $$
begin
  if not private.coach_can_see(p_athlete) then
    raise exception 'Este atleta no comparte sus entrenos contigo';
  end if;
  return query
  select r.month_key::text, r.week::integer, r.day_key::text, r.block_key::text, r.status::text,
         r.weight::numeric, r.sets::integer, r.reps::integer, r.time_seconds::integer, r.rpe::numeric,
         r.notes::text, coalesce(r.trained_on, (r.updated_at at time zone 'Europe/Madrid')::date), r.updated_at
  from public.workout_results r
  where r.user_id = p_athlete
    and coalesce(r.trained_on, (r.updated_at at time zone 'Europe/Madrid')::date) between p_from and p_to
  order by 12 desc, r.block_key;
end;
$$;
revoke all on function public.coach_athlete_results(uuid, date, date) from public, anon;
grant execute on function public.coach_athlete_results(uuid, date, date) to authenticated, service_role;

-- Récords de un atleta (solo con su permiso)
create or replace function public.coach_athlete_prs(p_athlete uuid, p_limit integer default 10)
returns table (exercise text, rep_max integer, previous_weight numeric, new_weight numeric, changed_at timestamptz)
language plpgsql
stable
security definer
set search_path = public, private
as $$
begin
  if not private.coach_can_see(p_athlete) then
    raise exception 'Este atleta no comparte sus entrenos contigo';
  end if;
  return query
  select h.exercise::text, h.rep_max::integer, h.previous_weight::numeric, h.new_weight::numeric, h.changed_at
  from public.personal_record_history h
  where h.user_id = p_athlete
  order by h.changed_at desc
  limit greatest(1, least(p_limit, 50));
end;
$$;
revoke all on function public.coach_athlete_prs(uuid, integer) from public, anon;
grant execute on function public.coach_athlete_prs(uuid, integer) to authenticated, service_role;
