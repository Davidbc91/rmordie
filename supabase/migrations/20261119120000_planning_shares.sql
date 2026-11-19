-- Compartir la planificación del administrador con los atletas que él elija.
-- El atleta ve siempre la versión ACTIVA del plan del administrador (si este lo
-- cambia, le llegan los cambios) y puede dejar de seguirlo para usar el suyo.

create table if not exists public.planning_shares (
  owner_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  follow boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (owner_id, recipient_id),
  constraint planning_shares_not_self check (owner_id <> recipient_id)
);

create index if not exists planning_shares_recipient_idx on public.planning_shares (recipient_id);

alter table public.planning_shares enable row level security;

revoke all on public.planning_shares from anon, authenticated;
grant select, insert, delete on public.planning_shares to authenticated;
-- El atleta solo puede cambiar si lo sigue o no
grant update (follow) on public.planning_shares to authenticated;

-- El administrador gestiona a quién comparte su plan
drop policy if exists planning_shares_owner_all on public.planning_shares;
create policy planning_shares_owner_all on public.planning_shares
  for all to authenticated
  using (owner_id = private.current_profile_id() and private.is_video_admin())
  with check (owner_id = private.current_profile_id() and private.is_video_admin());

-- El atleta ve lo que le han compartido y decide si lo sigue
drop policy if exists planning_shares_recipient_read on public.planning_shares;
create policy planning_shares_recipient_read on public.planning_shares
  for select to authenticated
  using (recipient_id = private.current_profile_id());

drop policy if exists planning_shares_recipient_follow on public.planning_shares;
create policy planning_shares_recipient_follow on public.planning_shares
  for update to authenticated
  using (recipient_id = private.current_profile_id())
  with check (recipient_id = private.current_profile_id());

-- Los atletas elegidos pueden leer el plan ACTIVO del administrador
drop policy if exists planning_read_shared_with_me on public.planning;
create policy planning_read_shared_with_me on public.planning
  for select to authenticated
  using (
    is_active
    and exists (
      select 1 from public.planning_shares s
      where s.owner_id = planning.user_id
        and s.recipient_id = private.current_profile_id()
    )
  );
