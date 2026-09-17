CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.owner_rls_enforced()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT owner_rls_enforced FROM public.security_config WHERE id), false)
$$;

CREATE OR REPLACE FUNCTION private.current_profile_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id FROM public.profiles p WHERE p.auth_user_id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION private.is_data_owner(_owner uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN NOT private.owner_rls_enforced() THEN true
    ELSE _owner IS NOT NULL
         AND auth.uid() IS NOT NULL
         AND _owner = private.current_profile_id()
  END
$$;

CREATE OR REPLACE FUNCTION private.is_shared_or_owner(_owner uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _owner IS NULL OR private.is_data_owner(_owner)
$$;

REVOKE ALL ON FUNCTION private.owner_rls_enforced() FROM public;
REVOKE ALL ON FUNCTION private.current_profile_id() FROM public;
REVOKE ALL ON FUNCTION private.is_data_owner(uuid) FROM public;
REVOKE ALL ON FUNCTION private.is_shared_or_owner(uuid) FROM public;
GRANT EXECUTE ON FUNCTION private.owner_rls_enforced() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.current_profile_id() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_data_owner(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_shared_or_owner(uuid) TO anon, authenticated, service_role;

-- Recrear políticas apuntando a las funciones internas
DO $$
DECLARE
  t text;
  pol record;
  owned text[] := ARRAY[
    'athlete_profile','athlete_goals','body_metrics','wellness_logs',
    'milestones','app_settings','workout_results','exercise_log',
    'personal_records','personal_record_history','wod_results','notifications'
  ];
BEGIN
  FOREACH t IN ARRAY owned || ARRAY['planning','profiles','chat_messages'] LOOP
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, t);
    END LOOP;
  END LOOP;

  FOREACH t IN ARRAY owned LOOP
    EXECUTE format($f$
      CREATE POLICY %I ON public.%I FOR SELECT TO anon, authenticated
        USING (private.is_data_owner(user_id));
      CREATE POLICY %I ON public.%I FOR INSERT TO anon, authenticated
        WITH CHECK (private.is_data_owner(user_id));
      CREATE POLICY %I ON public.%I FOR UPDATE TO anon, authenticated
        USING (private.is_data_owner(user_id)) WITH CHECK (private.is_data_owner(user_id));
      CREATE POLICY %I ON public.%I FOR DELETE TO anon, authenticated
        USING (private.is_data_owner(user_id));
    $f$,
      t || '_owner_select', t,
      t || '_owner_insert', t,
      t || '_owner_update', t,
      t || '_owner_delete', t);
  END LOOP;
END $$;

CREATE POLICY planning_read ON public.planning FOR SELECT TO anon, authenticated
  USING (private.is_shared_or_owner(user_id));
CREATE POLICY planning_insert ON public.planning FOR INSERT TO anon, authenticated
  WITH CHECK (private.is_shared_or_owner(user_id));
CREATE POLICY planning_update ON public.planning FOR UPDATE TO anon, authenticated
  USING (private.is_shared_or_owner(user_id)) WITH CHECK (private.is_shared_or_owner(user_id));
CREATE POLICY planning_delete ON public.planning FOR DELETE TO anon, authenticated
  USING (private.is_data_owner(user_id));

CREATE POLICY profiles_read ON public.profiles FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY profiles_insert ON public.profiles FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY profiles_update ON public.profiles FOR UPDATE TO anon, authenticated
  USING (private.is_data_owner(id)) WITH CHECK (private.is_data_owner(id));
CREATE POLICY profiles_delete ON public.profiles FOR DELETE TO anon, authenticated
  USING (private.is_data_owner(id));

CREATE POLICY chat_read ON public.chat_messages FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY chat_insert ON public.chat_messages FOR INSERT TO anon, authenticated
  WITH CHECK (private.is_data_owner(user_id));
CREATE POLICY chat_update ON public.chat_messages FOR UPDATE TO anon, authenticated
  USING (private.is_data_owner(user_id)) WITH CHECK (private.is_data_owner(user_id));
CREATE POLICY chat_delete ON public.chat_messages FOR DELETE TO anon, authenticated
  USING (private.is_data_owner(user_id));

DROP FUNCTION IF EXISTS public.is_shared_or_owner(uuid);
DROP FUNCTION IF EXISTS public.is_data_owner(uuid);
DROP FUNCTION IF EXISTS public.current_profile_id();
DROP FUNCTION IF EXISTS public.owner_rls_enforced();