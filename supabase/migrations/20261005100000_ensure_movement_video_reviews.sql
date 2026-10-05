create table if not exists public.movement_video_reviews (
  movement_id text primary key,
  status text not null default 'pending' check (status in ('pending','verified','needs_review')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  notes text,
  updated_at timestamptz not null default now()
);

alter table public.movement_video_reviews enable row level security;

drop policy if exists movement_video_reviews_public_read on public.movement_video_reviews;
create policy movement_video_reviews_public_read
  on public.movement_video_reviews
  for select
  to anon, authenticated
  using (true);

revoke insert, update, delete on public.movement_video_reviews from anon, authenticated;
grant select on public.movement_video_reviews to anon, authenticated;
grant all on public.movement_video_reviews to service_role;

create or replace function public.touch_movement_video_review_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists movement_video_reviews_touch on public.movement_video_reviews;
create trigger movement_video_reviews_touch
before update on public.movement_video_reviews
for each row execute function public.touch_movement_video_review_updated_at();
