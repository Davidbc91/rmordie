/**
 * Cálculos del informe para el entrenador: veredicto, avisos, cifras clave con
 * su tendencia, fuerza (1RM, relación con el peso y subida en 90 días),
 * constancia semanal, recuperación, peso, objetivos y últimos entrenos.
 * Todo sale de lo que el atleta ha registrado.
 */
import type { Planning } from "./excel-parser";
import type { PersonalRecord, WorkoutResult } from "./store";
import type { AthleteGoal, BodyMetric, PrHistoryRow, WellnessLog } from "./profile-store";
import { localDay, trainedDay, weeklyConsistency } from "./analytics";

const DAY = 864e5;

export type ReportPeriod = "semana" | "mes" | "año";
export const PERIODS: Record<ReportPeriod, { days: number; label: string; when: string; button: string }> = {
  semana: { days: 7, label: "Últimos 7 días", when: "esta semana", button: "Semana" },
  mes: { days: 30, label: "Últimos 30 días", when: "este mes", button: "Mes" },
  año: { days: 365, label: "Últimos 12 meses", when: "este año", button: "Año" },
};
export type Bar = { label: string; value: number };

export const fmtN = (n: number, d = 1) =>
  Number.isInteger(n) ? String(n) : n.toFixed(d).replace(".", ",").replace(/,0$/, "");

export type Tone = "good" | "warn" | "bad" | "muted";
export type Kpi = { value: string; label: string; delta?: string; tone?: Tone };
export type Note = { tone: Tone; text: string };
export type LiftRow = { exercise: string; now: number; old: number; lastPr: string | null; bw: number | null };
export type Meter = { label: string; value: number | null; max: number; unit: string; tone: Tone; lowerIsBetter?: boolean };
export type GoalRow = { title: string; current: string; target: string; pct: number };
export type SessionCard = { date: string; label: string; rows: { name: string; value: string }[] };

function daysAgo(iso: string, now: Date) {
  return (now.getTime() - new Date(iso).getTime()) / DAY;
}
function avg(xs: number[]) {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}
function ago(iso: string, now: Date): string {
  const d = Math.max(0, Math.round(daysAgo(iso, now)));
  if (d === 0) return "hoy";
  if (d === 1) return "ayer";
  if (d < 14) return `hace ${d} días`;
  if (d < 60) return `hace ${Math.round(d / 7)} sem.`;
  return `hace ${Math.round(d / 30)} meses`;
}
const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

export function buildCoachReport(input: {
  results: WorkoutResult[];
  records: PersonalRecord[];
  history: PrHistoryRow[];
  metrics: BodyMetric[];
  wellness: WellnessLog[];
  goals: AthleteGoal[];
  planning: Planning | null | undefined;
  weeklyTarget: number;
  profileWeight: number | null;
  period?: ReportPeriod;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const period = input.period ?? "mes";
  const DAYS = PERIODS[period].days;
  const WEEKS = Math.max(1, Math.round(DAYS / 7));
  const done = input.results.filter((r) => r.status === "completed");
  const target = Math.max(1, input.weeklyTarget);

  // Sesiones (días distintos con algo registrado) por ventana
  const sessionKeys = (from: number, to: number) =>
    new Set(
      done
        .filter((r) => {
          const d = daysAgo(`${trainedDay(r)}T12:00:00`, now);
          return d >= from && d < to;
        })
        .map((r) => `${r.month_key}|${r.week}|${r.day_key}`),
    ).size;
  const sessions12 = sessionKeys(0, DAYS);
  const sessionsPrev = sessionKeys(DAYS, DAYS * 2);
  const consistency = weeklyConsistency(input.results, target, WEEKS, now);
  const prevConsistency = weeklyConsistency(
    input.results.filter((r) => daysAgo(`${trainedDay(r)}T12:00:00`, now) >= DAYS),
    target,
    WEEKS,
    new Date(now.getTime() - DAYS * DAY),
  );
  const weeksShown = consistency.weeks;
  // Semanas reales del periodo (si empezó a registrar hace poco, solo desde entonces)
  const firstDay = done.reduce<string | null>((min, r) => {
    const d = trainedDay(r);
    return !min || d < min ? d : min;
  }, null);
  const activeDays = firstDay ? Math.min(DAYS, Math.max(7, daysAgo(`${firstDay}T12:00:00`, now) + 1)) : DAYS;
  const perWeek = sessions12 / (activeDays / 7);
  const weeksOk = weeksShown.filter((w) => w.sessions >= target).length;
  // En la semana, la constancia es entrenos frente al objetivo
  if (period === "semana") consistency.pct = Math.min(100, Math.round((sessions12 / target) * 100));
  if (period === "semana") prevConsistency.pct = Math.min(100, Math.round((sessionsPrev / target) * 100));

  // Gráfico de constancia: días (semana), semanas (mes) o meses (año)
  const sessionDates = new Map<string, Set<string>>();
  for (const r of done) {
    const d = trainedDay(r);
    if (!sessionDates.has(d)) sessionDates.set(d, new Set());
    sessionDates.get(d)!.add(`${r.month_key}|${r.week}|${r.day_key}`);
  }
  let bars: Bar[] = [];
  let barTarget: number | null = target;
  if (period === "semana") {
    barTarget = null;
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * DAY);
      bars.push({ label: d.toLocaleDateString("es-ES", { weekday: "short" }).replace(".", ""), value: sessionDates.get(localDay(d))?.size ?? 0 });
    }
  } else if (period === "mes") {
    bars = weeklyConsistency(input.results, target, 5, now).weeks.map((w) => ({
      label: new Date(`${w.start}T12:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "short" }),
      value: w.sessions,
    }));
  } else {
    barTarget = Math.round(target * 4.33);
    for (let i = 11; i >= 0; i--) {
      const m = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`;
      let n = 0;
      for (const [d, set] of sessionDates) if (d.startsWith(key)) n += set.size;
      bars.push({ label: m.toLocaleDateString("es-ES", { month: "short" }).replace(".", ""), value: n });
    }
  }

  // Récords
  const prs30 = input.history.filter((h) => (h.rep_max ?? 1) === 1 && daysAgo(h.changed_at, now) <= DAYS);
  const prNames = [...new Set(prs30.map((h) => h.exercise))];

  // Esfuerzo
  const rpeIn = (from: number, to: number) =>
    avg(done.filter((r) => r.rpe != null && daysAgo(`${trainedDay(r)}T12:00:00`, now) >= from && daysAgo(`${trainedDay(r)}T12:00:00`, now) < to).map((r) => Number(r.rpe)));
  const rpe = rpeIn(0, DAYS);
  const rpePrev = rpeIn(DAYS, DAYS * 2);

  // Recuperación (últimas 2 semanas frente a las 2 anteriores)
  const wIn = (from: number, to: number, k: keyof WellnessLog) =>
    avg(input.wellness.filter((w) => w[k] != null && daysAgo(`${w.logged_on}T12:00:00`, now) >= from && daysAgo(`${w.logged_on}T12:00:00`, now) < to).map((w) => Number(w[k])));
  const RW = Math.min(DAYS, 30); // recuperación: como mucho el último mes
  const sleep = wIn(0, RW, "sleep_hours");
  const sleepPrev = wIn(RW, RW * 2, "sleep_hours");
  const fatigue = wIn(0, RW, "fatigue");
  const fatiguePrev = wIn(RW, RW * 2, "fatigue");

  // Peso corporal
  const metrics = [...input.metrics].filter((m) => m.weight_kg != null).sort((a, b) => a.measured_on.localeCompare(b.measured_on));
  const bw = input.profileWeight ?? (metrics.length ? Number(metrics[metrics.length - 1].weight_kg) : null);

  // Fuerza: 1RM ahora y hace 90 días
  const lifts: LiftRow[] = input.records
    .filter((r) => (r.rep_max ?? 1) === 1 && Number(r.weight) > 0)
    .map((r) => {
      const h = input.history
        .filter((x) => x.exercise === r.exercise && (x.rep_max ?? 1) === 1)
        .sort((a, b) => a.changed_at.localeCompare(b.changed_at));
      const before = h.filter((x) => daysAgo(x.changed_at, now) > DAYS);
      const after = h.filter((x) => daysAgo(x.changed_at, now) <= DAYS);
      const old = before.length
        ? Number(before[before.length - 1].new_weight)
        : after.length && after[0].previous_weight != null
          ? Number(after[0].previous_weight)
          : Number(r.weight);
      const lastPr = h.length ? h[h.length - 1].changed_at : r.updated_at;
      return { exercise: r.exercise, now: Number(r.weight), old: Math.min(old, Number(r.weight)), lastPr, bw };
    })
    .sort((a, b) => b.now - a.now)
    .slice(0, 10);
  const bestGain = [...lifts]
    .map((l) => {
      const h30 = input.history.filter((x) => x.exercise === l.exercise && (x.rep_max ?? 1) === 1 && daysAgo(x.changed_at, now) <= DAYS);
      const first = h30.sort((a, b) => a.changed_at.localeCompare(b.changed_at))[0];
      return { exercise: l.exercise, gain: first?.previous_weight != null ? l.now - Number(first.previous_weight) : 0 };
    })
    .sort((a, b) => b.gain - a.gain)[0];
  const stalled = lifts.filter((l) => l.lastPr && daysAgo(l.lastPr, now) > 120).slice(0, 1)[0];

  // Veredicto y avisos
  const notes: Note[] = [];
  const toneC: Tone = consistency.pct >= 80 ? "good" : consistency.pct >= 60 ? "warn" : "bad";
  const word = consistency.pct >= 80 ? "alta" : consistency.pct >= 60 ? "irregular" : "baja";
  if (period === "semana") {
    notes.push({ tone: toneC, text: `Constancia ${word}: ${sessions12} ${sessions12 === 1 ? "entreno" : "entrenos"} esta semana (objetivo ${target}).` });
  } else if (weeksShown.length) {
    notes.push({ tone: toneC, text: `Constancia ${word}: ${fmtN(perWeek)} entrenos por semana (objetivo ${target}) y ${weeksOk} de ${weeksShown.length} semanas cumplidas.` });
  }
  const span = PERIODS[period].when;
  if (prNames.length) notes.push({ tone: "good", text: `${prs30.length} ${prs30.length === 1 ? "récord nuevo" : "récords nuevos"} ${span}: ${prNames.slice(0, 4).join(", ")}${prNames.length > 4 ? "…" : ""}.` });
  const rwText = RW <= 7 ? "esta semana" : "el último mes";
  if (sleep != null && sleep < 7) notes.push({ tone: sleep < 6 ? "bad" : "warn", text: `Duerme ${fmtN(sleep)} h de media ${rwText}.` });
  if (fatigue != null && fatiguePrev != null && fatigue - fatiguePrev >= 0.8)
    notes.push({ tone: "warn", text: `La fatiga sube: ${fmtN(fatigue)}/10 frente a ${fmtN(fatiguePrev)}/10 en el periodo anterior.` });
  if (stalled) notes.push({ tone: "warn", text: `${stalled.exercise} no se mueve desde ${ago(stalled.lastPr!, now)} (${fmtN(stalled.now)} kg).` });
  if (!notes.length) notes.push({ tone: "muted", text: "Aún hay pocos datos registrados para sacar conclusiones." });

  const trainsText = period === "semana" ? `${sessions12} ${sessions12 === 1 ? "entreno" : "entrenos"} esta semana` : `${fmtN(perWeek)} días por semana`;
  let verdict = sessions12 ? (period === "semana" ? `Ha hecho ${trainsText}` : `Entrena ${trainsText}`) : `Sin entrenos registrados ${span}`;
  if (bestGain && bestGain.gain > 0) verdict += ` y sigue subiendo: +${fmtN(bestGain.gain)} kg en ${bestGain.exercise} ${span}.`;
  else if (sessions12) verdict += consistency.pct >= 80 ? " con mucha regularidad." : ".";
  else verdict += ".";
  if (sleep != null && sleep < 7) verdict += " Ojo con el sueño.";
  else if (fatigue != null && fatiguePrev != null && fatigue - fatiguePrev >= 0.8) verdict += " Ojo con la fatiga.";
  const verdictHighlights = [trainsText, bestGain && bestGain.gain > 0 ? `+${fmtN(bestGain.gain)} kg` : ""].filter(Boolean);

  // Cifras clave
  const sign = (n: number, d = 1) => `${n > 0 ? "+" : n < 0 ? "−" : "±"}${fmtN(Math.abs(n), d)}`;
  const kpis: Kpi[] = [
    {
      value: `${consistency.pct} %`,
      label: "Constancia",
      delta: prevConsistency.weeks.length ? `${sign(consistency.pct - prevConsistency.pct, 0)} pts` : undefined,
      tone: consistency.pct >= prevConsistency.pct ? "good" : "warn",
    },
    {
      value: String(sessions12),
      label: period === "semana" ? "Entrenos" : period === "mes" ? "Entrenos (30 días)" : "Entrenos (12 meses)",
      delta: sessionsPrev ? `${sign(sessions12 - sessionsPrev, 0)} vs anteriores` : undefined,
      tone: sessions12 >= sessionsPrev ? "good" : "warn",
    },
    { value: String(prs30.length), label: period === "semana" ? "Récords esta semana" : period === "mes" ? "Récords en 30 días" : "Récords en el año" },
    {
      value: rpe != null ? fmtN(rpe) : "—",
      label: "RPE medio",
      delta: rpe != null && rpePrev != null ? (Math.abs(rpe - rpePrev) < 0.3 ? "estable" : sign(rpe - rpePrev)) : undefined,
      tone: "muted",
    },
    {
      value: sleep != null ? `${fmtN(sleep)} h` : "—",
      label: "Sueño medio",
      delta: sleep != null && sleepPrev != null ? `${sign(sleep - sleepPrev)} h` : undefined,
      tone: sleep != null && sleep < 7 ? "warn" : "good",
    },
  ];

  // Recuperación (1-10; fatiga y dolor, cuanto más bajo mejor)
  const tone = (v: number | null, lower = false): Tone => {
    if (v == null) return "muted";
    const good = lower ? v <= 4 : v >= 7;
    const bad = lower ? v >= 7 : v <= 4;
    return good ? "good" : bad ? "bad" : "warn";
  };
  const energy = wIn(0, RW, "energy");
  const soreness = wIn(0, RW, "soreness");
  const mood = wIn(0, RW, "mood");
  const meters: Meter[] = [
    { label: "Sueño", value: sleep, max: 9, unit: "h", tone: sleep == null ? "muted" : sleep >= 7 ? "good" : sleep >= 6 ? "warn" : "bad" },
    { label: "Energía", value: energy, max: 10, unit: "", tone: tone(energy) },
    { label: "Fatiga", value: fatigue, max: 10, unit: "", tone: tone(fatigue, true), lowerIsBetter: true },
    { label: "Dolor", value: soreness, max: 10, unit: "", tone: tone(soreness, true), lowerIsBetter: true },
    { label: "Ánimo", value: mood, max: 10, unit: "", tone: tone(mood) },
  ];

  // Peso (últimos 16 registros)
  const inWindow = metrics.filter((m) => daysAgo(`${m.measured_on}T12:00:00`, now) <= Math.max(DAYS, 30));
  const weight = (inWindow.length > 1 ? inWindow : metrics).slice(-24).map((m) => ({ date: m.measured_on, kg: Number(m.weight_kg) }));
  const weightChange = weight.length > 1 ? weight[weight.length - 1].kg - weight[0].kg : null;

  // Objetivos
  const goals: GoalRow[] = input.goals
    .filter((g) => g.status !== "archived")
    .slice(0, 6)
    .map((g) => {
      const cur = g.current_value ?? g.start_value ?? 0;
      const start = g.start_value ?? (g.target_value >= cur ? 0 : cur * 1.25);
      const span = g.target_value - start;
      const pct = span === 0 ? 100 : Math.max(0, Math.min(100, ((cur - start) / span) * 100));
      const unit = g.unit ? ` ${g.unit}` : "";
      return { title: g.title, current: `${fmtN(Number(cur))}${unit}`, target: `${fmtN(Number(g.target_value))}${unit}`, pct: g.status === "completed" ? 100 : pct };
    });

  // Últimos entrenos (6 días con registros)
  const byDay = new Map<string, WorkoutResult[]>();
  for (const r of done) {
    const d = trainedDay(r);
    if (!byDay.has(d)) byDay.set(d, []);
    byDay.get(d)!.push(r);
  }
  const blockText = (r: WorkoutResult) => {
    const m = input.planning?.months.find((x) => x.key === r.month_key);
    const day = m?.weeks.find((w) => w.index === r.week)?.days.find((d) => d.key === r.day_key);
    const b = day?.blocks.find((x) => x.key === r.block_key);
    const first = b?.content.split("\n").map((l) => l.trim()).find(Boolean);
    return first ? `${r.block_key} · ${first}` : `Bloque ${r.block_key}`;
  };
  const resultText = (r: WorkoutResult) => {
    const parts: string[] = [];
    if (r.weight != null) parts.push(`${fmtN(Number(r.weight))} kg`);
    if (r.sets && r.reps) parts.push(`${r.sets}×${r.reps}`);
    else if (r.reps) parts.push(`${r.reps} reps`);
    if (r.time_seconds) parts.push(clock(Number(r.time_seconds)));
    if (r.rpe != null) parts.push(`RPE ${fmtN(Number(r.rpe))}`);
    if (!parts.length && r.notes) parts.push(r.notes.slice(0, 28));
    return parts.join(" · ") || "hecho";
  };
  const sessions: SessionCard[] = [...byDay.entries()]
    .filter(([d]) => daysAgo(`${d}T12:00:00`, now) <= DAYS)
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, period === "semana" ? 7 : 6)
    .map(([date, rs]) => ({
      date: new Date(`${date}T12:00:00`).toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" }),
      label: `Semana ${rs[0].week} · ${rs[0].day_key.charAt(0)}${rs[0].day_key.slice(1).toLowerCase()}`,
      rows: [...rs].sort((a, b) => a.block_key.localeCompare(b.block_key)).map((r) => ({ name: blockText(r), value: resultText(r) })),
    }));

  return {
    verdict,
    verdictHighlights,
    notes,
    kpis,
    lifts,
    liftAgo: (iso: string | null) => (iso ? ago(iso, now) : ""),
    weeks: weeksShown,
    bars,
    barTarget,
    target,
    period,
    periodLabel: PERIODS[period].label,
    recoveryLabel: RW <= 7 ? "Media de la semana" : "Media del último mes",
    meters,
    weight,
    weightChange,
    goals,
    sessions,
    today: localDay(now),
  };
}
