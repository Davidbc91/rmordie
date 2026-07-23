CREATE TABLE public.personal_record_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  exercise text NOT NULL,
  previous_weight numeric,
  new_weight numeric NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.personal_record_history TO anon, authenticated;
GRANT ALL ON public.personal_record_history TO service_role;

ALTER TABLE public.personal_record_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "history open" ON public.personal_record_history FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE INDEX idx_prh_user_exercise ON public.personal_record_history (user_id, exercise, changed_at DESC);

CREATE OR REPLACE FUNCTION public.log_personal_record_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.personal_record_history (user_id, exercise, previous_weight, new_weight)
    VALUES (NEW.user_id, NEW.exercise, NULL, NEW.weight);
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.weight IS DISTINCT FROM OLD.weight OR NEW.exercise IS DISTINCT FROM OLD.exercise THEN
      INSERT INTO public.personal_record_history (user_id, exercise, previous_weight, new_weight)
      VALUES (NEW.user_id, NEW.exercise, OLD.weight, NEW.weight);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_personal_record_change
AFTER INSERT OR UPDATE ON public.personal_records
FOR EACH ROW EXECUTE FUNCTION public.log_personal_record_change();