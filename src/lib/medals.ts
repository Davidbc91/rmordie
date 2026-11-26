import type { WorkoutResult, PersonalRecord } from "./store";
import type { PrHistoryRow } from "./profile-store";
import { sessionDays, localDay } from "./analytics";

/**
 * Medallas: se ganan solas con lo que ya registras. Las que se pueden fechar
 * (entreno nº 50, el día que la racha llegó a 14…) llevan la fecha real.
 */

export type MedalFamily = "constancia" | "racha" | "semanas" | "records" | "fuerza" | "habitos" | "retos";
export type MedalTier = "bronce" | "plata" | "oro" | "leyenda";

export type MedalDef = {
  code: string;
  family: MedalFamily;
  tier: MedalTier;
  name: string;
  /** Texto corto dentro de la medalla (10, 14 DÍAS, ×2…) */
  badge: string;
  /** Qué hay que hacer */
  how: string;
};

export type MedalState = MedalDef & {
  earned: boolean;
  /** 0..1 */
  progress: number;
  /** «14 de 30 días» */
  progressText: string | null;
  /** Fecha real en la que se consiguió, si se puede saber */
  earnedOn: string | null;
};

export const FAMILIES: { key: MedalFamily; label: string }[] = [
  { key: "constancia", label: "Constancia" },
  { key: "racha", label: "Racha" },
  { key: "semanas", label: "Semanas cumplidas" },
  { key: "records", label: "Récords" },
  { key: "fuerza", label: "Club de fuerza" },
  { key: "habitos", label: "Hábitos" },
  { key: "retos", label: "Retos" },
];

const d = (code: string, family: MedalFamily, tier: MedalTier, name: string, badge: string, how: string): MedalDef => ({ code, family, tier, name, badge, how });

// Los códigos de los antiguos «hitos» se mantienen para conservar su fecha.
export const MEDALS: MedalDef[] = [
  d("first_workout", "constancia", "bronce", "Primer entreno", "1", "Completa tu primer entreno"),
  d("workouts_10", "constancia", "bronce", "Arrancando", "10", "Completa 10 entrenos"),
  d("workouts_25", "constancia", "plata", "Habitual", "25", "Completa 25 entrenos"),
  d("workouts_50", "constancia", "oro", "Medio centenar", "50", "Completa 50 entrenos"),
  d("workouts_100", "constancia", "oro", "Centurión", "100", "Completa 100 entrenos"),
  d("workouts_250", "constancia", "leyenda", "Leyenda del box", "250", "Completa 250 entrenos"),

  d("streak_3", "racha", "bronce", "En marcha", "3 DÍAS", "Racha de 3 días"),
  d("streak_7", "racha", "bronce", "Semana perfecta", "7 DÍAS", "Racha de 7 días"),
  d("streak_14", "racha", "plata", "Imparable", "14 DÍAS", "Racha de 14 días"),
  d("streak_30", "racha", "oro", "Mes de hierro", "30 DÍAS", "Racha de 30 días"),
  d("streak_60", "racha", "leyenda", "Inquebrantable", "60 DÍAS", "Racha de 60 días"),

  d("weeks_4", "semanas", "bronce", "Cumplidor", "4 SEM", "4 semanas seguidas llegando a tu objetivo de días"),
  d("weeks_12", "semanas", "plata", "Trimestre redondo", "12 SEM", "12 semanas seguidas llegando a tu objetivo"),
  d("weeks_26", "semanas", "oro", "Medio año en serio", "26 SEM", "26 semanas seguidas llegando a tu objetivo"),

  d("first_pr", "records", "bronce", "Primer RM", "1º RM", "Bate tu primer récord"),
  d("prs_10", "records", "plata", "Coleccionista", "10", "Bate 10 récords"),
  d("prs_25", "records", "oro", "Rompe-récords", "25", "Bate 25 récords"),
  d("prs_50", "records", "leyenda", "Sin techo", "50", "Bate 50 récords"),
  d("pr_month_3", "records", "plata", "Mes de récords", "×3", "Bate 3 récords en un mismo mes"),

  d("club_100", "fuerza", "bronce", "Club 100", "100", "Levanta 100 kg en cualquier ejercicio"),
  d("club_140", "fuerza", "plata", "Club 140", "140", "Levanta 140 kg en cualquier ejercicio"),
  d("club_180", "fuerza", "oro", "Club 180", "180", "Levanta 180 kg en cualquier ejercicio"),
  d("deadlift_x2", "fuerza", "leyenda", "Doble peso", "×2", "Peso muerto al doble de tu peso corporal"),

  d("early_10", "habitos", "plata", "Madrugador", "10", "10 entrenos registrados antes de las 9:00"),
  d("weekend_10", "habitos", "plata", "Guerrero de finde", "10", "Entrena 10 sábados o domingos"),
  d("first_day_3", "habitos", "oro", "Sin excusas", "×3", "Entrena el día 1 de tres meses distintos"),
  d("coach_report", "habitos", "bronce", "Coach informado", "", "Saca tu primer informe para el entrenador"),
  d("shared_workout", "habitos", "bronce", "Compartido", "", "Comparte tu primer entreno"),

  d("challenge_done", "retos", "plata", "Reto cumplido", "META", "Llega a la meta de un reto del mes"),
  d("challenge_win", "retos", "leyenda", "Campeón del reto", "1º", "Termina primero en un reto del mes"),
];

/** Medallas que solo se ganan con una acción (no se calculan): se guardan al hacerla. */
export const ACTION_MEDALS = new Set(["coach_report", "shared_workout", "challenge_done", "challenge_win"]);

const dayNum = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 864e5;
const isoFromNum = (n: number) => new Date(n * 864e5).toISOString().slice(0, 10);
/** Lunes de la semana (número de día) */
const mondayOf = (n: number) => n - ((new Date(n * 864e5).getUTCDay() + 6) % 7);

export type MedalInput = {
  results: WorkoutResult[];
  history: PrHistoryRow[];
  records: PersonalRecord[];
  bodyWeight: number | null;
  weeklyTarget: number;
  /** Códigos ya guardados (para las medallas por acción) */
  savedCodes: Set<string>;
  now?: Date;
};

export function evaluateMedals(input: MedalInput): MedalState[] {
  const { results, history, records, bodyWeight, weeklyTarget, savedCodes } = input;
  const now = input.now ?? new Date();
  const days = sessionDays(results);
  const nums = days.map(dayNum);

  // Racha: para cada día, longitud de la racha hasta ese día (misma regla que streaks()).
  const runAt: number[] = [];
  let runStart = nums[0] ?? 0;
  nums.forEach((n, i) => {
    if (i > 0 && n - nums[i - 1] > 2) runStart = n;
    runAt.push(n - runStart + 1);
  });
  const bestStreak = runAt.length ? Math.max(...runAt) : 0;
  const lastN = nums[nums.length - 1];
  const currentStreak = lastN != null && dayNum(localDay(now)) - lastN <= 2 ? runAt[runAt.length - 1] : 0;
  const streakReached = (len: number): string | null => {
    // primer día en que la racha alcanzó esa longitud
    let start = nums[0];
    for (let i = 0; i < nums.length; i++) {
      if (i > 0 && nums[i] - nums[i - 1] > 2) start = nums[i];
      if (nums[i] - start + 1 >= len) return isoFromNum(nums[i]);
    }
    return null;
  };

  // Semanas seguidas cumpliendo el objetivo
  const perWeek = new Map<number, number>();
  for (const n of nums) perWeek.set(mondayOf(n), (perWeek.get(mondayOf(n)) ?? 0) + 1);
  const weeks = [...perWeek.keys()].sort((a, b) => a - b);
  const target = Math.max(1, weeklyTarget);
  let bestWeeks = 0, run = 0, prev: number | null = null;
  const weeksReached = new Map<number, string>();
  for (const w of weeks) {
    const ok = (perWeek.get(w) ?? 0) >= target;
    if (!ok) { run = 0; prev = w; continue; }
    run = prev != null && w - prev === 7 && run > 0 ? run + 1 : 1;
    prev = w;
    bestWeeks = Math.max(bestWeeks, run);
    if (!weeksReached.has(run)) weeksReached.set(run, isoFromNum(w + 6));
  }
  // Semana en curso que todavía puede cumplirse: sigue contando la racha anterior
  const thisMonday = mondayOf(dayNum(localDay(now)));
  const lastOkRun = prev === thisMonday - 7 || prev === thisMonday ? run : 0;

  // Récords
  const prs = [...history].sort((a, b) => a.changed_at.localeCompare(b.changed_at));
  const prMonth = new Map<string, number>();
  let prMonthDate: string | null = null;
  for (const h of prs) {
    const k = h.changed_at.slice(0, 7);
    const c = (prMonth.get(k) ?? 0) + 1;
    prMonth.set(k, c);
    if (c === 3 && !prMonthDate) prMonthDate = h.changed_at.slice(0, 10);
  }
  const bestPrMonth = Math.max(0, ...prMonth.values());

  // Fuerza: el mayor peso levantado (récords y su historial)
  const lifts: { w: number; at: string; ex: string }[] = [
    ...records.map((r) => ({ w: Number(r.weight) || 0, at: r.updated_at, ex: r.exercise })),
    ...history.map((h) => ({ w: Number(h.new_weight) || 0, at: h.changed_at, ex: h.exercise })),
  ];
  const maxLift = Math.max(0, ...lifts.map((l) => l.w));
  const liftReached = (kg: number) => lifts.filter((l) => l.w >= kg).map((l) => l.at).sort()[0]?.slice(0, 10) ?? null;
  const deadlift = Math.max(0, ...lifts.filter((l) => /peso muerto|deadlift|\bdl\b/i.test(l.ex)).map((l) => l.w));

  // Hábitos
  const firstStamp = new Map<string, string>();
  for (const r of results) {
    if (r.status !== "completed") continue;
    const day = r.trained_on ?? localDay(new Date(r.updated_at));
    // solo vale la hora si el registro se hizo ese mismo día
    if (localDay(new Date(r.updated_at)) !== day) continue;
    const cur = firstStamp.get(day);
    if (!cur || r.updated_at < cur) firstStamp.set(day, r.updated_at);
  }
  const earlyDays = [...firstStamp.entries()].filter(([, ts]) => new Date(ts).getHours() < 9).map(([dd]) => dd).sort();
  const weekendDays = days.filter((x) => { const wd = new Date(dayNum(x) * 864e5).getUTCDay(); return wd === 0 || wd === 6; });
  const firstDays = days.filter((x) => x.endsWith("-01"));

  const count = (have: number, need: number, unit: string, reached: string | null) => ({ have, need, unit, reached });
  const facts: Record<string, { have: number; need: number; unit: string; reached: string | null }> = {
    first_workout: count(days.length, 1, "entreno", days[0] ?? null),
    workouts_10: count(days.length, 10, "entrenos", days[9] ?? null),
    workouts_25: count(days.length, 25, "entrenos", days[24] ?? null),
    workouts_50: count(days.length, 50, "entrenos", days[49] ?? null),
    workouts_100: count(days.length, 100, "entrenos", days[99] ?? null),
    workouts_250: count(days.length, 250, "entrenos", days[249] ?? null),
    first_pr: count(prs.length, 1, "récord", prs[0]?.changed_at.slice(0, 10) ?? null),
    prs_10: count(prs.length, 10, "récords", prs[9]?.changed_at.slice(0, 10) ?? null),
    prs_25: count(prs.length, 25, "récords", prs[24]?.changed_at.slice(0, 10) ?? null),
    prs_50: count(prs.length, 50, "récords", prs[49]?.changed_at.slice(0, 10) ?? null),
    pr_month_3: count(bestPrMonth, 3, "récords en un mes", prMonthDate),
    early_10: count(earlyDays.length, 10, "entrenos madrugando", earlyDays[9] ?? null),
    weekend_10: count(weekendDays.length, 10, "días de finde", weekendDays[9] ?? null),
    first_day_3: count(firstDays.length, 3, "meses", firstDays[2] ?? null),
  };
  for (const n of [3, 7, 14, 30, 60]) facts[`streak_${n}`] = { have: bestStreak >= n ? n : currentStreak, need: n, unit: "días de racha", reached: bestStreak >= n ? streakReached(n) : null };
  for (const n of [4, 12, 26]) facts[`weeks_${n}`] = { have: bestWeeks >= n ? n : lastOkRun, need: n, unit: "semanas", reached: weeksReached.get(n) ?? null };
  for (const n of [100, 140, 180]) facts[`club_${n}`] = { have: Math.min(maxLift, n), need: n, unit: "kg", reached: liftReached(n) };
  if (bodyWeight && bodyWeight > 0) facts.deadlift_x2 = { have: Math.min(deadlift, bodyWeight * 2), need: Math.round(bodyWeight * 2 * 10) / 10, unit: "kg de peso muerto", reached: deadlift >= bodyWeight * 2 ? liftReached(bodyWeight * 2) : null };

  return MEDALS.map((m) => {
    if (ACTION_MEDALS.has(m.code)) {
      const earned = savedCodes.has(m.code);
      return { ...m, earned, progress: earned ? 1 : 0, progressText: null, earnedOn: null };
    }
    const f = facts[m.code];
    if (!f) return { ...m, earned: false, progress: 0, progressText: m.code === "deadlift_x2" ? "Apunta tu peso corporal" : null, earnedOn: null };
    const earned = f.have >= f.need || savedCodes.has(m.code);
    const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace(".", ","));
    return {
      ...m,
      earned,
      progress: earned ? 1 : Math.max(0, Math.min(1, f.have / f.need)),
      progressText: earned ? null : `${fmt(f.have)} de ${fmt(f.need)} ${f.unit}`,
      earnedOn: f.reached,
    };
  });
}

/** La medalla bloqueada más cercana a conseguirse. */
export function nextMedal(list: MedalState[]): MedalState | null {
  return list.filter((m) => !m.earned && m.progress > 0).sort((a, b) => b.progress - a.progress)[0] ?? null;
}
