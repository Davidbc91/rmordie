-- Sigue a 20261027120000_videos_solo_miembros.sql: en producción las políticas
-- públicas antiguas tenían otros nombres («Public read movement videos» y
-- «Public read movement video reviews») y no se borraron. Las políticas se
-- suman, así que con sesión cualquiera seguía leyendo todo.
-- Se borran por su nombre real y, por si hubiera más con otros nombres,
-- cualquier otra política de esas dos tablas que no sea la nueva.

drop policy if exists "Public read movement videos" on public.movement_videos;
drop policy if exists "Public read movement video reviews" on public.movement_video_reviews;

do $$
declare
  p record;
begin
  for p in
    select tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and (
        (tablename = 'movement_videos' and policyname <> 'movement_videos_member_read')
        or (tablename = 'movement_video_reviews' and policyname <> 'movement_video_reviews_admin_read')
      )
  loop
    execute format('drop policy if exists %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;
