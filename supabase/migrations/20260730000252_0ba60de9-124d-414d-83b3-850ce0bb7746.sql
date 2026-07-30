ALTER TABLE public.personal_records ADD COLUMN IF NOT EXISTS rep_max integer NOT NULL DEFAULT 1;
ALTER TABLE public.personal_record_history ADD COLUMN IF NOT EXISTS rep_max integer NOT NULL DEFAULT 1;

DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.personal_records'::regclass AND contype = 'u'
  LOOP
    EXECUTE format('ALTER TABLE public.personal_records DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS personal_records_user_exercise_repmax_key
  ON public.personal_records (user_id, exercise, rep_max);

CREATE OR REPLACE FUNCTION public.log_personal_record_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.personal_record_history (user_id, exercise, previous_weight, new_weight, rep_max)
    VALUES (NEW.user_id, NEW.exercise, NULL, NEW.weight, NEW.rep_max);
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.weight IS DISTINCT FROM OLD.weight OR NEW.exercise IS DISTINCT FROM OLD.exercise THEN
      INSERT INTO public.personal_record_history (user_id, exercise, previous_weight, new_weight, rep_max)
      VALUES (NEW.user_id, NEW.exercise, OLD.weight, NEW.weight, NEW.rep_max);
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;