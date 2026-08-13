import type { WorkoutResult, PersonalRecord } from "./store";
import type { Planning } from "./excel-parser";
import type { BodyMetric, WellnessLog, PrHistoryRow } from "./profile-store";

export type RangeKey = "4w" | "8w" | "12w" | "6m" | "all";

export const RANGES: { key: RangeKey; label: string; days: number | null }[] = [
  { key: "4w", label: "4 sem", days: 28 },
  { key: "8w", label: "8 sem", days: 56 },
  { key: "12w", label: "12 sem", days: 84 },
  { key: "6m", label: "6 meses", days: 182 },
  { key: "all", label: "Todo", days: null },
];

export const dayStr = (d: Date | string) => new Date(d).toISOString().slice(0, 10);

export function volumeOf(r: WorkoutResult): number {
  const w = r.weight ?? 0;
  const sets = r.sets ?? 1;
  const reps = r.reps ?? 0;
  return w > 0 && reps > 0 ? w * sets * reps : 0;
}

export function inRange(dateISO: string, days: number | null, now = new Date()): boolean {
  if (days == null) return true;
  const t = new Date(dateISO).getTime();
  return t >= now.getTime() - days * 864e5;
}

/** Same-length window immediately before the current one. */
export function inPrevRange(dateISO: string, days: number | null, now = new Date()): boolean {
  if (days == null) return false;
  const t = new Date(dateISO).getTime();
  return t >= now.getTime() - 2 * days * 864e5 && t < now.getTime() - days * 864e5;
}

export type WindowStats = {
  blocks: number;
  sessions: number;
  volume: number;
  avgRpe: number | null;
  hours: number;
  weeksSpan: number;
  weeklyFreq: number | null;
  prs: number;
};

export function windowStats(
  results: WorkoutResult[],
  history: PrHistoryRow[],
  days: number | null,
  prev = false,
): WindowStats {
  const test = (d: string) => (prev ? inPrevRange(d, days) : inRange(d, days));
  const rs = results.filter((r) => r.status === "completed" && test(r.updated_at));
  const sessions = new Set(rs.map((r) => `${r.month_key}|${r.week}|${r.day_key}`)).size;
  const volume = rs.reduce((a, r) => a + volumeOf(r), 0);
  const rpes = rs.map((r) => r.rpe).filter((x): x is number => x != null);
  const secs = rs.reduce((a, r) => a + (r.time_seconds ?? 0), 0);
  const weeksSpan = days ? days / 7 : Math.max(1, spanWeeks(rs.map((r) => r.updated_at)));
  const prs = history.filter((h) => test(h.changed_at)).length;
  return {
    blocks: rs.length,
    sessions,
    volume,
    avgRpe: rpes.length ? rpes.reduce((a, b) => a + b, 0) / rpes.length : null,
    hours: secs / 3600,
    weeksSpan,
    weeklyFreq: weeksSpan > 0 ? sessions / weeksSpan : null,
    prs,
  };
}

function spanWeeks(dates: string[]): number {
  if (dates.length < 2) return 1;
  const ts = dates.map((d) => new Date(d).getTime());
  return Math.max(1, (Math.max(...ts) - Math.min(...ts)) / (7 * 864e5));
}

export function sessionDays(results: WorkoutResult[]): string[] {
  const set = new Set(
    results.filter((r) => r.status === "completed").map((r) => dayStr(r.updated_at)),
  );
  return Array.from(set).sort();
}

export function streaks(results: WorkoutResult[]): { current: number; best: number } {
  const days = sessionDays(results);
  if (days.length === 0) return { current: 0, best: 0 };
  let best = 1;
  let run = 1;
  for (let i = 1; i < days.length; i++) {
    const diff = (new Date(days[i]).getTime() - new Date(days[i - 1]).getTime()) / 864e5;
    run = diff <= 1.5 ? run + 1 : 1;
    best = Math.max(best, run);
  }
  const today = dayStr(new Date());
  const yesterday = dayStr(new Date(Date.now() - 864e5));
  const last = days[days.length - 1];
  let current = 0;
  if (last === today || last === yesterday) {
    current = 1;
    for (let i = days.length - 1; i > 0; i--) {
      const diff = (new Date(days[i]).getTime() - new Date(days[i - 1]).getTime()) / 864e5;
      if (diff <= 1.5) current++;
      else break;
    }
  }
  return { current, best };
}

export function plannedTrainingDays(planning: Planning | null | undefined): number {
  if (!planning) return 0;
  let n = 0;
  for (const m of planning.months) for (const w of m.weeks) for (const d of w.days) if (!d.isRest) n++;
  return n;
}

/** Epley */
export function estimate1rm(weight: number, reps: number): number {
  if (reps <= 1) return weight;
  return weight * (1 + reps / 30);
}

export type ExerciseStat = {
  exercise: string;
  realOneRm: number | null;
  estimatedOneRm: number | null;
  estimatedFrom: string | null;
  currentPr: number | null;
  bestWeight: number | null;
  lastWeight: number | null;
  lastPrDate: string | null;
  updates: number;
  series: { date: string; weight: number }[];
  changePct: number | null;
};

export function exerciseStats(
  records: PersonalRecord[],
  history: PrHistoryRow[],
  days: number | null = null,
): ExerciseStat[] {
  const names = new Set<string>([
    ...records.map((r) => r.exercise),
    ...history.map((h) => h.exercise),
  ]);
  const out: ExerciseStat[] = [];
  for (const name of names) {
    const recs = records.filter((r) => r.exercise === name);
    const hist = history.filter((h) => h.exercise === name).sort((a, b) => a.changed_at.localeCompare(b.changed_at));
    const real = recs.find((r) => (r.rep_max ?? 1) === 1)?.weight ?? null;
    let est: number | null = null;
    let estFrom: string | null = null;
    for (const r of recs) {
      const rm = r.rep_max ?? 1;
      if (rm <= 1) continue;
      const e = estimate1rm(Number(r.weight), rm);
      if (est == null || e > est) {
        est = e;
        estFrom = `${r.weight} kg × ${rm}`;
      }
    }
    const oneRmHist = hist.filter((h) => (h.rep_max ?? 1) === 1);
    const series = (oneRmHist.length ? oneRmHist : hist).map((h) => ({
      date: h.changed_at,
      weight: Number(h.new_weight),
    }));
    const windowSeries = days ? series.filter((s) => inRange(s.date, days)) : series;
    const first = windowSeries[0]?.weight ?? null;
    const last = windowSeries[windowSeries.length - 1]?.weight ?? null;
    const changePct = first && last && first > 0 && windowSeries.length > 1 ? ((last - first) / first) * 100 : null;
    out.push({
      exercise: name,
      realOneRm: real != null ? Number(real) : null,
      estimatedOneRm: est,
      estimatedFrom: estFrom,
      currentPr: recs.length ? Math.max(...recs.map((r) => Number(r.weight))) : null,
      bestWeight: series.length ? Math.max(...series.map((s) => s.weight)) : null,
      lastWeight: series.length ? series[series.length - 1].weight : null,
      lastPrDate: hist.length ? hist[hist.length - 1].changed_at : null,
      updates: hist.length,
      series,
      changePct,
    });
  }
  return out.sort((a, b) => (b.currentPr ?? 0) - (a.currentPr ?? 0));
}

export type Trend = "up" | "down" | "stable" | "unknown";

export function trendOf(current: number | null, previous: number | null, tolPct = 3): Trend {
  if (current == null || previous == null || previous === 0) return "unknown";
  const diff = ((current - previous) / previous) * 100;
  if (diff > tolPct) return "up";
  if (diff < -tolPct) return "down";
  return "stable";
}

export type Insight = { text: string; trend: Trend };

export function progressionInsights(
  results: WorkoutResult[],
  history: PrHistoryRow[],
  records: PersonalRecord[],
  bodyWeight: number | null,
  days: number | null,
  label: string,
): Insight[] {
  const out: Insight[] = [];
  const cur = windowStats(results, history, days);
  const prev = windowStats(results, history, days, true);

  if (days && prev.sessions > 0) {
    const t = trendOf(cur.volume, prev.volume, 5);
    if (t !== "unknown") {
      const pct = prev.volume ? Math.round(((cur.volume - prev.volume) / prev.volume) * 100) : 0;
      out.push({
        text:
          t === "stable"
            ? `Tu volumen se mantiene estable en ${label}.`
            : `Tu volumen ${t === "up" ? "ha aumentado" : "ha bajado"} un ${Math.abs(pct)}% respecto al periodo anterior.`,
        trend: t,
      });
    }
    const rpeT = trendOf(cur.avgRpe, prev.avgRpe, 5);
    if (rpeT !== "unknown") {
      out.push({
        text:
          rpeT === "stable"
            ? "Tu RPE medio se mantiene estable."
            : `Tu RPE medio ${rpeT === "up" ? "ha aumentado" : "ha disminuido"} (${cur.avgRpe!.toFixed(1)} vs ${prev.avgRpe!.toFixed(1)}).`,
        trend: rpeT === "up" ? "down" : rpeT === "down" ? "up" : "stable",
      });
    }
    const freqT = trendOf(cur.weeklyFreq, prev.weeklyFreq, 8);
    if (freqT !== "unknown") {
      out.push({
        text:
          freqT === "stable"
            ? `Tu frecuencia se mantiene en ${cur.weeklyFreq!.toFixed(1)} sesiones/semana.`
            : `Tu frecuencia semanal ${freqT === "up" ? "ha subido" : "ha bajado"} a ${cur.weeklyFreq!.toFixed(1)} sesiones/semana.`,
        trend: freqT,
      });
    }
  }

  for (const s of exerciseStats(records, history, days)) {
    if (s.changePct == null) continue;
    if (Math.abs(s.changePct) >= 1) {
      out.push({
        text: `${s.exercise} ${s.changePct > 0 ? "ha aumentado" : "ha bajado"} un ${Math.abs(s.changePct).toFixed(1)}% en ${label}.`,
        trend: s.changePct > 0 ? "up" : "down",
      });
    }
  }

  // Estancamientos: sin nuevo PR en > 42 días
  const now = Date.now();
  for (const s of exerciseStats(records, history)) {
    if (!s.lastPrDate) continue;
    const weeks = Math.floor((now - new Date(s.lastPrDate).getTime()) / (7 * 864e5));
    if (weeks >= 6) {
      out.push({ text: `${s.exercise} lleva ${weeks} semanas sin mejorar.`, trend: "stable" });
    }
  }

  if (bodyWeight && bodyWeight > 0) {
    const top = exerciseStats(records, history)[0];
    if (top?.currentPr) {
      out.push({
        text: `Tu fuerza relativa en ${top.exercise} es ${(top.currentPr / bodyWeight).toFixed(2)}x tu peso corporal.`,
        trend: "up",
      });
    }
  }

  return out;
}

export function bodyChange(metrics: BodyMetric[]): { current: number | null; change: number | null } {
  const withW = metrics.filter((m) => m.weight_kg != null);
  if (withW.length === 0) return { current: null, change: null };
  const current = Number(withW[withW.length - 1].weight_kg);
  const first = Number(withW[0].weight_kg);
  return { current, change: withW.length > 1 ? current - first : null };
}

export function wellnessAverages(logs: WellnessLog[], days: number | null) {
  const rows = logs.filter((l) => inRange(l.logged_on, days));
  const avg = (k: keyof WellnessLog) => {
    const vals = rows.map((r) => r[k]).filter((v): v is number => typeof v === "number");
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  };
  return {
    count: rows.length,
    sleep: avg("sleep_hours"),
    energy: avg("energy"),
    fatigue: avg("fatigue"),
    soreness: avg("soreness"),
    mood: avg("mood"),
  };
}

export function fmtKg(n: number | null | undefined, digits = 1) {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${Number(n).toLocaleString("es-ES", { maximumFractionDigits: digits })} kg`;
}

export function fmtNum(n: number | null | undefined, digits = 1) {
  if (n == null || !Number.isFinite(n)) return "—";
  return Number(n).toLocaleString("es-ES", { maximumFractionDigits: digits });
}

export function monthlyReport(
  results: WorkoutResult[],
  history: PrHistoryRow[],
  metrics: BodyMetric[],
  monthDate = new Date(),
) {
  const y = monthDate.getFullYear();
  const m = monthDate.getMonth();
  const inMonth = (d: string) => {
    const t = new Date(d);
    return t.getFullYear() === y && t.getMonth() === m;
  };
  const rs = results.filter((r) => r.status === "completed" && inMonth(r.updated_at));
  const sessions = new Set(rs.map((r) => `${r.month_key}|${r.week}|${r.day_key}`)).size;
  const volume = rs.reduce((a, r) => a + volumeOf(r), 0);
  const rpes = rs.map((r) => r.rpe).filter((x): x is number => x != null);
  const prs = history.filter((h) => inMonth(h.changed_at));
  const bw = metrics.filter((x) => x.weight_kg != null && inMonth(x.measured_on));
  return {
    label: monthDate.toLocaleDateString("es-ES", { month: "long", year: "numeric" }).toUpperCase(),
    sessions,
    blocks: rs.length,
    volume,
    avgRpe: rpes.length ? rpes.reduce((a, b) => a + b, 0) / rpes.length : null,
    prs,
    bodyweight: bw.length ? Number(bw[bw.length - 1].weight_kg) : null,
  };
}

export function computeMilestones(
  results: WorkoutResult[],
  history: PrHistoryRow[],
): { code: string; label: string; detail: string | null }[] {
  const days = sessionDays(results);
  const out: { code: string; label: string; detail: string | null }[] = [];
  const push = (code: string, label: string, detail: string | null = null) => out.push({ code, label, detail });
  if (days.length >= 1) push("first_workout", "Primer entrenamiento", days[0]);
  for (const n of [10, 25, 50, 100, 200]) {
    if (days.length >= n) push(`workouts_${n}`, `${n} entrenamientos`, null);
  }
  if (history.length >= 1) push("first_pr", "Primer PR", history[0].exercise);
  for (const n of [10, 25, 50]) {
    if (history.length >= n) push(`prs_${n}`, `${n} PRs`, null);
  }
  const best = streaks(results).best;
  if (best >= 3) push(`streak_${Math.min(best, 30)}`, `Racha de ${best} días`, null);
  const oneRm = history.filter((h) => (h.rep_max ?? 1) === 1);
  if (oneRm.length) {
    const top = oneRm.reduce((a, b) => (Number(b.new_weight) > Number(a.new_weight) ? b : a));
    push("best_1rm", "Mejor 1RM", `${top.exercise} · ${top.new_weight} kg`);
  }
  return out;
}
