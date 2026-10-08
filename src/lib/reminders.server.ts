/**
 * Avisos programados: recordatorio diario del entreno y resumen semanal.
 * SOLO servidor. Lo ejecuta la tarea programada de la base de datos cada
 * 15 minutos a través de /api/cron/reminders.
 *
 * Cada aviso se "reclama" en la base de datos antes de enviarse (se anota la
 * fecha local del envío), así que aunque la tarea se ejecute varias veces o en
 * paralelo, cada persona recibe como mucho un aviso de cada tipo al día.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Planning } from "./excel-parser";
import type { WorkoutResult } from "./store";
import type { PrHistoryRow } from "./profile-store";
import { buildPlanDateIndex } from "./plan-dates";
import { fmtKg, windowStats } from "./analytics";
import { deliver, type PushPayload } from "./push.server";

type Preferences = {
  user_id: string;
  daily_enabled: boolean;
  daily_time: string;
  weekly_enabled: boolean;
  timezone: string;
  last_daily_on: string | null;
  last_weekly_on: string | null;
};

const WEEKLY_TIME = "20:00";
/** Si el servidor estuvo caído, no enviamos avisos con más de 3 h de retraso. */
const MAX_DELAY_MINUTES = 180;
const DEFAULT_TZ = "Europe/Madrid";

// La tabla es nueva y aún no está en los tipos generados de Supabase.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => supabaseAdmin as any;

type LocalNow = { date: string; minutes: number; weekday: string };

export function localNow(now: Date, timeZone: string): LocalNow {
  const read = (tz: string) => {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat("en-CA", {
        timeZone: tz,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        weekday: "short",
        hourCycle: "h23",
      })
        .formatToParts(now)
        .map((p) => [p.type, p.value]),
    );
    return {
      date: `${parts.year}-${parts.month}-${parts.day}`,
      minutes: Number(parts.hour) * 60 + Number(parts.minute),
      weekday: String(parts.weekday),
    };
  };
  try {
    return read(timeZone || DEFAULT_TZ);
  } catch {
    return read(DEFAULT_TZ);
  }
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function isDue(local: LocalNow, at: string, lastSentOn: string | null): boolean {
  if (lastSentOn === local.date) return false;
  const delay = local.minutes - toMinutes(at);
  return delay >= 0 && delay <= MAX_DELAY_MINUTES;
}

/** Marca el aviso como enviado hoy. Devuelve false si otra ejecución ya lo reclamó. */
async function claim(userId: string, column: "last_daily_on" | "last_weekly_on", date: string): Promise<boolean> {
  const { data, error } = await db()
    .from("notification_preferences")
    .update({ [column]: date })
    .eq("user_id", userId)
    .or(`${column}.is.null,${column}.neq.${date}`)
    .select("user_id");
  if (error) {
    console.error("[reminders] no se pudo reclamar el aviso", error);
    return false;
  }
  return Array.isArray(data) && data.length > 0;
}

async function loadPlanning(userId: string): Promise<Planning | null> {
  const { data, error } = await supabaseAdmin
    .from("planning")
    .select("user_id, data, imported_at")
    .eq("is_active", true)
    .or(`user_id.eq.${userId},user_id.is.null`)
    .order("imported_at", { ascending: false });
  if (error || !data?.length) return null;
  const own = data.find((row) => row.user_id === userId) ?? data[0];
  return (own?.data as unknown as Planning) ?? null;
}

function capitalize(value: string) {
  const lower = value.toLocaleLowerCase("es-ES");
  return lower.charAt(0).toLocaleUpperCase("es-ES") + lower.slice(1);
}

function firstLine(text: string, max = 90) {
  const line = text.split(/\r?\n/).map((l) => l.trim()).find(Boolean) ?? "";
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
}

export function dailyPayload(planning: Planning, date: string): PushPayload | null {
  const planned = buildPlanDateIndex(planning.months).get(date);
  if (!planned || planned.day.isRest || planned.day.blocks.length === 0) return null;

  const { month, week, day } = planned;
  const warmup = /^(WARM|CALENT|MOBIL|MOVIL|ZONA MEDIA)/i;
  const main = day.blocks.find((b) => !warmup.test(b.key) && b.content.trim()) ?? day.blocks[0];
  const preview = firstLine(main.content);
  return {
    title: `Hoy toca: ${capitalize(day.key)} · Semana ${week}`,
    body: preview ? `${main.key}: ${preview}` : `${day.blocks.length} bloques preparados.`,
    url: `/workout/${encodeURIComponent(month.key)}/${week}/${encodeURIComponent(day.key)}`,
    tag: `daily-${date}`,
  };
}

async function weeklyPayload(userId: string, now: Date): Promise<PushPayload> {
  const since = new Date(now.getTime() - 8 * 864e5).toISOString();
  const [{ data: results }, { data: history }] = await Promise.all([
    supabaseAdmin.from("workout_results").select("*").eq("user_id", userId).gte("updated_at", since),
    supabaseAdmin
      .from("personal_record_history")
      .select("*")
      .eq("user_id", userId)
      .gte("changed_at", since),
  ]);
  const stats = windowStats(
    (results ?? []) as unknown as WorkoutResult[],
    (history ?? []) as unknown as PrHistoryRow[],
    7,
  );
  const body =
    stats.sessions === 0
      ? "Esta semana no hay sesiones registradas. El lunes empieza otra."
      : [
          `${stats.sessions} ${stats.sessions === 1 ? "sesión" : "sesiones"}`,
          stats.volume > 0 ? `${fmtKg(stats.volume, 0)} movidos` : null,
          stats.prs > 0 ? `${stats.prs} PR` : null,
        ]
          .filter(Boolean)
          .join(" · ");
  return { title: "Tu semana de entreno", body, url: "/athlete-report", tag: "weekly-summary" };
}

export async function runReminders(now = new Date()) {
  const { data, error } = await db()
    .from("notification_preferences")
    .select("user_id, daily_enabled, daily_time, weekly_enabled, timezone, last_daily_on, last_weekly_on")
    .or("daily_enabled.eq.true,weekly_enabled.eq.true");
  if (error) {
    console.error("[reminders] no se pudieron leer las preferencias", error);
    return { checked: 0, daily: 0, weekly: 0 };
  }

  let daily = 0;
  let weekly = 0;
  const prefs = (data ?? []) as Preferences[];

  for (const pref of prefs) {
    try {
      const local = localNow(now, pref.timezone);

      if (pref.daily_enabled && isDue(local, pref.daily_time, pref.last_daily_on)) {
        if (await claim(pref.user_id, "last_daily_on", local.date)) {
          const planning = await loadPlanning(pref.user_id);
          const payload = planning ? dailyPayload(planning, local.date) : null;
          // Días de descanso o sin planificación: el día queda marcado y no se avisa.
          if (payload) {
            await deliver({ payload, onlyUserId: pref.user_id });
            daily += 1;
          }
        }
      }

      if (pref.weekly_enabled && local.weekday === "Sun" && isDue(local, WEEKLY_TIME, pref.last_weekly_on)) {
        if (await claim(pref.user_id, "last_weekly_on", local.date)) {
          await deliver({ payload: await weeklyPayload(pref.user_id, now), onlyUserId: pref.user_id });
          weekly += 1;
        }
      }
    } catch (e) {
      // Un perfil con problemas no debe impedir los avisos del resto.
      console.error("[reminders] error con un perfil", pref.user_id, e);
    }
  }

  return { checked: prefs.length, daily, weekly };
}
