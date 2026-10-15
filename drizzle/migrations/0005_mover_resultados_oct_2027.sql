-- Entrenos guardados con el mes un año por delante («12. OCT 2027») cuando la
-- planificación activa del atleta ya usa la clave sin año («12. OCT»).
-- Solo afecta a atletas cuya planificación activa tiene esa clave sin año y
-- nunca pisa un resultado que ya exista con la clave nueva.

do $$
declare
  t text;
begin
  foreach t in array array['workout_results', 'wod_results', 'exercise_log'] loop
    execute format($f$
      update public.%1$I r
         set month_key = regexp_replace(r.month_key, '\s+2027$', '')
       where r.month_key ~ '^\d{1,2}\. [A-Z]+ 2027$'
         and exists (
           select 1
             from public.planning p,
                  jsonb_array_elements(p.data->'months') m
            where p.is_active
              and p.user_id = r.user_id
              and m->>'key' = regexp_replace(r.month_key, '\s+2027$', '')
         )
         %2$s
    $f$, t,
      case when t = 'workout_results' then
        $c$and not exists (
             select 1 from public.workout_results x
              where x.user_id = r.user_id
                and x.month_key = regexp_replace(r.month_key, '\s+2027$', '')
                and x.week = r.week and x.day_key = r.day_key and x.block_key = r.block_key)$c$
      else '' end);
  end loop;
end $$;