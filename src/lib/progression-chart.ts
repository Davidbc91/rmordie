// Datos del gráfico de progresión: sesiones de un ejercicio, 1RM estimado
// y tendencia en lenguaje claro.
import type { Month } from "./excel-parser";
import type { PersonalRecordHistory, WorkoutResult } from "./store";
import { mentionsExercise, sameExercise } from "./rm-matcher";
import { resolveMovementId } from "./dictionary/resolve";

export type Session = {
  id: string;
  date: string;
  weight: number;
  sets: number | null;
  reps: number | null;
  rpe: number | null;
  /** 1RM estimado (Epley) con esa carga y reps; null si no se puede calcular. */
  est: number | null;
};

export function estimateOneRm(weight: number, reps: number | null): number | null {
  if (!Number.isFinite(weight) || weight <= 0 || reps == null) return null;
  if (reps === 1) return weight;
  if (reps < 2 || reps > 10) return null;
  return Math.round(weight * (1 + reps / 30) * 2) / 2;
}

/** Índice «mes|semana|día|bloque» → texto del bloque. */
export function blockContentIndex(months: Month[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const m of months)
    for (const w of m.weeks)
      for (const d of w.days)
        for (const b of d.blocks) map.set(`${m.key}|${w.index}|${d.key}|${b.key}`, b.content);
  return map;
}

/** Entrenos con carga de un ejercicio (por el texto del bloque del plan). */
export function sessionsFor(exercise: string, results: WorkoutResult[], blocks: Map<string, string>): Session[] {
  const out: Session[] = [];
  for (const r of results) {
    if (r.weight == null || Number(r.weight) <= 0) continue;
    const content = blocks.get(`${r.month_key}|${r.week}|${r.day_key}|${r.block_key}`);
    if (!content || !mentionsExercise(content, exercise)) continue;
    const weight = Number(r.weight);
    const reps = r.reps != null ? Number(r.reps) : null;
    out.push({
      id: r.id,
      date: r.updated_at,
      weight,
      sets: r.sets != null ? Number(r.sets) : null,
      reps,
      rpe: r.rpe != null ? Number(r.rpe) : null,
      est: estimateOneRm(weight, reps),
    });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

export function historyFor(exercise: string, repMax: number, all: PersonalRecordHistory[]): PersonalRecordHistory[] {
  const id = resolveMovementId(exercise);
  return all
    .filter((h) => (h.rep_max ?? 1) === repMax && (id ? resolveMovementId(h.exercise) === id : sameExercise(h.exercise, exercise)))
    .sort((a, b) => a.changed_at.localeCompare(b.changed_at));
}

/** Peso del récord en una fecha (según el historial). */
export function recordAt(history: PersonalRecordHistory[], when: number, current: number): number | null {
  let value: number | null = null;
  for (const h of history) {
    if (new Date(h.changed_at).getTime() <= when) value = Number(h.new_weight);
  }
  if (value != null) return value;
  const firstAfter = history.find((h) => new Date(h.changed_at).getTime() > when);
  if (firstAfter) return firstAfter.previous_weight != null ? Number(firstAfter.previous_weight) : null;
  return history.length === 0 ? current : null;
}

export type Trend = {
  kind: "up" | "down" | "stable" | "unknown";
  deltaKg: number | null;
  short: string;
};

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
export const monthName = (iso: string | number) => MONTHS[new Date(iso).getMonth()];

export function periodLabel(days: number): string {
  if (days <= 31) return "en 1 mes";
  if (days <= 93) return "en 3 meses";
  if (days <= 366) return "en 1 año";
  return "en total";
}

const fmt = (n: number) => String(Math.round(n * 100) / 100).replace(".", ",");

export function trendFor(
  current: number,
  history: PersonalRecordHistory[],
  sessions: Session[],
  days: number,
  now = Date.now(),
): Trend {
  const start = now - days * 86400000;
  const atStart = recordAt(history, start, current);
  const delta = atStart != null ? Math.round((current - atStart) * 100) / 100 : null;
  if (delta != null && delta > 0) return { kind: "up", deltaKg: delta, short: `▲ +${fmt(delta)} kg ${periodLabel(days)}` };

  const est = sessions.filter((s) => s.est != null && new Date(s.date).getTime() >= start).map((s) => s.est!);
  if (est.length >= 3) {
    const half = Math.floor(est.length / 2);
    const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    const first = avg(est.slice(0, half));
    const last = avg(est.slice(half));
    const pct = first > 0 ? ((last - first) / first) * 100 : 0;
    if (pct >= 2.5) return { kind: "up", deltaKg: delta, short: "▲ Subiendo en los entrenos" };
    if (pct <= -2.5) return { kind: "down", deltaKg: delta, short: "▼ Bajando en los entrenos" };
  }
  if (delta != null && delta < 0) return { kind: "down", deltaKg: delta, short: `▼ ${fmt(delta)} kg ${periodLabel(days)}` };
  const lastChange = history.length ? history[history.length - 1].changed_at : null;
  if (est.length >= 2 || (lastChange && new Date(lastChange).getTime() < start)) {
    return { kind: "stable", deltaKg: delta, short: `● Estable desde ${monthName(lastChange ?? start)}` };
  }
  return { kind: "unknown", deltaKg: delta, short: "Faltan sesiones para ver tendencia" };
}
