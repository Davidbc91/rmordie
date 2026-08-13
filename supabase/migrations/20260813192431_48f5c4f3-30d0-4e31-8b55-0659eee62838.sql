
CREATE TABLE public.athlete_profile (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  display_name text,
  avatar_url text,
  birth_date date,
  sex text,
  height_cm numeric,
  current_weight_kg numeric,
  target_weight_kg numeric,
  crossfit_start_date date,
  box_name text,
  level text,
  weekly_target integer DEFAULT 4,
  goals jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.athlete_profile TO anon, authenticated;
GRANT ALL ON public.athlete_profile TO service_role;
ALTER TABLE public.athlete_profile ENABLE ROW LEVEL SECURITY;
CREATE POLICY "athlete_profile open" ON public.athlete_profile FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE public.body_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  measured_on date NOT NULL DEFAULT CURRENT_DATE,
  weight_kg numeric,
  body_fat_pct numeric,
  muscle_mass_kg numeric,
  waist_cm numeric,
  chest_cm numeric,
  hip_cm numeric,
  arm_cm numeric,
  thigh_cm numeric,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.body_metrics TO anon, authenticated;
GRANT ALL ON public.body_metrics TO service_role;
ALTER TABLE public.body_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "body_metrics open" ON public.body_metrics FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX body_metrics_user_date_idx ON public.body_metrics (user_id, measured_on DESC);

CREATE TABLE public.wellness_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  logged_on date NOT NULL DEFAULT CURRENT_DATE,
  sleep_hours numeric,
  energy integer,
  fatigue integer,
  soreness integer,
  mood integer,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, logged_on)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wellness_logs TO anon, authenticated;
GRANT ALL ON public.wellness_logs TO service_role;
ALTER TABLE public.wellness_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wellness_logs open" ON public.wellness_logs FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE public.athlete_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  goal_type text NOT NULL DEFAULT 'weight',
  exercise text,
  start_value numeric,
  current_value numeric,
  target_value numeric NOT NULL,
  unit text DEFAULT 'kg',
  target_date date,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.athlete_goals TO anon, authenticated;
GRANT ALL ON public.athlete_goals TO service_role;
ALTER TABLE public.athlete_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "athlete_goals open" ON public.athlete_goals FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE public.milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  code text NOT NULL,
  label text NOT NULL,
  detail text,
  achieved_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.milestones TO anon, authenticated;
GRANT ALL ON public.milestones TO service_role;
ALTER TABLE public.milestones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "milestones open" ON public.milestones FOR ALL USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER athlete_profile_touch BEFORE UPDATE ON public.athlete_profile
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER athlete_goals_touch BEFORE UPDATE ON public.athlete_goals
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
