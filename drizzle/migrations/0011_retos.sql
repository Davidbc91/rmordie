-- Retos del mes: los crea el administrador; los atletas se apuntan (o él los elige)
-- y la clasificación se calcula en el servidor sin exponer los entrenos de nadie.

create table if not exists public.challenges (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  metric text not null check (metric in ('days', 'volume', 'prs', 'weeks')),
  goal numeric check (goal is null or goal > 0),
  starts_on date not null,
  ends_on date not null,
  open boolean not null default true,
  created_at timestamptz not null default now(),
  constraint challenges_dates check (ends_on >= starts_on)
);

create table if not exists public.challenge_participants (
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (challenge_id, profile_id)
);
create index if not exists challenge_participants_profile_idx on public.challenge_participants (profile_id);

alter table public.challenges enable row level security;
alter table public.challenge_participants enable row level security;

revoke all on public.challenges from anon, authenticated;
revoke all on public.challenge_participants from anon, authenticated;
grant select, insert, update, delete on public.challenges to authenticated;
grant select, insert, delete on public.challenge_participants to authenticated;

-- ¿Puede el perfil actual ver este reto? (abierto, suyo o participa)
create or replace function private.can_see_challenge(p_challenge uuid)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select exists (
    select 1 from public.challenges c
    where c.id = p_challenge
      and (
        c.open
        or c.owner_id = private.current_profile_id()
        or exists (
          select 1 from public.challenge_participants p
          where p.challenge_id = c.id and p.profile_id = private.current_profile_id()
        )
      )
  );
$$;
revoke all on function private.can_see_challenge(uuid) from public;
grant execute on function private.can_see_challenge(uuid) to authenticated, service_role;

-- Retos: todos ven los que pueden ver; solo el administrador crea, cambia y borra los suyos
drop policy if exists challenges_read on public.challenges;
create policy challenges_read on public.challenges
  for select to authenticated
  using (private.can_see_challenge(id));

drop policy if exists challenges_admin_write on public.challenges;
create policy challenges_admin_write on public.challenges
  for all to authenticated
  using (owner_id = private.current_profile_id() and private.is_video_admin())
  with check (owner_id = private.current_profile_id() and private.is_video_admin());

-- Participantes
drop policy if exists challenge_participants_read on public.challenge_participants;
create policy challenge_participants_read on public.challenge_participants
  for select to authenticated
  using (private.can_see_challenge(challenge_id));

-- Apuntarse uno mismo a un reto abierto
drop policy if exists challenge_participants_join on public.challenge_participants;
create policy challenge_participants_join on public.challenge_participants
  for insert to authenticated
  with check (
    profile_id = private.current_profile_id()
    and exists (select 1 from public.challenges c where c.id = challenge_id and c.open)
  );

-- El administrador apunta a quien elija en sus retos
drop policy if exists challenge_participants_owner_add on public.challenge_participants;
create policy challenge_participants_owner_add on public.challenge_participants
  for insert to authenticated
  with check (
    private.is_video_admin()
    and exists (select 1 from public.challenges c where c.id = challenge_id and c.owner_id = private.current_profile_id())
  );

-- Salir uno mismo, o el administrador quitar a alguien de su reto
drop policy if exists challenge_participants_leave on public.challenge_participants;
create policy challenge_participants_leave on public.challenge_participants
  for delete to authenticated
  using (
    profile_id = private.current_profile_id()
    or exists (select 1 from public.challenges c where c.id = challenge_id and c.owner_id = private.current_profile_id())
  );

-- Clasificación: solo nombre y número, calculado aquí para no exponer entrenos
create or replace function public.challenge_leaderboard(p_challenge uuid)
returns table (profile_id uuid, name text, score numeric)
language plpgsql
stable
security definer
set search_path = public, private
as $$
declare
  c public.challenges;
begin
  if not private.can_see_challenge(p_challenge) then
    raise exception 'No puedes ver este reto';
  end if;
  select * into c from public.challenges where id = p_challenge;

  return query
  with members as (
    select pp.profile_id as pid, pr.name as pname
    from public.challenge_participants pp
    join public.profiles pr on pr.id = pp.profile_id
    where pp.challenge_id = p_challenge
  ),
  done as (
    select r.user_id,
           coalesce(r.trained_on, (r.updated_at at time zone 'Europe/Madrid')::date) as d,
           r.weight, r.sets, r.reps
    from public.workout_results r
    where r.status = 'completed'
      and r.user_id in (select pid from members)
      and coalesce(r.trained_on, (r.updated_at at time zone 'Europe/Madrid')::date) between c.starts_on and c.ends_on
  ),
  scores as (
    select m.pid,
      case c.metric
        when 'days' then (select count(distinct d.d)::numeric from done d where d.user_id = m.pid)
        when 'volume' then (
          select coalesce(sum(d.weight * coalesce(d.sets, 1) * d.reps), 0)::numeric
          from done d where d.user_id = m.pid and d.weight > 0 and d.reps > 0
        )
        when 'prs' then (
          select count(*)::numeric from public.personal_record_history h
          where h.user_id = m.pid
            and (h.changed_at at time zone 'Europe/Madrid')::date between c.starts_on and c.ends_on
        )
        when 'weeks' then (
          select count(*)::numeric from (
            select date_trunc('week', d.d::timestamp) as wk, count(distinct d.d) as n
            from done d where d.user_id = m.pid
            group by 1
          ) w
          where w.n >= coalesce((select ap.weekly_target from public.athlete_profile ap where ap.user_id = m.pid limit 1), 4)
        )
      end as sc
    from members m
  )
  select m.pid, m.pname, round(coalesce(s.sc, 0), 1)
  from members m join scores s on s.pid = m.pid
  order by 3 desc, m.pname asc;
end;
$$;
revoke all on function public.challenge_leaderboard(uuid) from public, anon;
grant execute on function public.challenge_leaderboard(uuid) to authenticated, service_role;
