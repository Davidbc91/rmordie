-- Fase 2 de seguridad (parte 1): login real y reglas por propietario.
--
-- Cada perfil queda vinculado a una cuenta de Supabase Auth (login con enlace
-- o código por correo). Las reglas de acceso de TODAS las tablas pasan a
-- depender del perfil vinculado a la sesión.
--
-- Importante: este archivo NO activa el aislamiento. Mientras el interruptor
-- security_config.owner_rls_enforced siga en false, todo se comporta como hoy.
-- Se activa en 20261009120100_fase2_activar_aislamiento.sql.
--
-- No se modifica ningún dato de entrenamiento.

-- ---------------------------------------------------------------------------
-- 0. Base: funciones de propiedad (se recrean por si producción no las tiene)
-- ---------------------------------------------------------------------------
create schema if not exists private;
grant usage on schema private to anon, authenticated, service_role;

create or replace function private.owner_rls_enforced()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select owner_rls_enforced from public.security_config limit 1), false)
$$;

create or replace function private.current_profile_id()
returns uuid language sql stable security definer set search_path = public as $$
  select p.id from public.profiles p where p.auth_user_id = auth.uid()
$$;

create or replace function private.is_data_owner(_owner uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when not private.owner_rls_enforced() then true
    else _owner is not null
         and auth.uid() is not null
         and _owner = private.current_profile_id()
  end
$$;

create or replace function private.is_shared_or_owner(_owner uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select _owner is null or private.is_data_owner(_owner)
$$;

revoke all on function private.owner_rls_enforced() from public;
revoke all on function private.current_profile_id() from public;
revoke all on function private.is_data_owner(uuid) from public;
revoke all on function private.is_shared_or_owner(uuid) from public;
grant execute on function private.owner_rls_enforced() to anon, authenticated, service_role;
grant execute on function private.current_profile_id() to anon, authenticated, service_role;
grant execute on function private.is_data_owner(uuid) to anon, authenticated, service_role;
grant execute on function private.is_shared_or_owner(uuid) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 1. Funciones de identidad
-- ---------------------------------------------------------------------------

-- Hay sesión de Supabase Auth (aunque aún no tenga perfil vinculado).
create or replace function private.is_signed_in()
returns boolean language sql stable security definer set search_path = public as $$
  select not private.owner_rls_enforced() or auth.uid() is not null
$$;

-- La sesión tiene un perfil vinculado (miembro de la app).
create or replace function private.is_member()
returns boolean language sql stable security definer set search_path = public as $$
  select not private.owner_rls_enforced() or private.current_profile_id() is not null
$$;

-- Moderador de la parte social: el administrador (video_admins) o un perfil
-- social marcado como administrador por el servidor.
create or replace function private.is_moderator()
returns boolean language sql stable security definer set search_path = public as $$
  select not private.owner_rls_enforced()
    or exists (select 1 from public.video_admins va where va.profile_id = private.current_profile_id())
    or exists (
      select 1 from public.social_profiles sp
      where sp.user_id = private.current_profile_id() and sp.is_admin
    )
$$;

revoke all on function private.is_signed_in() from public;
revoke all on function private.is_member() from public;
revoke all on function private.is_moderator() from public;
grant execute on function private.is_signed_in() to anon, authenticated, service_role;
grant execute on function private.is_member() to anon, authenticated, service_role;
grant execute on function private.is_moderator() to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Vincular la cuenta con un perfil existente o crear uno nuevo
-- ---------------------------------------------------------------------------

-- Vincula la cuenta de la sesión con un perfil existente, demostrando que es
-- suyo con el PIN (con límite de intentos). Devuelve false si el PIN falla.
create or replace function public.link_my_profile(_profile_id uuid, _pin_hash text)
returns boolean
language plpgsql volatile security definer set search_path = public as $$
declare
  owner_account uuid;
begin
  if auth.uid() is null then
    raise exception 'Inicia sesión primero.' using errcode = '42501';
  end if;
  if exists (select 1 from public.profiles where auth_user_id = auth.uid()) then
    raise exception 'Tu cuenta ya tiene un perfil vinculado.' using errcode = '23505';
  end if;
  select auth_user_id into owner_account from public.profiles where id = _profile_id;
  if not found then
    raise exception 'Ese perfil no existe.' using errcode = 'P0002';
  end if;
  if owner_account is not null then
    raise exception 'Ese perfil ya está vinculado a otra cuenta.' using errcode = '23505';
  end if;
  if not public.verify_profile_pin(_profile_id, _pin_hash) then
    return false;
  end if;
  update public.profiles set auth_user_id = auth.uid() where id = _profile_id;
  return true;
end;
$$;

-- Crea un perfil nuevo ya vinculado a la cuenta de la sesión.
create or replace function public.create_my_profile(_name text, _pin_hash text)
returns uuid
language plpgsql volatile security definer set search_path = public as $$
declare
  new_id uuid;
  clean_name text := btrim(coalesce(_name, ''));
begin
  if auth.uid() is null then
    raise exception 'Inicia sesión primero.' using errcode = '42501';
  end if;
  if exists (select 1 from public.profiles where auth_user_id = auth.uid()) then
    raise exception 'Tu cuenta ya tiene un perfil vinculado.' using errcode = '23505';
  end if;
  if char_length(clean_name) < 2 or char_length(clean_name) > 40 then
    raise exception 'El nombre debe tener entre 2 y 40 caracteres.' using errcode = '22023';
  end if;
  if exists (select 1 from public.profiles where lower(btrim(name)) = lower(clean_name)) then
    raise exception 'Ya existe un perfil con ese nombre.' using errcode = '23505';
  end if;
  if _pin_hash is null or _pin_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'El PIN no es válido.' using errcode = '22023';
  end if;
  insert into public.profiles (name, pin_hash, auth_user_id)
  values (clean_name, _pin_hash, auth.uid())
  returning id into new_id;
  return new_id;
end;
$$;

revoke all on function public.link_my_profile(uuid, text) from public;
revoke all on function public.create_my_profile(text, text) from public;
grant execute on function public.link_my_profile(uuid, text) to authenticated;
grant execute on function public.create_my_profile(text, text) to authenticated;

-- Los perfiles solo se crean con create_my_profile.
revoke insert on public.profiles from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2b. Punto de partida limpio: se quitan TODAS las reglas existentes de las
--     tablas de la app y se crean de nuevo. Así el resultado es el mismo sea
--     cual sea el estado previo de producción.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
  pol record;
begin
  foreach t in array array[
    'profiles','planning','chat_messages','push_subscriptions','notifications',
    'athlete_profile','athlete_goals','body_metrics','wellness_logs','milestones',
    'app_settings','workout_results','exercise_log','personal_records',
    'personal_record_history','wod_results','notification_preferences',
    'social_profiles','posts','post_media','post_likes','post_comments',
    'comment_likes','saved_posts','follows','reports','blocked_users'
  ] loop
    if to_regclass('public.' || t) is null then
      continue;
    end if;
    execute format('alter table public.%I enable row level security', t);
    for pol in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy %I on public.%I', pol.policyname, t);
    end loop;
  end loop;
end $$;

-- Datos personales: cada perfil solo lo suyo.
do $$
declare
  t text;
begin
  foreach t in array array[
    'athlete_profile','athlete_goals','body_metrics','wellness_logs','milestones',
    'app_settings','workout_results','exercise_log','personal_records',
    'personal_record_history','wod_results','notifications','notification_preferences'
  ] loop
    if to_regclass('public.' || t) is null then
      continue;
    end if;
    execute format('create policy %I on public.%I for select to anon, authenticated using (private.is_data_owner(user_id))', t || '_owner_select', t);
    execute format('create policy %I on public.%I for insert to anon, authenticated with check (private.is_data_owner(user_id))', t || '_owner_insert', t);
    execute format('create policy %I on public.%I for update to anon, authenticated using (private.is_data_owner(user_id)) with check (private.is_data_owner(user_id))', t || '_owner_update', t);
    execute format('create policy %I on public.%I for delete to anon, authenticated using (private.is_data_owner(user_id))', t || '_owner_delete', t);
  end loop;
end $$;

-- Planificación: la compartida (sin dueño) se lee; cada uno escribe la suya.
create policy planning_read on public.planning
  for select to anon, authenticated using (private.is_shared_or_owner(user_id));
create policy planning_insert on public.planning
  for insert to anon, authenticated with check (user_id is not null and private.is_data_owner(user_id));
create policy planning_update on public.planning
  for update to anon, authenticated
  using (user_id is not null and private.is_data_owner(user_id))
  with check (user_id is not null and private.is_data_owner(user_id));
create policy planning_delete on public.planning
  for delete to anon, authenticated using (user_id is not null and private.is_data_owner(user_id));

-- Chat de grupo: escribe y borra cada uno lo suyo.
create policy chat_insert on public.chat_messages
  for insert to anon, authenticated with check (private.is_data_owner(user_id));
create policy chat_update on public.chat_messages
  for update to anon, authenticated using (private.is_data_owner(user_id)) with check (private.is_data_owner(user_id));
create policy chat_delete on public.chat_messages
  for delete to anon, authenticated using (private.is_data_owner(user_id));

-- ---------------------------------------------------------------------------
-- 3. Lecturas compartidas: solo con sesión
-- ---------------------------------------------------------------------------

drop policy if exists profiles_read on public.profiles;
drop policy if exists profiles_insert on public.profiles;
drop policy if exists profiles_update on public.profiles;
drop policy if exists profiles_delete on public.profiles;
-- Con sesión se ven los nombres (para el chat y para elegir qué perfil vincular).
create policy profiles_read on public.profiles
  for select to anon, authenticated using (private.is_signed_in());

drop policy if exists chat_read on public.chat_messages;
create policy chat_read on public.chat_messages
  for select to anon, authenticated using (private.is_member());

-- Tablón público de PR: historial de quien lo publica en su perfil social.
drop policy if exists personal_record_history_public_board on public.personal_record_history;
create policy personal_record_history_public_board on public.personal_record_history
  for select to anon, authenticated
  using (
    private.is_member()
    and exists (
      select 1 from public.social_profiles sp
      where sp.user_id = personal_record_history.user_id
        and sp.show_prs and not sp.is_private
    )
  );

-- Notificaciones: cada uno ve las suyas, pero las crea quien actúa (un like
-- en tu post crea una notificación para ti).
drop policy if exists notifications_owner_insert on public.notifications;
create policy notifications_actor_insert on public.notifications
  for insert to anon, authenticated
  with check (private.is_data_owner(actor_id));

-- Suscripciones push: cada dispositivo es de su perfil. El servidor las lee
-- con la clave de servicio.
drop policy if exists "push subscriptions open" on public.push_subscriptions;
drop policy if exists push_subscriptions_owner on public.push_subscriptions;
create policy push_subscriptions_owner on public.push_subscriptions
  for all to anon, authenticated
  using (private.is_data_owner(user_id))
  with check (private.is_data_owner(user_id));

-- ---------------------------------------------------------------------------
-- 4. Parte social: leer con sesión, escribir solo lo propio
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'social_profiles','posts','post_media','post_likes','post_comments',
    'comment_likes','saved_posts','follows','reports','blocked_users'
  ] loop
    execute format('drop policy if exists %I on public.%I', t || ' open', t);
    execute format('drop policy if exists %I on public.%I', t || '_read', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete', t);
  end loop;
end $$;

-- Perfiles sociales
create policy social_profiles_read on public.social_profiles
  for select to anon, authenticated using (private.is_member());
create policy social_profiles_insert on public.social_profiles
  for insert to anon, authenticated with check (private.is_data_owner(user_id));
create policy social_profiles_update on public.social_profiles
  for update to anon, authenticated
  using (private.is_data_owner(user_id)) with check (private.is_data_owner(user_id));
create policy social_profiles_delete on public.social_profiles
  for delete to anon, authenticated using (private.is_data_owner(user_id));

-- Solo el servidor puede marcar a alguien como moderador.
create or replace function public.protect_social_admin_flag()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then
      new.is_admin := false;
    else
      new.is_admin := old.is_admin;
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists social_profiles_protect_admin on public.social_profiles;
create trigger social_profiles_protect_admin
before insert or update on public.social_profiles
for each row execute function public.protect_social_admin_flag();

-- Publicaciones (el moderador puede ocultarlas)
create policy posts_read on public.posts
  for select to anon, authenticated using (private.is_member());
create policy posts_insert on public.posts
  for insert to anon, authenticated with check (private.is_data_owner(user_id));
create policy posts_update on public.posts
  for update to anon, authenticated
  using (private.is_data_owner(user_id) or private.is_moderator())
  with check (private.is_data_owner(user_id) or private.is_moderator());
create policy posts_delete on public.posts
  for delete to anon, authenticated using (private.is_data_owner(user_id) or private.is_moderator());

-- En publicaciones ajenas, el moderador solo puede ocultar o mostrar.
-- Sin "security definer": necesita saber qué rol hace el cambio.
create or replace function public.limit_moderator_post_edits()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_user in ('anon', 'authenticated') and not private.is_data_owner(old.user_id) then
    new.user_id := old.user_id;
    new.kind := old.kind;
    new.caption := old.caption;
    new.data := old.data;
    new.hashtags := old.hashtags;
    new.visibility := old.visibility;
    new.likes_count := old.likes_count;
    new.comments_count := old.comments_count;
    new.saves_count := old.saves_count;
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;
drop trigger if exists posts_limit_moderator_edits on public.posts;
create trigger posts_limit_moderator_edits
before update on public.posts
for each row execute function public.limit_moderator_post_edits();

-- Fotos y vídeos de una publicación: los gestiona el autor de la publicación
create policy post_media_read on public.post_media
  for select to anon, authenticated using (private.is_member());
create policy post_media_insert on public.post_media
  for insert to anon, authenticated
  with check (exists (select 1 from public.posts p where p.id = post_id and private.is_data_owner(p.user_id)));
create policy post_media_update on public.post_media
  for update to anon, authenticated
  using (exists (select 1 from public.posts p where p.id = post_id and private.is_data_owner(p.user_id)))
  with check (exists (select 1 from public.posts p where p.id = post_id and private.is_data_owner(p.user_id)));
create policy post_media_delete on public.post_media
  for delete to anon, authenticated
  using (exists (select 1 from public.posts p where p.id = post_id and private.is_data_owner(p.user_id)));

-- Likes de publicaciones y de comentarios
create policy post_likes_read on public.post_likes
  for select to anon, authenticated using (private.is_member());
create policy post_likes_insert on public.post_likes
  for insert to anon, authenticated with check (private.is_data_owner(user_id));
create policy post_likes_delete on public.post_likes
  for delete to anon, authenticated using (private.is_data_owner(user_id));

create policy comment_likes_read on public.comment_likes
  for select to anon, authenticated using (private.is_member());
create policy comment_likes_insert on public.comment_likes
  for insert to anon, authenticated with check (private.is_data_owner(user_id));
create policy comment_likes_delete on public.comment_likes
  for delete to anon, authenticated using (private.is_data_owner(user_id));

-- Comentarios: los borra su autor, el autor de la publicación o el moderador
create policy post_comments_read on public.post_comments
  for select to anon, authenticated using (private.is_member());
create policy post_comments_insert on public.post_comments
  for insert to anon, authenticated with check (private.is_data_owner(user_id));
create policy post_comments_update on public.post_comments
  for update to anon, authenticated
  using (private.is_data_owner(user_id)) with check (private.is_data_owner(user_id));
create policy post_comments_delete on public.post_comments
  for delete to anon, authenticated
  using (
    private.is_data_owner(user_id)
    or private.is_moderator()
    or exists (select 1 from public.posts p where p.id = post_id and private.is_data_owner(p.user_id))
  );

-- Guardados: privados de cada uno
create policy saved_posts_read on public.saved_posts
  for select to anon, authenticated using (private.is_data_owner(user_id));
create policy saved_posts_insert on public.saved_posts
  for insert to anon, authenticated with check (private.is_data_owner(user_id));
create policy saved_posts_delete on public.saved_posts
  for delete to anon, authenticated using (private.is_data_owner(user_id));

-- Seguidores
create policy follows_read on public.follows
  for select to anon, authenticated using (private.is_member());
create policy follows_insert on public.follows
  for insert to anon, authenticated with check (private.is_data_owner(follower_id));
create policy follows_delete on public.follows
  for delete to anon, authenticated using (private.is_data_owner(follower_id));

-- Bloqueos: privados de cada uno
create policy blocked_users_read on public.blocked_users
  for select to anon, authenticated using (private.is_data_owner(blocker_id));
create policy blocked_users_insert on public.blocked_users
  for insert to anon, authenticated with check (private.is_data_owner(blocker_id));
create policy blocked_users_delete on public.blocked_users
  for delete to anon, authenticated using (private.is_data_owner(blocker_id));

-- Denuncias: las crea cualquiera con perfil; las gestiona el moderador
create policy reports_read on public.reports
  for select to anon, authenticated using (private.is_data_owner(reporter_id) or private.is_moderator());
create policy reports_insert on public.reports
  for insert to anon, authenticated with check (private.is_data_owner(reporter_id));
create policy reports_update on public.reports
  for update to anon, authenticated using (private.is_moderator()) with check (private.is_moderator());
create policy reports_delete on public.reports
  for delete to anon, authenticated using (private.is_moderator());

-- Los contadores (likes, comentarios, guardados) se actualizan en
-- publicaciones de otros: el disparador necesita permisos propios.
do $$
begin
  if to_regprocedure('public.sync_post_counters()') is not null then
    alter function public.sync_post_counters() security definer;
    alter function public.sync_post_counters() set search_path = public;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 5. Almacén de fotos sociales: cada uno sube y borra en su carpeta
-- ---------------------------------------------------------------------------
do $$
declare
  pol record;
begin
  for pol in
    select policyname from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and (coalesce(qual, '') like '%''social''%' or coalesce(with_check, '') like '%''social''%')
  loop
    execute format('drop policy %I on storage.objects', pol.policyname);
  end loop;
end $$;
drop policy if exists "social media read" on storage.objects;
drop policy if exists "social media insert" on storage.objects;
drop policy if exists "social media update" on storage.objects;
drop policy if exists "social media delete" on storage.objects;

create policy "social media read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'social' and private.is_member());
create policy "social media insert" on storage.objects
  for insert to anon, authenticated
  with check (
    bucket_id = 'social'
    and (
      not private.owner_rls_enforced()
      or (storage.foldername(name))[1] = private.current_profile_id()::text
    )
  );
create policy "social media update" on storage.objects
  for update to anon, authenticated
  using (
    bucket_id = 'social'
    and (
      not private.owner_rls_enforced()
      or (storage.foldername(name))[1] = private.current_profile_id()::text
    )
  );
create policy "social media delete" on storage.objects
  for delete to anon, authenticated
  using (
    bucket_id = 'social'
    and (
      not private.owner_rls_enforced()
      or (storage.foldername(name))[1] = private.current_profile_id()::text
    )
  );
