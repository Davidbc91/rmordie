-- Admin-managed movement videos
-- The app currently uses profile + PIN instead of Supabase Auth. Video writes therefore
-- go through the Edge Function, which validates the BC profile and its PIN server-side.

create table if not exists public.movement_videos (
  id uuid primary key default gen_random_uuid(),
  movement_id text not null unique,
  source_type text not null check (source_type in ('youtube','upload')),
  youtube_url text,
  storage_path text,
  title text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint movement_videos_source_check check (
    (source_type = 'youtube' and youtube_url is not null and storage_path is null)
    or
    (source_type = 'upload' and storage_path is not null and youtube_url is null)
  )
);

create index if not exists movement_videos_movement_idx
  on public.movement_videos (movement_id);

alter table public.movement_videos enable row level security;

drop policy if exists movement_videos_public_read on public.movement_videos;
create policy movement_videos_public_read
  on public.movement_videos
  for select
  to anon, authenticated
  using (true);

revoke insert, update, delete on public.movement_videos from anon, authenticated;
grant select on public.movement_videos to anon, authenticated;
grant all on public.movement_videos to service_role;

create table if not exists public.video_admins (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.video_admins enable row level security;

revoke all on public.video_admins from anon, authenticated;
grant all on public.video_admins to service_role;

-- Seed the single real administrator from the existing BC profile.
insert into public.video_admins (profile_id)
select p.id
from public.profiles p
where lower(trim(p.name)) = 'bc'
order by p.created_at asc
limit 1
on conflict (profile_id) do nothing;

create or replace function public.touch_movement_video_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists movement_videos_touch on public.movement_videos;
create trigger movement_videos_touch
before update on public.movement_videos
for each row execute function public.touch_movement_video_updated_at();

-- Public bucket: dictionary videos are intentionally public content.
-- Upload/delete are still handled by the protected Edge Function.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'movement-videos',
  'movement-videos',
  true,
  262144000,
  array['video/mp4','video/webm','video/quicktime']
)
on conflict (id) do update set
  public = true,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Do not expose direct client CRUD on storage objects. Public buckets already allow reads.
drop policy if exists movement_videos_storage_insert on storage.objects;
drop policy if exists movement_videos_storage_update on storage.objects;
drop policy if exists movement_videos_storage_delete on storage.objects;
