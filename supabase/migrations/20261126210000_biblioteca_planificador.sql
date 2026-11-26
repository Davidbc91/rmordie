-- Creador de planificaciones: biblioteca de bloques y plantillas de plan de
-- cada usuario, y los RM de un atleta para «Ver como» (solo con su permiso).
-- Requiere antes la migración 20261126200000_panel_entrenador.sql.

create table if not exists public.builder_library (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('block', 'plan')),
  title text not null check (char_length(title) between 1 and 80),
  payload jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists builder_library_owner_idx on public.builder_library (owner_id, created_at desc);

alter table public.builder_library enable row level security;
revoke all on public.builder_library from anon, authenticated;
grant select, insert, update, delete on public.builder_library to authenticated;

drop policy if exists builder_library_own on public.builder_library;
create policy builder_library_own on public.builder_library
  for all to authenticated
  using (owner_id = private.current_profile_id())
  with check (owner_id = private.current_profile_id());

-- RM de un atleta (solo si deja ver sus entrenos a su entrenador)
create or replace function public.coach_athlete_records(p_athlete uuid)
returns table (exercise text, rep_max integer, weight numeric)
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
  select r.exercise::text, r.rep_max::integer, r.weight::numeric
  from public.personal_records r
  where r.user_id = p_athlete;
end;
$$;
revoke all on function public.coach_athlete_records(uuid) from public, anon;
grant execute on function public.coach_athlete_records(uuid) to authenticated, service_role;
