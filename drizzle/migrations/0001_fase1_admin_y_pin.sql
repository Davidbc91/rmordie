-- Fase 1 de seguridad: administrador por perfil, PIN protegido y límite de intentos.
--
-- 1) El administrador es el perfil guardado en video_admins (el perfil BC
--    original de David), no cualquier perfil que se llame "bc".
-- 2) El PIN y el borrado de un perfil solo se cambian con funciones que exigen
--    el PIN actual de ese perfil. Desde la web ya no se puede escribir
--    directamente en la tabla profiles (salvo crear un perfil nuevo).
-- 3) Tras 5 PIN incorrectos en 15 minutos, el perfil queda bloqueado 15 minutos.
--
-- No se modifica ningún dato de entrenamiento.

-- ---------------------------------------------------------------------------
-- 1. Administrador
-- ---------------------------------------------------------------------------

-- En producción la tabla puede no existir (no todas las migraciones antiguas
-- del repositorio se aplicaron): se crea si falta.
create table if not exists public.video_admins (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.video_admins enable row level security;
revoke all on public.video_admins from anon, authenticated;
grant all on public.video_admins to service_role;

-- Garantiza que el perfil BC original (el más antiguo) es administrador.
-- Si la tabla ya tiene un administrador, no se toca.
insert into public.video_admins (profile_id)
select p.id
from public.profiles p
where lower(trim(p.name)) = 'bc'
  and not exists (select 1 from public.video_admins)
order by p.created_at asc
limit 1
on conflict (profile_id) do nothing;

-- Ningún otro perfil puede crearse ni renombrarse con el nombre de un administrador.
create or replace function public.protect_admin_names()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.video_admins va
    join public.profiles p on p.id = va.profile_id
    where lower(trim(p.name)) = lower(trim(new.name))
      and p.id <> new.id
  ) then
    raise exception 'Ese nombre de perfil está reservado.' using errcode = '23505';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_admin_names on public.profiles;
create trigger profiles_protect_admin_names
before insert or update of name on public.profiles
for each row execute function public.protect_admin_names();

-- ---------------------------------------------------------------------------
-- 2. Límite de intentos de PIN
-- ---------------------------------------------------------------------------

create table if not exists public.pin_attempts (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  failed_count integer not null default 0,
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.pin_attempts enable row level security;
revoke all on public.pin_attempts from anon, authenticated;
grant all on public.pin_attempts to service_role;

-- Misma firma que antes, así la app y las funciones del servidor no cambian de llamada.
-- Devuelve true/false; si el perfil está bloqueado, lanza un error con los minutos que faltan.
create or replace function public.verify_profile_pin(_profile_id uuid, _pin_hash text)
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  attempt public.pin_attempts%rowtype;
  had_attempts boolean;
  ok boolean;
  next_count integer;
begin
  select * into attempt from public.pin_attempts where profile_id = _profile_id for update;
  had_attempts := found;

  if had_attempts and attempt.locked_until is not null and attempt.locked_until > now() then
    raise exception 'Demasiados intentos. Prueba de nuevo en % min.',
      greatest(1, ceil(extract(epoch from (attempt.locked_until - now())) / 60)::int)
      using errcode = 'P0001';
  end if;

  ok := exists (
    select 1 from public.profiles p
    where p.id = _profile_id and p.pin_hash = _pin_hash
  );

  if ok then
    delete from public.pin_attempts where profile_id = _profile_id;
  elsif exists (select 1 from public.profiles p where p.id = _profile_id) then
    if not had_attempts then
      insert into public.pin_attempts (profile_id, failed_count, updated_at)
      values (_profile_id, 1, now())
      on conflict (profile_id) do update
        set failed_count = public.pin_attempts.failed_count + 1, updated_at = now();
    else
      -- Los fallos antiguos (más de 15 min) no cuentan.
      next_count := case
        when attempt.updated_at < now() - interval '15 minutes' then 1
        else attempt.failed_count + 1
      end;
      update public.pin_attempts
        set failed_count = next_count,
            locked_until = case when next_count >= 5 then now() + interval '15 minutes' else null end,
            updated_at = now()
        where profile_id = _profile_id;
    end if;
  end if;

  return ok;
end;
$$;

revoke all on function public.verify_profile_pin(uuid, text) from public;
grant execute on function public.verify_profile_pin(uuid, text) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. Cambios de perfil solo con el PIN actual
-- ---------------------------------------------------------------------------

-- Desde la web solo se puede leer (sin pin_hash) y crear perfiles.
revoke update, delete on public.profiles from anon, authenticated;

-- Devuelve false si el PIN actual no es correcto (sin lanzar error, para que
-- el fallo cuente en el límite de intentos).
create or replace function public.change_profile_pin(
  _profile_id uuid,
  _current_pin_hash text,
  _new_pin_hash text
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if _new_pin_hash is null or _new_pin_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'El PIN nuevo no es válido.' using errcode = '22023';
  end if;
  if not public.verify_profile_pin(_profile_id, _current_pin_hash) then
    return false;
  end if;
  update public.profiles set pin_hash = _new_pin_hash where id = _profile_id;
  return true;
end;
$$;

revoke all on function public.change_profile_pin(uuid, text, text) from public;
grant execute on function public.change_profile_pin(uuid, text, text) to anon, authenticated;

create or replace function public.delete_own_profile(_profile_id uuid, _pin_hash text)
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if exists (select 1 from public.video_admins where profile_id = _profile_id) then
    raise exception 'El perfil administrador no se puede eliminar.' using errcode = '42501';
  end if;
  if not public.verify_profile_pin(_profile_id, _pin_hash) then
    return false;
  end if;
  -- Las tablas de datos del atleta borran en cascada al eliminar el perfil;
  -- estas tres se limpian explícitamente como hacía la app.
  delete from public.workout_results where user_id = _profile_id;
  delete from public.exercise_log where user_id = _profile_id;
  delete from public.app_settings where user_id = _profile_id;
  delete from public.profiles where id = _profile_id;
  return true;
end;
$$;

revoke all on function public.delete_own_profile(uuid, text) from public;
grant execute on function public.delete_own_profile(uuid, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Funciones antiguas que aceptan un PIN y la app ya no usa
-- ---------------------------------------------------------------------------
-- claim_profile y create_linked_profile existen en la base de datos pero no
-- están en las migraciones ni las llama la app. Como reciben un PIN, se les
-- retira el acceso desde la web para que no sirvan para probar PIN sin límite.
do $$
begin
  if to_regprocedure('public.claim_profile(uuid, text)') is not null then
    execute 'revoke execute on function public.claim_profile(uuid, text) from public, anon, authenticated';
  end if;
  if to_regprocedure('public.create_linked_profile(text, text)') is not null then
    execute 'revoke execute on function public.create_linked_profile(text, text) from public, anon, authenticated';
  end if;
end $$;