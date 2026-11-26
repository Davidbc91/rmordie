import type { WorkoutResult } from "./store";
import type { PrHistoryRow, WellnessLog, Milestone } from "./profile-store";
import { trainedDay, volumeOf, localDay, streaks } from "./analytics";

/** Lunes (YYYY-MM-DD) de la semana de una fecha local. */
export function mondayOf(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  const wd = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - wd);
  return localDay(d);
}
export function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return localDay(d);
}
/** Lunes de la semana pasada. */
export const lastWeekMonday = (now = new Date()) => addDays(mondayOf(localDay(now)), -7);

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const MONTHS_LONG = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
export const DAY_LETTERS = ["L", "M", "X", "J", "V", "S", "D"];
const DAY_NAMES = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];

export function weekRange(monday: string, long = false): string {
  const end = addDays(monday, 6);
  const [, m1, d1] = monday.split("-").map(Number);
  const [, m2, d2] = end.split("-").map(Number);
  const M = long ? MONTHS_LONG : MONTHS;
  return m1 === m2 ? `${d1}–${d2} ${M[m2 - 1]}` : `${d1} ${M[m1 - 1]} – ${d2} ${M[m2 - 1]}`;
}

export type WeekSummary = {
  monday: string;
  sessions: number;
  target: number;
  trainedDays: boolean[]; // L..D
  volumeByDay: number[]; // kg L..D
  volume: number;
  prevVolume: number;
  volumeDelta: number | null; // % frente a la semana anterior
  prs: { exercise: string; weight: number; delta: number | null; repMax: number; day: string }[];
  medals: { code: string; label: string; detail: string | null }[];
  hardest: { day: string; rpe: number; detail: string | null } | null;
  streak: number; // racha al final de la semana
  weeksInRow: number; // semanas seguidas cumpliendo el objetivo (hasta esta)
  sleep: number | null;
  energy: number | null;
  rpeAvg: number | null;
  headline: string;
  sub: string;
};

function avg(xs: (number | null | undefined)[]): number | null {
  const v = xs.filter((x): x is number => x != null && Number.isFinite(Number(x))).map(Number);
  return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null;
}

function sessionsIn(results: WorkoutResult[], monday: string) {
  const end = addDays(monday, 6);
  return results.filter((r) => r.status === "completed" && trainedDay(r) >= monday && trainedDay(r) <= end);
}

export function weekSummary(input: {
  monday: string;
  results: WorkoutResult[];
  history: PrHistoryRow[];
  wellness: WellnessLog[];
  milestones: Milestone[];
  weeklyTarget: number;
}): WeekSummary {
  const { monday, results, history, wellness, milestones } = input;
  const target = Math.max(1, input.weeklyTarget);
  const end = addDays(monday, 6);
  const inWeek = sessionsIn(results, monday);
  const days = new Set(inWeek.map(trainedDay));
  const trainedDays = DAY_LETTERS.map((_, i) => days.has(addDays(monday, i)));
  const volumeByDay = DAY_LETTERS.map((_, i) => {
    const day = addDays(monday, i);
    return Math.round(inWeek.filter((r) => trainedDay(r) === day).reduce((a, r) => a + volumeOf(r), 0));
  });
  const volume = volumeByDay.reduce((a, b) => a + b, 0);
  const prevVolume = Math.round(sessionsIn(results, addDays(monday, -7)).reduce((a, r) => a + volumeOf(r), 0));
  const volumeDelta = prevVolume > 0 && volume > 0 ? Math.round(((volume - prevVolume) / prevVolume) * 100) : null;

  const dayOf = (ts: string) => localDay(new Date(ts));
  const prs = history
    .filter((h) => dayOf(h.changed_at) >= monday && dayOf(h.changed_at) <= end)
    .sort((a, b) => Number(b.new_weight) - Number(a.new_weight))
    .map((h) => ({
      exercise: h.exercise,
      weight: Number(h.new_weight),
      delta: h.previous_weight != null ? Math.round((Number(h.new_weight) - Number(h.previous_weight)) * 100) / 100 : null,
      repMax: h.rep_max ?? 1,
      day: DAY_NAMES[(new Date(`${dayOf(h.changed_at)}T12:00:00`).getDay() + 6) % 7],
    }));

  const medals = milestones
    .filter((m) => dayOf(m.achieved_at) >= monday && dayOf(m.achieved_at) <= end)
    .map((m) => ({ code: m.code, label: m.label, detail: m.detail }));

  const withRpe = inWeek.filter((r) => r.rpe != null);
  const top = withRpe.sort((a, b) => Number(b.rpe) - Number(a.rpe))[0];
  const hardest = top
    ? {
        day: DAY_NAMES[(new Date(`${trainedDay(top)}T12:00:00`).getDay() + 6) % 7],
        rpe: Number(top.rpe),
        detail: top.weight ? `${top.weight} kg${top.sets && top.reps ? ` · ${top.sets}×${top.reps}` : ""}` : null,
      }
    : null;

  // Racha tal y como estaba el domingo
  const upToEnd = results.filter((r) => trainedDay(r) <= end);
  const streak = streaks(upToEnd, new Date(`${end}T20:00:00`)).current;

  // Semanas seguidas cumpliendo, contando hacia atrás desde esta
  let weeksInRow = 0;
  for (let w = monday; weeksInRow < 104; w = addDays(w, -7)) {
    const n = new Set(sessionsIn(results, w).map(trainedDay)).size;
    if (n >= target) weeksInRow++;
    else break;
  }

  const wl = wellness.filter((l) => l.logged_on >= monday && l.logged_on <= end);
  const sessions = days.size;

  let headline: string, sub: string;
  if (sessions === 0) {
    headline = "Semana de descanso";
    sub = "Descansar también es entrenar. Esta semana, a por ello.";
  } else if (sessions >= target) {
    headline = sessions > target ? "Semana por encima" : "Semana redonda";
    sub = `Has llegado a tu objetivo de ${target} ${target === 1 ? "día" : "días"}.${weeksInRow > 1 ? ` Llevas ${weeksInRow} semanas seguidas.` : ""}`;
  } else if (target - sessions === 1) {
    headline = "Te faltó un día";
    sub = `${sessions} de ${target}. Casi: la próxima, redonda.`;
  } else if (volumeDelta != null && volumeDelta <= -30) {
    headline = "Semana de descarga";
    sub = `${sessions} de ${target} sesiones y menos carga. Viene bien para volver con fuerza.`;
  } else {
    headline = "Vuelta a la carga";
    sub = `${sessions} de ${target} sesiones. Cada entreno cuenta.`;
  }

  return {
    monday, sessions, target, trainedDays, volumeByDay, volume, prevVolume, volumeDelta, prs, medals, hardest, streak, weeksInRow,
    sleep: avg(wl.map((l) => l.sleep_hours)),
    energy: avg(wl.map((l) => l.energy)),
    rpeAvg: avg(inWeek.map((r) => r.rpe)),
    headline, sub,
  };
}

export const fmtTons = (kg: number) =>
  kg >= 1000 ? `${(Math.round(kg / 100) / 10).toString().replace(".", ",")} t` : `${Math.round(kg)} kg`;
export const fmtKgThousands = (kg: number) => Math.round(kg).toLocaleString("es-ES");

/* ---------------- Imagen para historias ---------------- */

export async function renderWeekStory(s: WeekSummary): Promise<Blob> {
  const W = 1080, H = 1920;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const ctx = c.getContext("2d")!;
  try { await (document as any).fonts?.ready; } catch { /* sin fuentes */ }
  const NUM = "'Big Shoulders Display', 'Plus Jakarta Sans', system-ui, sans-serif";
  const TXT = "'Plus Jakarta Sans', system-ui, sans-serif";
  const LIME = "#C6FF00", FG = "#F5F5F7", MUTED = "#99999A";

  ctx.fillStyle = "#0C0C0E"; ctx.fillRect(0, 0, W, H);
  let g = ctx.createRadialGradient(W * 0.8, 0, 50, W * 0.8, 0, 1100);
  g.addColorStop(0, "rgba(26,34,45,1)"); g.addColorStop(1, "rgba(26,34,45,0)");
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  g = ctx.createRadialGradient(0, H, 50, 0, H, 900);
  g.addColorStop(0, "rgba(198,255,0,0.14)"); g.addColorStop(1, "rgba(198,255,0,0)");
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  const rr = (x: number, y: number, w: number, h: number, r: number, fill: string) => {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
  };
  const P = 90;
  // Marca
  ctx.textBaseline = "alphabetic"; ctx.textAlign = "left";
  ctx.font = `800 64px ${TXT}`;
  ctx.fillStyle = FG; ctx.fillText("RM ", P, 190);
  let x = P + ctx.measureText("RM ").width;
  ctx.fillStyle = LIME; ctx.fillText("OR", x, 190);
  x += ctx.measureText("OR ").width;
  ctx.fillStyle = FG; ctx.fillText("DIE", x, 190);
  ctx.textAlign = "right"; ctx.fillStyle = MUTED; ctx.font = `600 40px ${TXT}`;
  ctx.fillText(weekRange(s.monday), W - P, 186);

  // Titular
  ctx.textAlign = "left"; ctx.fillStyle = MUTED; ctx.font = `600 46px ${TXT}`;
  ctx.fillText("Mi semana", P, 360);
  ctx.fillStyle = LIME; ctx.font = `800 300px ${NUM}`;
  ctx.fillText(`${s.sessions}/${s.target}`, P - 6, 640);
  ctx.fillStyle = FG; ctx.font = `800 70px ${TXT}`;
  ctx.fillText(s.headline, P, 760);

  // Días
  const dw = (W - P * 2 - 6 * 18) / 7;
  DAY_LETTERS.forEach((L, i) => {
    const dx = P + i * (dw + 18);
    rr(dx, 830, dw, 100, 26, s.trainedDays[i] ? LIME : "rgba(255,255,255,0.07)");
    ctx.fillStyle = s.trainedDays[i] ? "#0C0C0E" : "#6B6B70"; ctx.font = `800 40px ${TXT}`; ctx.textAlign = "center";
    ctx.fillText(L, dx + dw / 2, 895);
  });

  // Cifras
  const tiles: [string, string, boolean][] = [
    [s.volume > 0 ? fmtTons(s.volume) : "—", "movidos", false],
    [String(s.streak), "días de racha", true],
    [String(s.prs.length), s.prs.length === 1 ? "récord" : "récords", false],
    [String(s.medals.length), s.medals.length === 1 ? "medalla nueva" : "medallas nuevas", false],
  ];
  const tw = (W - P * 2 - 30) / 2;
  tiles.forEach(([v, l, accent], i) => {
    const tx = P + (i % 2) * (tw + 30), ty = 990 + Math.floor(i / 2) * 250;
    rr(tx, ty, tw, 220, 36, "rgba(255,255,255,0.06)");
    ctx.textAlign = "left"; ctx.fillStyle = accent ? LIME : FG; ctx.font = `800 110px ${NUM}`;
    ctx.fillText(v, tx + 40, ty + 130);
    ctx.fillStyle = MUTED; ctx.font = `600 38px ${TXT}`; ctx.fillText(l, tx + 40, ty + 185);
  });

  // Récord de la semana
  if (s.prs[0]) {
    const pr = s.prs[0];
    rr(P, 1510, W - P * 2, 190, 36, "rgba(255,255,255,0.06)");
    ctx.fillStyle = MUTED; ctx.font = `600 36px ${TXT}`; ctx.fillText("Récord de la semana", P + 40, 1580);
    ctx.font = `800 54px ${TXT}`; ctx.fillStyle = FG;
    const name = `${pr.exercise} · `;
    ctx.fillText(name, P + 40, 1655);
    ctx.fillStyle = LIME; ctx.fillText(`${String(pr.weight).replace(".", ",")} kg`, P + 40 + ctx.measureText(name).width, 1655);
  }

  ctx.textAlign = "center"; ctx.fillStyle = MUTED; ctx.font = `600 34px ${TXT}`;
  ctx.fillText("Entrenado con RM OR DIE", W / 2, H - 110);

  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("No se pudo generar la imagen"))), "image/png"));
}
