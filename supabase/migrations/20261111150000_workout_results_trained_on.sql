-- Día real de entrenamiento: se fija al completar un bloque y no cambia al editarlo.
-- Así la racha, la constancia y el progreso no se mueven a "hoy" al retocar un entreno antiguo.
ALTER TABLE public.workout_results ADD COLUMN IF NOT EXISTS trained_on date;

-- Registros existentes: la mejor fecha disponible es la de su última edición
UPDATE public.workout_results
   SET trained_on = (updated_at AT TIME ZONE 'Europe/Madrid')::date
 WHERE trained_on IS NULL AND status = 'completed';

CREATE OR REPLACE FUNCTION public.workout_results_keep_trained_on()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.trained_on IS NOT NULL THEN
    NEW.trained_on := OLD.trained_on;
  ELSIF NEW.status = 'completed' AND NEW.trained_on IS NULL THEN
    NEW.trained_on := (now() AT TIME ZONE 'Europe/Madrid')::date;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS workout_results_keep_trained_on ON public.workout_results;
CREATE TRIGGER workout_results_keep_trained_on
  BEFORE INSERT OR UPDATE ON public.workout_results
  FOR EACH ROW EXECUTE FUNCTION public.workout_results_keep_trained_on();
