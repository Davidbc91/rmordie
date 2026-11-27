-- Panel de administrador: quién se está uniendo a la app.
-- Solo el administrador (video_admins) puede leerlo. Incluye el correo y el
-- último acceso de auth.users, que ningún otro usuario ve.

alter table public.notification_preferences
  add column if not exists admin_signups_enabled boolean not null default true;

create or replace function public.admin_users_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  result jsonb;
begin
  if not coalesce(private.is_video_admin(), false) then
    raise exception 'Solo el administrador puede ver este panel' using errcode = '42501';
  end if;

  with res as (
    select r.user_id as uid,
           coalesce(r.trained_on, (r.updated_at at time zone 'Europe/Madrid')::date) as d
    from public.workout_results r
    where r.status = 'completed'
  ),
  days as (
    select uid, count(distinct d) as trained_days, min(d) as first_trained, max(d) as last_trained,
           count(distinct d) filter (where d >= (now() at time zone 'Europe/Madrid')::date - 6) as days_7
    from res group by uid
  ),
  prs as (
    select user_id as uid, count(*) as prs from public.personal_records group by user_id
  ),
  plans as (
    select user_id as uid from public.planning where user_id is not null and is_active
    union
    select recipient_id from public.planning_shares where follow
  ),
  devs as (
    select user_id as uid, jsonb_agg(distinct coalesce(user_agent, '')) as agents
    from public.push_subscriptions group by user_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', p.id,
           'name', p.name,
           'created_at', p.created_at,
           'email', u.email,
           'last_sign_in_at', u.last_sign_in_at,
           'username', sp.username,
           'box_name', sp.box_name,
           'trained_days', coalesce(d.trained_days, 0),
           'days_7', coalesce(d.days_7, 0),
           'first_trained', d.first_trained,
           'last_trained', d.last_trained,
           'prs', coalesce(r.prs, 0),
           'has_plan', exists (select 1 from plans pl where pl.uid = p.id),
           'devices', coalesce(dv.agents, '[]'::jsonb)
         ) order by p.created_at desc), '[]'::jsonb)
    into result
  from public.profiles p
  left join auth.users u on u.id = p.auth_user_id
  left join public.social_profiles sp on sp.user_id = p.id
  left join days d on d.uid = p.id
  left join prs r on r.uid = p.id
  left join devs dv on dv.uid = p.id;

  return result;
end;
$$;

revoke all on function public.admin_users_overview() from public, anon;
grant execute on function public.admin_users_overview() to authenticated;
