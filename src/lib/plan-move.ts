// Mover días del plan en el calendario sin perder registros: se cambia la
// FECHA de cada día, nunca su mes, semana, día ni bloques (a eso van ligados
// los resultados).
import type { Planning } from "./excel-parser";
import { addDays, buildPlanDateIndex, isoKey, parseISODate } from "./plan-dates";

export type DayRef = { monthKey: string; week: number; dayKey: string };

const refKey = (r: DayRef) => `${r.monthKey}|${r.week}|${r.dayKey}`;

function eachDay(p: Planning, fn: (ref: DayRef, day: Planning["months"][number]["weeks"][number]["days"][number]) => void) {
  for (const m of p.months) for (const w of m.weeks) for (const d of w.days) fn({ monthKey: m.key, week: w.index, dayKey: d.key }, d);
}

/** Copia del plan con la fecha exacta puesta en todos los días que ya se ven en el calendario. */
export function withExactDates(p: Planning): Planning {
  const next = structuredClone(p) as Planning;
  const byRef = new Map<string, string>();
  for (const [iso, pd] of buildPlanDateIndex(p.months)) byRef.set(refKey({ monthKey: pd.month.key, week: pd.week, dayKey: pd.day.key }), iso);
  eachDay(next, (ref, d) => {
    const iso = byRef.get(refKey(ref));
    if (iso) d.date = iso;
  });
  // Planes del planificador: sus fechas también se mueven
  syncBuilder(next, new Map());
  return next;
}

function findByDate(p: Planning, iso: string) {
  let hit: { ref: DayRef; day: Planning["months"][number]["weeks"][number]["days"][number] } | null = null;
  eachDay(p, (ref, d) => {
    if (!hit && d.date === iso) hit = { ref, day: d };
  });
  return hit as { ref: DayRef; day: Planning["months"][number]["weeks"][number]["days"][number] } | null;
}

function findByRef(p: Planning, r: DayRef) {
  const m = p.months.find((x) => x.key === r.monthKey);
  return m?.weeks.find((x) => x.index === r.week)?.days.find((x) => x.key === r.dayKey) ?? null;
}

function syncBuilder(p: Planning, moved: Map<string, string>) {
  const b = p.builder as { v?: number; weeks?: { date: string }[][] } | undefined;
  if (!b || b.v !== 1 || !Array.isArray(b.weeks) || moved.size === 0) return;
  for (const wk of b.weeks) for (const d of wk) if (moved.has(d.date)) d.date = moved.get(d.date)!;
}

/**
 * Mueve un día a otra fecha. Si allí ya hay otro día del plan (entreno o
 * descanso), se intercambian.
 */
export function moveDay(p: Planning, from: DayRef, toIso: string): Planning {
  const next = withExactDates(p);
  const src = findByRef(next, from);
  if (!src?.date || src.date === toIso) return next;
  const oldIso = src.date;
  const other = findByDate(next, toIso);
  const moved = new Map<string, string>();
  if (other) {
    other.day.date = oldIso;
  }
  src.date = toIso;
  // Planificador: intercambia las dos fechas
  moved.set(oldIso, `__tmp__${toIso}`);
  moved.set(toIso, oldIso);
  syncBuilder(next, moved);
  syncBuilder(next, new Map([[`__tmp__${toIso}`, toIso]]));
  return next;
}

/** Desplaza días: todo el plan, o solo desde una fecha en adelante. */
export function shiftDays(p: Planning, days: number, fromIso?: string): Planning {
  const next = withExactDates(p);
  if (!days) return next;
  const moved = new Map<string, string>();
  eachDay(next, (_ref, d) => {
    if (!d.date || (fromIso && d.date < fromIso)) return;
    const dt = parseISODate(d.date);
    if (!dt) return;
    const iso = isoKey(addDays(dt, days));
    moved.set(d.date, iso);
    d.date = iso;
  });
  // El planificador recibe el mismo cambio (en dos pasos para no pisar fechas)
  const tmp = new Map<string, string>();
  const fin = new Map<string, string>();
  for (const [a, b] of moved) {
    tmp.set(a, `__tmp__${b}`);
    fin.set(`__tmp__${b}`, b);
  }
  syncBuilder(next, tmp);
  syncBuilder(next, fin);
  return next;
}

export function dayRefFor(p: Planning, iso: string): DayRef | null {
  const hit = buildPlanDateIndex(p.months).get(iso);
  return hit ? { monthKey: hit.month.key, week: hit.week, dayKey: hit.day.key } : null;
}
