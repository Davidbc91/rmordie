
CREATE TABLE public.wod_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  wod_slug text NOT NULL,
  wod_name text NOT NULL,
  wod_type text NOT NULL DEFAULT 'for_time',
  scale text NOT NULL DEFAULT 'rx',
  status text NOT NULL DEFAULT 'completed',
  time_seconds integer,
  rounds numeric,
  reps numeric,
  weight numeric,
  distance numeric,
  calories numeric,
  rpe numeric,
  notes text,
  source text NOT NULL DEFAULT 'workout',
  month_key text,
  week integer,
  day_key text,
  block_key text,
  performed_on date NOT NULL DEFAULT CURRENT_DATE,
  is_pr boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wod_results TO anon, authenticated;
GRANT ALL ON public.wod_results TO service_role;

ALTER TABLE public.wod_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wod_results open" ON public.wod_results FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE UNIQUE INDEX wod_results_workout_slot_idx
  ON public.wod_results (user_id, month_key, week, day_key, block_key)
  WHERE source = 'workout';

CREATE INDEX wod_results_user_slug_idx ON public.wod_results (user_id, wod_slug, performed_on DESC);

CREATE TRIGGER wod_results_touch BEFORE UPDATE ON public.wod_results
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
