-- =====================================================================
-- RMORDIE: fase 1 de migración de identidad y seguridad de datos.
-- Preparación no destructiva: vínculo con auth.users, propietarios,
-- claves ajenas y políticas RLS basadas en propietario con interruptor.
-- =====================================================================

-- 1. Vínculo seguro entre Supabase Auth y public.profiles ---------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS auth_user_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_auth_user_id_key'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_auth_user_id_key UNIQUE (auth_user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_auth_user_id_fkey'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_auth_user_id_fkey
      FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 2. Interruptor de aplicación de RLS por propietario -------------------
CREATE TABLE IF NOT EXISTS public.security_config (
  id boolean PRIMARY KEY DEFAULT true,
  owner_rls_enforced boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT security_config_singleton CHECK (id)
);

GRANT SELECT ON public.security_config TO authenticated;
GRANT ALL ON public.security_config TO service_role;
ALTER TABLE public.security_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "security_config readable" ON public.security_config;
CREATE POLICY "security_config readable" ON public.security_config
  FOR SELECT TO authenticated USING (true);

INSERT INTO public.security_config (id, owner_rls_enforced)
VALUES (true, false)
ON CONFLICT (id) DO NOTHING;

-- 3. Funciones de identidad / propiedad ---------------------------------
CREATE OR REPLACE FUNCTION public.owner_rls_enforced()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT owner_rls_enforced FROM public.security_config WHERE id), false)
$$;

-- Perfil interno (profiles.id) del usuario autenticado.
CREATE OR REPLACE FUNCTION public.current_profile_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id FROM public.profiles p WHERE p.auth_user_id = auth.uid()
$$;

-- Propiedad estricta: el propietario del dato debe ser el perfil del
-- usuario autenticado. Mientras el interruptor está apagado se mantiene
-- el comportamiento actual para no romper la app en producción.
CREATE OR REPLACE FUNCTION public.is_data_owner(_owner uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN NOT public.owner_rls_enforced() THEN true
    ELSE _owner IS NOT NULL
         AND auth.uid() IS NOT NULL
         AND _owner = public.current_profile_id()
  END
$$;

-- Igual que is_data_owner pero acepta filas compartidas sin propietario
-- (planificación anual común, solo lectura).
CREATE OR REPLACE FUNCTION public.is_shared_or_owner(_owner uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _owner IS NULL OR public.is_data_owner(_owner)
$$;

-- 4. Propietario en planning (compartido si es NULL) --------------------
ALTER TABLE public.planning
  ADD COLUMN IF NOT EXISTS user_id uuid;

-- 5. Propietario obligatorio en registros de entrenamiento -------------
-- (verificado: 0 filas sin propietario en ambas tablas)
ALTER TABLE public.workout_results ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.exercise_log ALTER COLUMN user_id SET NOT NULL;

-- 6. Un único registro de ajustes por atleta ---------------------------
CREATE UNIQUE INDEX IF NOT EXISTS app_settings_user_id_key
  ON public.app_settings (user_id);

-- 7. Relaciones de propiedad con profiles ------------------------------
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'athlete_profile','athlete_goals','body_metrics','wellness_logs',
    'milestones','app_settings','planning','workout_results','exercise_log',
    'personal_records','personal_record_history','wod_results','notifications'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = t || '_user_id_profiles_fkey'
    ) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE',
        t, t || '_user_id_profiles_fkey'
      );
    END IF;
  END LOOP;
END $$;

-- 8. Políticas RLS por propietario -------------------------------------
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
  -- retirar todas las políticas abiertas existentes de las tablas privadas
  FOREACH t IN ARRAY owned || ARRAY['planning','profiles','chat_messages'] LOOP
    FOR pol IN
      SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, t);
    END LOOP;
  END LOOP;

  -- políticas de propietario para datos privados del atleta
  FOREACH t IN ARRAY owned LOOP
    EXECUTE format($f$
      CREATE POLICY %I ON public.%I FOR SELECT TO anon, authenticated
        USING (public.is_data_owner(user_id));
      CREATE POLICY %I ON public.%I FOR INSERT TO anon, authenticated
        WITH CHECK (public.is_data_owner(user_id));
      CREATE POLICY %I ON public.%I FOR UPDATE TO anon, authenticated
        USING (public.is_data_owner(user_id)) WITH CHECK (public.is_data_owner(user_id));
      CREATE POLICY %I ON public.%I FOR DELETE TO anon, authenticated
        USING (public.is_data_owner(user_id));
    $f$,
      t || '_owner_select', t,
      t || '_owner_insert', t,
      t || '_owner_update', t,
      t || '_owner_delete', t);
  END LOOP;
END $$;

-- planning: lectura compartida (filas sin propietario) + propiedad para escribir
CREATE POLICY planning_read ON public.planning FOR SELECT TO anon, authenticated
  USING (public.is_shared_or_owner(user_id));
CREATE POLICY planning_insert ON public.planning FOR INSERT TO anon, authenticated
  WITH CHECK (public.is_shared_or_owner(user_id));
CREATE POLICY planning_update ON public.planning FOR UPDATE TO anon, authenticated
  USING (public.is_shared_or_owner(user_id)) WITH CHECK (public.is_shared_or_owner(user_id));
CREATE POLICY planning_delete ON public.planning FOR DELETE TO anon, authenticated
  USING (public.is_data_owner(user_id));

-- profiles: lectura del listado para elegir perfil (solo datos de perfil),
-- y modificación restringida al propio perfil cuando el aislamiento esté activo
CREATE POLICY profiles_read ON public.profiles FOR SELECT TO anon, authenticated
  USING (true);
CREATE POLICY profiles_insert ON public.profiles FOR INSERT TO anon, authenticated
  WITH CHECK (true);
CREATE POLICY profiles_update ON public.profiles FOR UPDATE TO anon, authenticated
  USING (public.is_data_owner(id)) WITH CHECK (public.is_data_owner(id));
CREATE POLICY profiles_delete ON public.profiles FOR DELETE TO anon, authenticated
  USING (public.is_data_owner(id));

-- chat_messages: chat grupal (lectura común), autoría propia para escribir
CREATE POLICY chat_read ON public.chat_messages FOR SELECT TO anon, authenticated
  USING (true);
CREATE POLICY chat_insert ON public.chat_messages FOR INSERT TO anon, authenticated
  WITH CHECK (public.is_data_owner(user_id));
CREATE POLICY chat_update ON public.chat_messages FOR UPDATE TO anon, authenticated
  USING (public.is_data_owner(user_id)) WITH CHECK (public.is_data_owner(user_id));
CREATE POLICY chat_delete ON public.chat_messages FOR DELETE TO anon, authenticated
  USING (public.is_data_owner(user_id));

-- 9. Índices de propiedad para consultas filtradas por usuario ---------
CREATE INDEX IF NOT EXISTS workout_results_user_id_idx ON public.workout_results (user_id);
CREATE INDEX IF NOT EXISTS exercise_log_user_id_idx ON public.exercise_log (user_id);
CREATE INDEX IF NOT EXISTS personal_records_user_id_idx ON public.personal_records (user_id);
CREATE INDEX IF NOT EXISTS personal_record_history_user_id_idx ON public.personal_record_history (user_id);
CREATE INDEX IF NOT EXISTS wod_results_user_id_idx ON public.wod_results (user_id);
CREATE INDEX IF NOT EXISTS body_metrics_user_id_idx ON public.body_metrics (user_id);
CREATE INDEX IF NOT EXISTS wellness_logs_user_id_idx ON public.wellness_logs (user_id);
CREATE INDEX IF NOT EXISTS athlete_goals_user_id_idx ON public.athlete_goals (user_id);
CREATE INDEX IF NOT EXISTS milestones_user_id_idx ON public.milestones (user_id);
CREATE INDEX IF NOT EXISTS planning_user_id_idx ON public.planning (user_id);
