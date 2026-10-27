-- Aviso de seguridad de Lovable: «Anyone can read every record» en
-- movement_videos y movement_video_reviews.
--
-- movement_videos: los vídeos del diccionario los ve cualquier miembro con
-- sesión (ya no hace falta lectura sin sesión: toda la app va tras el login).
-- movement_video_reviews: estado de revisión, notas y quién revisó. Solo lo
-- usa la pantalla de administración, así que solo lo lee el administrador.
-- Las escrituras siguen yendo por la función admin-video (clave de servicio).

create or replace function private.is_video_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.video_admins va
    where va.profile_id = private.current_profile_id()
  )
$$;
revoke all on function private.is_video_admin() from public;
grant execute on function private.is_video_admin() to authenticated, service_role;

-- Vídeos: solo miembros con sesión
drop policy if exists movement_videos_public_read on public.movement_videos;
drop policy if exists movement_videos_member_read on public.movement_videos;
create policy movement_videos_member_read
  on public.movement_videos
  for select
  to authenticated
  using (private.is_member());
revoke select on public.movement_videos from anon;
grant select on public.movement_videos to authenticated;

-- Revisiones: solo el administrador
drop policy if exists movement_video_reviews_public_read on public.movement_video_reviews;
drop policy if exists movement_video_reviews_admin_read on public.movement_video_reviews;
create policy movement_video_reviews_admin_read
  on public.movement_video_reviews
  for select
  to authenticated
  using (private.is_video_admin());
revoke select on public.movement_video_reviews from anon;
grant select on public.movement_video_reviews to authenticated;
