/**
 * Subir una programación nueva (o una ampliación) sin perder nada de la anterior.
 *
 * Se trabaja por FECHAS: cada día de los dos planes queda con su fecha exacta y
 * se juntan así:
 *  - Los días del plan anterior que el nuevo no trae se quedan tal cual.
 *  - Si los dos traen el mismo día:
 *      · días ya pasados o ya registrados → se queda el anterior (lo que hiciste);
 *      · días de hoy en adelante sin registros → manda el nuevo.
 * Las claves de mes/semana/día del plan anterior no se tocan, así que tus
 * resultados siguen enganchados a su entreno.
 */
import type { Day, Month, Planning } from "./excel-parser";
import { isoKey } from "./plan-dates";
import { withExactDates } from "./plan-move";

const refKey = (m: string, w: number, d: string) => `${m}|${w}|${d}`;

type Located = { month: Month; week: number; day: Day };

function datedDays(p: Planning): Map<string, Located> {
  const out = new Map<string, Located>();
  for (const month of p.months)
    for (const w of month.weeks)
      for (const day of w.days) if (day.date && !out.has(day.date)) out.set(day.date, { month, week: w.index, day });
  return out;
}

function firstDate(m: Month): string {
  let min = "9999-99-99";
  for (const w of m.weeks) for (const d of w.days) if (d.date && d.date < min) min = d.date;
  return min;
}

export type MergeSummary = { added: number; replaced: number; keptPast: number; keptOld: number };

export function mergePlanningKeepingHistory(
  previous: Planning | null | undefined,
  incoming: Planning,
  /** Claves «mes|semana|día» que ya tienen resultados */
  resultKeys: Set<string>,
  today = isoKey(new Date()),
): { planning: Planning; summary: MergeSummary } {
  const summary: MergeSummary = { added: 0, replaced: 0, keptPast: 0, keptOld: 0 };
  if (!previous || previous.months.length === 0) {
    return { planning: { ...incoming }, summary: { ...summary, added: datedDays(withExactDates(incoming)).size } };
  }

  const merged = withExactDates(previous);
  delete merged.builder; // el planificador ya no puede editar un plan juntado
  const next = withExactDates(incoming);
  const oldByDate = datedDays(merged);

  const removeDay = (loc: Located) => {
    const w = loc.month.weeks.find((x) => x.index === loc.week);
    if (w) w.days = w.days.filter((d) => d !== loc.day);
  };

  for (const nm of next.months) {
    for (const nw of nm.weeks) {
      for (const nd of nw.days) {
        if (!nd.date) continue; // fuera del calendario: no se ve, no se añade
        const old = oldByDate.get(nd.date);
        if (old) {
          const trained = resultKeys.has(refKey(old.month.key, old.week, old.day.key));
          if (nd.date < today || trained) {
            summary.keptPast++;
            continue;
          }
          // Mismo sitio exacto (mismo mes, semana y día): se cambia el contenido en su sitio
          if (old.month.key === nm.key && old.week === nw.index && old.day.key === nd.key) {
            old.day.blocks = structuredClone(nd.blocks);
            old.day.isRest = nd.isRest;
            summary.replaced++;
            continue;
          }
          removeDay(old);
          summary.replaced++;
        } else {
          summary.added++;
        }

        // Insertar en su mes / semana (se crean si no existen)
        let month = merged.months.find((m) => m.key === nm.key);
        if (!month) {
          month = { key: nm.key, label: nm.label, order: 0, weeks: [] };
          merged.months.push(month);
        }
        let week = month.weeks.find((w) => w.index === nw.index);
        if (!week) {
          week = { index: nw.index, days: [] };
          month.weeks.push(week);
          month.weeks.sort((a, b) => a.index - b.index);
        }
        // Si ese hueco (día) ya lo ocupa otro día del plan anterior, clave única
        let key = nd.key;
        for (let n = 2; week.days.some((d) => d.key === key); n++) key = `${nd.key} ${n}`;
        const day: Day = { ...structuredClone(nd), key };
        week.days.push(day);
        oldByDate.set(nd.date, { month, week: week.index, day });
      }
    }
  }

  // Quitar semanas/meses que se hayan quedado vacíos y ordenar por fecha
  for (const m of merged.months) m.weeks = m.weeks.filter((w) => w.days.length > 0);
  merged.months = merged.months.filter((m) => m.weeks.length > 0);
  merged.months.sort((a, b) => firstDate(a).localeCompare(firstDate(b)));
  merged.months.forEach((m, i) => (m.order = i + 1));
  summary.keptOld = Math.max(0, datedDays(merged).size - summary.added - summary.replaced);
  merged.importedAt = incoming.importedAt ?? new Date().toISOString();
  return { planning: merged, summary };
}

/** Claves de los días que ya tienen algún resultado guardado. */
export function resultKeySet(results: Array<{ month_key: string; week: number; day_key: string }>): Set<string> {
  return new Set(results.map((r) => refKey(r.month_key, r.week, r.day_key)));
}

export function mergeMessage(s: MergeSummary): string {
  const parts = [];
  if (s.added) parts.push(`${s.added} días nuevos`);
  if (s.replaced) parts.push(`${s.replaced} actualizados`);
  if (s.keptOld + s.keptPast) parts.push(`${s.keptOld + s.keptPast} anteriores conservados`);
  return parts.join(" · ");
}
