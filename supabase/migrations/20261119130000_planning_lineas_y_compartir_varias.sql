-- Varias planificaciones por persona y compartir cada una por separado.
--
-- plan_key identifica una planificación a lo largo de sus versiones: cada vez
-- que se guarda una versión nueva hereda el plan_key de la que se estaba
-- usando. El atleta al que se le comparte un plan_key ve siempre su última
-- versión. Esta migración sirve tanto si ya se aplicó la de planning_shares
-- (20261119120000) como si no.

-- 1) Línea de cada planificación
alter table public.planning add column if not exists plan_key uuid;

-- Las versiones que ya existen de cada persona son una misma planificación
update public.planning p
   set plan_key = first.id
  from (
    select distinct on (user_id) user_id, id
      from public.planning
     where user_id is not null
     order by user_id, imported_at asc
  ) first
 where p.user_id = first.user_id and p.plan_key is null;
update public.planning set plan_key = id where plan_key is null;

create index if not exists planning_plan_key_idx on public.planning (plan_key, imported_at desc);

-- Al guardar sin indicar la planificación, se hereda la de la versión más reciente
create or replace function public.planning_inherit_plan_key()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.plan_key is null then
    select p.plan_key into new.plan_key
      from public.planning p
     where p.user_id is not distinct from new.user_id
       and p.plan_key is not null
     order by p.imported_at desc
     limit 1;
    if new.plan_key is null then
      new.plan_key := new.id;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists planning_inherit_plan_key on public.planning;
create trigger planning_inherit_plan_key
  before insert on public.planning
  for each row execute function public.planning_inherit_plan_key();

-- 2) Compartir por planificación
create table if not exists public.planning_shares (
  owner_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  follow boolean not null default true,
  created_at timestamptz not null default now(),
  constraint planning_shares_not_self check (owner_id <> recipient_id)
);
alter table public.planning_shares add column if not exists plan_key uuid;

-- Compartidos de antes (sin plan_key): la planificación activa del dueño
update public.planning_shares s
   set plan_key = (
     select p.plan_key from public.planning p
      where p.user_id = s.owner_id
      order by p.is_active desc, p.imported_at desc
      limit 1)
 where s.plan_key is null;
delete from public.planning_shares where plan_key is null;
alter table public.planning_shares alter column plan_key set not null;

alter table public.planning_shares drop constraint if exists planning_shares_pkey;
alter table public.planning_shares add constraint planning_shares_pkey primary key (plan_key, recipient_id);
create index if not exists planning_shares_recipient_idx on public.planning_shares (recipient_id);

alter table public.planning_shares enable row level security;
revoke all on public.planning_shares from anon, authenticated;
grant select, insert, delete on public.planning_shares to authenticated;
grant update (follow) on public.planning_shares to authenticated;

-- ¿Es mía esa planificación?
create or replace function private.owns_plan_key(_plan_key uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.planning p
     where p.plan_key = _plan_key
       and p.user_id = private.current_profile_id()
  )
$$;
revoke all on function private.owns_plan_key(uuid) from public;
grant execute on function private.owns_plan_key(uuid) to authenticated, service_role;

-- Solo el administrador comparte, y solo planificaciones suyas
drop policy if exists planning_shares_owner_all on public.planning_shares;
create policy planning_shares_owner_all on public.planning_shares
  for all to authenticated
  using (owner_id = private.current_profile_id() and private.is_video_admin())
  with check (
    owner_id = private.current_profile_id()
    and private.is_video_admin()
    and private.owns_plan_key(plan_key)
  );

drop policy if exists planning_shares_recipient_read on public.planning_shares;
create policy planning_shares_recipient_read on public.planning_shares
  for select to authenticated
  using (recipient_id = private.current_profile_id());

drop policy if exists planning_shares_recipient_follow on public.planning_shares;
create policy planning_shares_recipient_follow on public.planning_shares
  for update to authenticated
  using (recipient_id = private.current_profile_id())
  with check (recipient_id = private.current_profile_id());

-- 3) Los atletas elegidos leen las versiones de esa planificación
drop policy if exists planning_read_shared_with_me on public.planning;
create policy planning_read_shared_with_me on public.planning
  for select to authenticated
  using (
    exists (
      select 1 from public.planning_shares s
       where s.plan_key = planning.plan_key
         and s.owner_id = planning.user_id
         and s.recipient_id = private.current_profile_id()
    )
  );
