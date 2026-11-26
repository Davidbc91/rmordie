-- Enlaces corregidos a mano: «este texto del plan es este movimiento del diccionario».
-- Los lee cualquier miembro (para que todos vean bien enlazado su plan) y solo
-- el administrador los crea o borra.

create table if not exists public.movement_aliases (
  id uuid primary key default gen_random_uuid(),
  alias text not null,
  alias_norm text not null unique,
  movement_id text not null,
  created_by uuid,
  created_at timestamptz not null default now()
);

alter table public.movement_aliases enable row level security;

revoke all on table public.movement_aliases from anon;
grant select, insert, delete on table public.movement_aliases to authenticated;

drop policy if exists movement_aliases_member_read on public.movement_aliases;
create policy movement_aliases_member_read
  on public.movement_aliases
  for select
  to authenticated
  using (private.is_member());

drop policy if exists movement_aliases_admin_insert on public.movement_aliases;
create policy movement_aliases_admin_insert
  on public.movement_aliases
  for insert
  to authenticated
  with check (private.is_video_admin());

drop policy if exists movement_aliases_admin_delete on public.movement_aliases;
create policy movement_aliases_admin_delete
  on public.movement_aliases
  for delete
  to authenticated
  using (private.is_video_admin());
