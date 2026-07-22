
-- Planificación (una sola fila activa)
CREATE TABLE public.planning (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version int NOT NULL DEFAULT 1,
  source_filename text,
  data jsonb NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  imported_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX planning_active_idx ON public.planning(is_active) WHERE is_active;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.planning TO anon, authenticated;
GRANT ALL ON public.planning TO service_role;
ALTER TABLE public.planning ENABLE ROW LEVEL SECURITY;
CREATE POLICY "planning open" ON public.planning FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Resultados por entrenamiento/bloque
CREATE TABLE public.workout_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month_key text NOT NULL,  -- ej "1. NOV"
  week int NOT NULL,        -- 1..N
  day_key text NOT NULL,    -- "LUNES", "MARTES", ...
  block_key text NOT NULL,  -- "A", "B", "ZONA MEDIA", ...
  status text NOT NULL DEFAULT 'completed', -- completed | not_done | modified
  weight numeric,
  sets int,
  reps int,
  time_seconds int,
  rpe numeric,
  scale text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(month_key, week, day_key, block_key)
);
CREATE INDEX workout_results_day_idx ON public.workout_results(month_key, week, day_key);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workout_results TO anon, authenticated;
GRANT ALL ON public.workout_results TO service_role;
ALTER TABLE public.workout_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "results open" ON public.workout_results FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Log por ejercicio (para PR e histórico)
CREATE TABLE public.exercise_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise text NOT NULL,
  weight numeric,
  reps int,
  time_seconds int,
  performed_on date NOT NULL DEFAULT CURRENT_DATE,
  month_key text,
  week int,
  day_key text,
  block_key text,
  notes text,
  is_pr boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX exercise_log_exercise_idx ON public.exercise_log(exercise);
CREATE INDEX exercise_log_date_idx ON public.exercise_log(performed_on DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exercise_log TO anon, authenticated;
GRANT ALL ON public.exercise_log TO service_role;
ALTER TABLE public.exercise_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "log open" ON public.exercise_log FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Ajustes (PIN, discos, barra)
CREATE TABLE public.app_settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  pin_hash text,
  bar_weights jsonb NOT NULL DEFAULT '[10, 15, 20]'::jsonb,
  plate_weights jsonb NOT NULL DEFAULT '[20, 15, 10, 5, 2.5, 1.25]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.app_settings (id) VALUES (1) ON CONFLICT DO NOTHING;
GRANT SELECT, INSERT, UPDATE ON public.app_settings TO anon, authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings open" ON public.app_settings FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
