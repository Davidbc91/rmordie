/**
 * Planificador a mano: el plan se piensa por fechas (semanas y días reales) y
 * se guarda con la misma estructura que el importador (Mes → Semana → Día →
 * Bloque{key, content}), con la fecha exacta de cada día para que calendario,
 * Inicio y avisos lo coloquen bien. El estado editable viaja en planning.builder.
 */
import type { Month, Planning } from "./excel-parser";
import { addDays, isoKey, parseISODate } from "./plan-dates";

export type PExercise = { id: string; name: string; sets: string; reps: string; pct: string };
export type WodFormat = "AMRAP" | "EMOM" | "FOR TIME" | "TABATA";
export type PBlock =
  | { id: string; kind: "fuerza"; exercises: PExercise[] }
  | { id: string; kind: "wod"; format: WodFormat; minutes: string; text: string }
  | { id: string; kind: "texto"; title: string; text: string };
export type PDay = { date: string; rest: boolean; blocks: PBlock[] };
export type PlanState = { v: 1; name: string; start: string; weeks: PDay[][] };

export const DAY_KEYS = ["LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES", "SABADO", "DOMINGO"] as const;
export const DAY_SHORT = ["LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB", "DOM"];
const MONTH_ABBR = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
const MONTH_NAME = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

export const pid = () => Math.random().toString(36).slice(2, 10);

export function mondayOf(d: Date) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return addDays(x, -((x.getDay() + 6) % 7));
}

export function nextMonday(from = new Date()) {
  const m = mondayOf(from);
  return isoKey(from.getDay() === 1 ? m : addDays(m, 7));
}

export function emptyExercise(): PExercise {
  return { id: pid(), name: "", sets: "5", reps: "5", pct: "" };
}

export function newBlock(kind: PBlock["kind"]): PBlock {
  if (kind === "fuerza") return { id: pid(), kind, exercises: [emptyExercise()] };
  if (kind === "wod") return { id: pid(), kind, format: "AMRAP", minutes: "12", text: "" };
  return { id: pid(), kind, title: "", text: "" };
}

function makeWeek(monday: Date, trainDays: boolean[]): PDay[] {
  return DAY_KEYS.map((_, i) => ({ date: isoKey(addDays(monday, i)), rest: !trainDays[i], blocks: [] }));
}

export function createPlan(name: string, startIso: string, weeks: number, trainDays: boolean[]): PlanState {
  const monday = mondayOf(parseISODate(startIso) ?? new Date());
  return {
    v: 1,
    name: name.trim() || "Mi plan",
    start: isoKey(monday),
    weeks: Array.from({ length: weeks }, (_, w) => makeWeek(addDays(monday, w * 7), trainDays)),
  };
}

export function addWeek(plan: PlanState): PlanState {
  const last = plan.weeks[plan.weeks.length - 1];
  const monday = addDays(parseISODate(last[0].date)!, 7);
  const pattern = last.map((d) => !d.rest);
  return { ...plan, weeks: [...plan.weeks, makeWeek(monday, pattern)] };
}

/** Copia una semana sobre la siguiente; bump suma puntos de % a la fuerza. */
export function copyWeekForward(plan: PlanState, w: number, bump: number): PlanState {
  let next = plan;
  if (w + 1 >= next.weeks.length) next = addWeek(next);
  const weeks = next.weeks.map((wk) => wk.map((d) => ({ ...d })));
  weeks[w + 1] = weeks[w].map((d, i) => ({
    date: weeks[w + 1][i].date,
    rest: d.rest,
    blocks: cloneBlocks(d.blocks, bump),
  }));
  return { ...next, weeks };
}

export function cloneBlocks(blocks: PBlock[], bump = 0): PBlock[] {
  return blocks.map((b) => {
    if (b.kind !== "fuerza") return { ...b, id: pid() };
    return {
      ...b,
      id: pid(),
      exercises: b.exercises.map((e) => {
        const n = Number(e.pct.replace(",", "."));
        const pct = bump && Number.isFinite(n) && n > 0 ? String(Math.round((n + bump) * 10) / 10) : e.pct;
        return { ...e, id: pid(), pct };
      }),
    };
  });
}

export function blockLetter(i: number) {
  return String.fromCharCode(65 + i);
}

const fmtNum = (s: string) => s.trim().replace(",", ".");

export function exerciseLine(e: PExercise): string {
  const name = e.name.trim();
  if (!name) return "";
  const sets = fmtNum(e.sets);
  const reps = fmtNum(e.reps);
  const pct = fmtNum(e.pct);
  let line = name;
  if (sets && reps) line += ` ${sets}x${reps}`;
  else if (reps) line += ` ${reps} reps`;
  if (pct) line += ` (${pct}%)`;
  return line;
}

export function wodHeader(b: Extract<PBlock, { kind: "wod" }>): string {
  const min = fmtNum(b.minutes);
  if (b.format === "AMRAP") return `AMRAP ${min || 12}'`;
  if (b.format === "EMOM") return `EMOM ${min || 10}'`;
  if (b.format === "TABATA") return "TABATA";
  return min ? `FOR TIME (cap ${min}')` : "FOR TIME";
}

export function blockContent(b: PBlock): string {
  if (b.kind === "fuerza") return b.exercises.map(exerciseLine).filter(Boolean).join("\n");
  if (b.kind === "wod") return [wodHeader(b), ...b.text.split("\n").map((l) => l.trim()).filter(Boolean)].join("\n");
  return [b.title.trim(), b.text.trim()].filter(Boolean).join("\n");
}

/** Resumen en una línea de cada bloque (para la vista de semana). */
export function blockSummary(b: PBlock): string {
  if (b.kind === "fuerza") {
    const e = b.exercises.find((x) => x.name.trim());
    if (!e) return "Fuerza";
    const more = b.exercises.filter((x) => x.name.trim()).length - 1;
    return `${exerciseLine(e).replace(/ \((\d+(?:\.\d+)?)%\)$/, " @$1 %")}${more > 0 ? ` +${more}` : ""}`;
  }
  if (b.kind === "wod") return wodHeader(b);
  return b.title.trim() || b.text.trim().split("\n")[0] || "Texto";
}

export function dayHasContent(d: PDay) {
  return d.blocks.some((b) => blockContent(b).trim());
}

export function validatePlan(plan: PlanState): string | null {
  if (!plan.weeks.some((w) => w.some((d) => !d.rest && dayHasContent(d)))) {
    return "Rellena al menos un día antes de guardar.";
  }
  return null;
}

/** Plan del planificador → planificación de la app (con fechas exactas). */
export function toPlanning(plan: PlanState): Planning {
  const months: Month[] = [];
  const byKey = new Map<string, Month>();
  plan.weeks.forEach((week, wi) => {
    week.forEach((d, di) => {
      const date = parseISODate(d.date);
      if (!date) return;
      const key = `${MONTH_ABBR[date.getMonth()]} ${date.getFullYear()}`;
      let month = byKey.get(key);
      if (!month) {
        month = { key, label: `${MONTH_NAME[date.getMonth()]} ${date.getFullYear()}`, order: 0, weeks: [] } as Month;
        byKey.set(key, month);
        months.push(month);
      }
      let w = month.weeks.find((x) => x.index === wi + 1);
      if (!w) {
        w = { index: wi + 1, days: [] } as Month["weeks"][number];
        month.weeks.push(w);
      }
      const blocks = d.rest
        ? []
        : d.blocks.map((b, i) => ({ key: blockLetter(i), content: blockContent(b) })).filter((b) => b.content.trim());
      w.days.push({ key: DAY_KEYS[di], blocks, isRest: blocks.length === 0, date: d.date });
    });
  });
  months.forEach((m, i) => (m.order = i + 1));
  return { months, importedAt: new Date().toISOString(), builder: plan };
}

export function readBuilder(value: unknown): PlanState | null {
  const v = value as PlanState | null;
  return v && v.v === 1 && Array.isArray(v.weeks) ? v : null;
}
