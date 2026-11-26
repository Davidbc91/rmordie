-- Avisos: más tipos de notificación, cada uno con su interruptor, horas de
-- silencio y un registro para no repetir avisos. Lo envía la misma tarea
-- programada de cada 15 minutos (/api/cron/reminders).

alter table public.notification_preferences
  add column if not exists round_enabled boolean not null default true,
  add column if not exists challenges_enabled boolean not null default true,
  add column if not exists chat_enabled boolean not null default true,
  add column if not exists comments_enabled boolean not null default true,
  add column if not exists plan_enabled boolean not null default true,
  add column if not exists coach_prs_enabled boolean not null default true,
  add column if not exists coach_idle_enabled boolean not null default true,
  add column if not exists coach_weekly_enabled boolean not null default true,
  add column if not exists quiet_start text not null default '22:00',
  add column if not exists quiet_end text not null default '08:00';

alter table public.notification_preferences drop constraint if exists notification_preferences_quiet_start_check;
alter table public.notification_preferences add constraint notification_preferences_quiet_start_check check (quiet_start ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
alter table public.notification_preferences drop constraint if exists notification_preferences_quiet_end_check;
alter table public.notification_preferences add constraint notification_preferences_quiet_end_check check (quiet_end ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');

-- Registro de avisos enviados (solo el servidor lo usa)
create table if not exists public.notification_log (
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null,
  ref text not null,
  sent_at timestamptz not null default now(),
  primary key (user_id, kind, ref)
);
alter table public.notification_log enable row level security;
revoke all on public.notification_log from anon, authenticated;
grant all on public.notification_log to service_role;

-- Último puesto conocido de cada participante en cada reto (para «te han adelantado»)
create table if not exists public.challenge_rank_state (
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  rank integer not null,
  score numeric not null,
  updated_at timestamptz not null default now(),
  primary key (challenge_id, profile_id)
);
alter table public.challenge_rank_state enable row level security;
revoke all on public.challenge_rank_state from anon, authenticated;
grant all on public.challenge_rank_state to service_role;

-- Puntuación de un reto sin comprobar quién pregunta (solo para el servidor)
create or replace function private.challenge_scores(p_challenge uuid)
returns table (profile_id uuid, name text, score numeric)
language plpgsql
stable
security definer
set search_path = public, private
as $$
declare
  c public.challenges;
begin
  select * into c from public.challenges where id = p_challenge;
  if c.id is null then return; end if;

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
  select m.pid, m.pname::text, round(coalesce(s.sc, 0), 1)
  from members m join scores s on s.pid = m.pid
  order by 3 desc, m.pname asc;
end;
$$;
revoke all on function private.challenge_scores(uuid) from public, anon, authenticated;
grant execute on function private.challenge_scores(uuid) to service_role;

-- Acceso del servidor a la función (expuesta en public solo para service_role)
create or replace function public.challenge_scores_admin(p_challenge uuid)
returns table (profile_id uuid, name text, score numeric)
language sql
stable
security definer
set search_path = public, private
as $$ select * from private.challenge_scores(p_challenge); $$;
revoke all on function public.challenge_scores_admin(uuid) from public, anon, authenticated;
grant execute on function public.challenge_scores_admin(uuid) to service_role;
