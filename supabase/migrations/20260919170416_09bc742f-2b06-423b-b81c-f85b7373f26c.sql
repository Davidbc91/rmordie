-- 1) PLANNING: shared rows (user_id IS NULL) are strictly read-only for clients
DROP POLICY IF EXISTS planning_insert ON public.planning;
DROP POLICY IF EXISTS planning_update ON public.planning;
DROP POLICY IF EXISTS planning_delete ON public.planning;

CREATE POLICY planning_insert ON public.planning
  FOR INSERT TO anon, authenticated
  WITH CHECK (user_id IS NOT NULL AND private.is_data_owner(user_id));

CREATE POLICY planning_update ON public.planning
  FOR UPDATE TO anon, authenticated
  USING (user_id IS NOT NULL AND private.is_data_owner(user_id))
  WITH CHECK (user_id IS NOT NULL AND private.is_data_owner(user_id));

CREATE POLICY planning_delete ON public.planning
  FOR DELETE TO anon, authenticated
  USING (user_id IS NOT NULL AND private.is_data_owner(user_id));

-- planning_read stays: shared rows readable, private rows owner-only

-- 2) PROFILES: never expose pin_hash to clients
REVOKE SELECT ON public.profiles FROM anon, authenticated;
GRANT SELECT (id, name, created_at, auth_user_id) ON public.profiles TO anon, authenticated;
GRANT INSERT (id, name, pin_hash, created_at, auth_user_id) ON public.profiles TO anon, authenticated;
GRANT UPDATE (name, pin_hash, auth_user_id) ON public.profiles TO anon, authenticated;

-- PIN verification stays server-side (hash comparison inside the database)
CREATE OR REPLACE FUNCTION public.verify_profile_pin(_profile_id uuid, _pin_hash text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = _profile_id AND p.pin_hash = _pin_hash
  )
$$;

REVOKE ALL ON FUNCTION public.verify_profile_pin(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_profile_pin(uuid, text) TO anon, authenticated;