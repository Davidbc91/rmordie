
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  pin_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX profiles_name_lower_idx ON public.profiles (lower(name));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO anon, authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles open" ON public.profiles FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.workout_results ADD COLUMN user_id uuid;
ALTER TABLE public.exercise_log   ADD COLUMN user_id uuid;
CREATE UNIQUE INDEX workout_results_user_slot_idx
  ON public.workout_results (user_id, month_key, week, day_key, block_key);

-- Rebuild app_settings as per-user (drop existing global row(s))
DROP TABLE public.app_settings;
CREATE TABLE public.app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  bar_weights jsonb NOT NULL DEFAULT '[10, 15, 20]'::jsonb,
  plate_weights jsonb NOT NULL DEFAULT '[20, 15, 10, 5, 2.5, 1.25]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_settings TO anon, authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings open" ON public.app_settings FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
