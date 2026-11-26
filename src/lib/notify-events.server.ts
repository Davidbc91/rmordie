/**
 * Avisos por eventos: comentarios del entrenador, planificación compartida o
 * actualizada, récords de atletas, retos, semana redonda, atletas sin entrenar
 * y resumen semanal del entrenador. SOLO servidor; lo lanza la tarea de cada
 * 15 minutos junto con los recordatorios.
 *
 * Cada aviso se anota en notification_log antes de enviarse, así que nunca se
 * repite aunque la tarea corra varias veces. En horas de silencio no se anota
 * ni se envía: queda para la siguiente ejecución fuera de ese horario.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { deliver, type PushPayload } from "./push.server";
import { localNow } from "./reminders.server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => supabaseAdmin as any;

const LOOKBACK_H = 14;
const DEFAULT_TZ = "Europe/Madrid";

type Prefs = {
  timezone: string;
  quiet_start: string;
  quiet_end: string;
  round_enabled: boolean;
  challenges_enabled: boolean;
  comments_enabled: boolean;
  plan_enabled: boolean;
  coach_prs_enabled: boolean;
  coach_idle_enabled: boolean;
  coach_weekly_enabled: boolean;
  coach_injury_enabled: boolean;
};
const DEFAULTS: Prefs = {
  timezone: DEFAULT_TZ, quiet_start: "22:00", quiet_end: "08:00",
  round_enabled: true, challenges_enabled: true, comments_enabled: true, plan_enabled: true,
  coach_prs_enabled: true, coach_idle_enabled: true, coach_weekly_enabled: true, coach_injury_enabled: true,
};
type PrefKey = Exclude<keyof Prefs, "timezone" | "quiet_start" | "quiet_end">;

const toMin = (hhmm: string) => { const [h, m] = hhmm.split(":").map(Number); return (h || 0) * 60 + (m || 0); };
function quiet(minutes: number, start: string, end: string) {
  const s = toMin(start), e = toMin(end);
  if (s === e) return false;
  return s < e ? minutes >= s && minutes < e : minutes >= s || minutes < e;
}
const addDays = (iso: string, n: number) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const mondayOf = (iso: string) => { const d = new Date(`${iso}T12:00:00Z`); return addDays(iso, -((d.getUTCDay() + 6) % 7)); };
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 864e5);
const localDate = (ts: string, tz: string) => localNow(new Date(ts), tz).date;
const kg = (n: number) => String(Math.round(n * 10) / 10).replace(".", ",");

export async function runEventNotifications(now = new Date()) {
  const counts: Record<string, number> = {};
  const since = new Date(now.getTime() - LOOKBACK_H * 3600e3).toISOString();

  // Solo merece la pena avisar a quien tiene algún dispositivo con avisos
  const { data: subs } = await db().from("push_subscriptions").select("user_id");
  const reachable = new Set<string>((subs ?? []).map((s: any) => s.user_id));
  if (!reachable.size) return counts;

  const { data: prefRows } = await db().from("notification_preferences").select("*").in("user_id", [...reachable]);
  const prefs = new Map<string, Prefs>();
  for (const u of reachable) prefs.set(u, { ...DEFAULTS });
  for (const r of prefRows ?? []) prefs.set(r.user_id, { ...DEFAULTS, ...Object.fromEntries(Object.entries(r).filter(([, v]) => v != null)) } as Prefs);

  const { data: profs } = await db().from("profiles").select("id, name");
  const nameOf = new Map<string, string>((profs ?? []).map((p: any) => [p.id, p.name]));
  const name = (id: string) => nameOf.get(id) ?? "Alguien";

  /** Envía una vez (por usuario, tipo y referencia), respetando el interruptor y el silencio. */
  async function send(userId: string, key: PrefKey, kind: string, ref: string, payload: PushPayload) {
    if (!reachable.has(userId)) return false;
    const p = prefs.get(userId) ?? DEFAULTS;
    if (!p[key]) return false;
    const local = localNow(now, p.timezone || DEFAULT_TZ);
    if (quiet(local.minutes, p.quiet_start, p.quiet_end)) return false;
    const { data, error } = await db().from("notification_log")
      .upsert({ user_id: userId, kind, ref }, { onConflict: "user_id,kind,ref", ignoreDuplicates: true })
      .select("user_id");
    if (error || !data?.length) return false;
    await deliver({ payload, onlyUserId: userId });
    counts[kind] = (counts[kind] ?? 0) + 1;
    return true;
  }
  const localFor = (u: string) => localNow(now, prefs.get(u)?.timezone || DEFAULT_TZ);

  const safe = async (label: string, fn: () => Promise<void>) => {
    try { await fn(); } catch (e) { console.error(`[avisos] ${label}`, e); }
  };

  // 1) Comentarios del entrenador
  await safe("comentarios", async () => {
    const { data } = await db().from("workout_comments").select("*").gte("created_at", since);
    for (const c of data ?? []) {
      await send(c.athlete_id, "comments_enabled", "comment", c.id, {
        title: `${name(c.coach_id)} te ha comentado el entreno`,
        body: c.body.length > 140 ? `${c.body.slice(0, 137)}…` : c.body,
        url: `/workout/${encodeURIComponent(c.month_key)}/${c.week}/${encodeURIComponent(c.day_key)}`,
        tag: `comment-${c.id}`,
      });
    }
  });

  // 2) Planificación compartida o actualizada
  await safe("planificaciones", async () => {
    const { data: newShares } = await db().from("planning_shares").select("owner_id, recipient_id, plan_key, created_at").gte("created_at", since);
    for (const s of newShares ?? []) {
      await send(s.recipient_id, "plan_enabled", "plan_shared", String(s.plan_key), {
        title: `${name(s.owner_id)} te ha compartido una planificación`,
        body: "Ya la tienes en tu calendario. Toca para verla.",
        url: "/", tag: `plan-${s.plan_key}`,
      });
    }
    const { data: versions } = await db().from("planning").select("id, plan_key, user_id, version, imported_at").gte("imported_at", since).gt("version", 1);
    for (const v of versions ?? []) {
      if (!v.plan_key) continue;
      const { data: rec } = await db().from("planning_shares").select("recipient_id, created_at").eq("plan_key", v.plan_key).eq("owner_id", v.user_id);
      for (const r of rec ?? []) {
        if (new Date(r.created_at) > new Date(v.imported_at)) continue; // recién compartida: ya avisada arriba
        const day = localFor(r.recipient_id).date;
        await send(r.recipient_id, "plan_enabled", "plan_updated", `${v.plan_key}:${day}`, {
          title: "Tu planificación se ha actualizado",
          body: `${name(v.user_id)} ha hecho cambios. Lo que ya entrenaste se queda igual.`,
          url: "/calendar", tag: `plan-${v.plan_key}`,
        });
      }
    }
  });

  // Entrenadores y sus atletas con permiso
  const { data: access } = await db().from("coach_access").select("coach_id, athlete_id").eq("allowed", true);
  const coachesOf = new Map<string, string[]>();
  const athletesOf = new Map<string, string[]>();
  for (const a of access ?? []) {
    coachesOf.set(a.athlete_id, [...(coachesOf.get(a.athlete_id) ?? []), a.coach_id]);
    athletesOf.set(a.coach_id, [...(athletesOf.get(a.coach_id) ?? []), a.athlete_id]);
  }

  // 3) Récords de los atletas → su entrenador
  await safe("récords", async () => {
    const athletes = [...coachesOf.keys()];
    if (!athletes.length) return;
    const { data } = await db().from("personal_record_history").select("id, user_id, exercise, rep_max, new_weight, previous_weight, changed_at").in("user_id", athletes).gte("changed_at", since);
    for (const h of data ?? []) {
      for (const coach of coachesOf.get(h.user_id) ?? []) {
        const up = h.previous_weight ? ` (+${kg(Number(h.new_weight) - Number(h.previous_weight))} kg)` : "";
        await send(coach, "coach_prs_enabled", "coach_pr", h.id, {
          title: `🔥 ${name(h.user_id)} ha batido un récord`,
          body: `${h.exercise}${h.rep_max && h.rep_max > 1 ? ` ${h.rep_max}RM` : ""}: ${kg(Number(h.new_weight))} kg${up}`,
          url: `/entrenador?a=${h.user_id}`, tag: `coach-pr-${h.id}`,
        });
      }
    }
  });

  // 3b) Molestias fuertes (4 o 5) → su entrenador
  await safe("molestias", async () => {
    const athletes = [...coachesOf.keys()];
    if (!athletes.length) return;
    const { data } = await db().from("injuries").select("id, user_id, zone, side, level, status, updated_at").in("user_id", athletes).eq("status", "active").gte("level", 4).gte("updated_at", since);
    const ZL: Record<string, string> = { cuello: "cuello", hombro: "hombro", codo: "codo", muneca: "muñeca", lumbar: "lumbar", cadera: "cadera", rodilla: "rodilla", tobillo: "tobillo" };
    const SL: Record<string, string> = { left: " izquierdo", right: " derecho", both: " (los dos)", none: "" };
    for (const i of data ?? []) {
      for (const coach of coachesOf.get(i.user_id) ?? []) {
        await send(coach, "coach_injury_enabled", "coach_injury", `${i.id}:${i.level}`, {
          title: `🩹 ${name(i.user_id)}: molestia fuerte`,
          body: `${(ZL[i.zone] ?? i.zone)}${SL[i.side] ?? ""} · ${i.level}/5. Quizá convenga adaptar su plan.`,
          url: `/entrenador?a=${i.user_id}`, tag: `coach-injury-${i.id}`,
        });
      }
    }
  });

  // Días entrenados por usuario (últimas 3 semanas), en su zona horaria
  const trainedBy = new Map<string, Set<string>>();
  await safe("entrenos", async () => {
    const from = new Date(now.getTime() - 21 * 864e5).toISOString().slice(0, 10);
    const { data } = await db().from("workout_results").select("user_id, trained_on, updated_at, status").eq("status", "completed").or(`trained_on.gte.${from},updated_at.gte.${from}`);
    for (const r of data ?? []) {
      const d = r.trained_on ?? localDate(r.updated_at, prefs.get(r.user_id)?.timezone || DEFAULT_TZ);
      if (!trainedBy.has(r.user_id)) trainedBy.set(r.user_id, new Set());
      trainedBy.get(r.user_id)!.add(d);
    }
  });

  // 4) Semana redonda: te queda 1 día (de miércoles a domingo, a partir de las 18:00)
  await safe("semana redonda", async () => {
    const { data: targets } = await db().from("athlete_profile").select("user_id, weekly_target");
    const targetOf = new Map<string, number>((targets ?? []).map((t: any) => [t.user_id, Number(t.weekly_target) || 4]));
    for (const u of reachable) {
      const local = localFor(u);
      const wd = (new Date(`${local.date}T12:00:00Z`).getUTCDay() + 6) % 7; // 0 = lunes
      if (wd < 2 || local.minutes < 18 * 60) continue;
      const monday = mondayOf(local.date);
      const days = trainedBy.get(u) ?? new Set<string>();
      if (days.has(local.date)) continue; // hoy ya entrenó
      const target = targetOf.get(u) ?? 4;
      const done = Array.from({ length: 7 }, (_, i) => addDays(monday, i)).filter((d) => days.has(d)).length;
      if (target < 2 || done !== target - 1) continue;
      await send(u, "round_enabled", "round", monday, {
        title: "Te queda 1 día para la semana redonda",
        body: `Llevas ${done} de ${target}. ${wd === 6 ? "Hoy" : "Antes del domingo"} la cierras.`,
        url: "/", tag: `round-${monday}`,
      });
    }
  });

  // 5) Retos: te adelantan, quedan 3 días y resultado final
  await safe("retos", async () => {
    const today = localNow(now, DEFAULT_TZ).date;
    const { data: chs } = await db().from("challenges").select("*").gte("ends_on", addDays(today, -3)).lte("starts_on", today);
    for (const c of chs ?? []) {
      const { data: board } = await db().rpc("challenge_scores_admin", { p_challenge: c.id });
      const rows = (board ?? []) as { profile_id: string; name: string; score: number }[];
      if (!rows.length) continue;
      const rankOf = new Map(rows.map((r, i) => [r.profile_id, i + 1]));
      const unit = c.metric === "days" ? "días" : c.metric === "volume" ? "kg" : c.metric === "prs" ? "récords" : "semanas";
      const active = today >= c.starts_on && today <= c.ends_on;
      const left = daysBetween(today, c.ends_on) + 1;

      if (active) {
        const { data: prev } = await db().from("challenge_rank_state").select("profile_id, rank").eq("challenge_id", c.id);
        const prevRank = new Map<string, number>((prev ?? []).map((p: any) => [p.profile_id, p.rank]));
        const keep = new Set<string>(); // en silencio: se compara más tarde con el puesto de antes
        for (const r of rows) {
          const before = prevRank.get(r.profile_id);
          const now_ = rankOf.get(r.profile_id)!;
          if (before != null && now_ > before) {
            const ahead = rows[now_ - 2];
            const p = prefs.get(r.profile_id);
            const loc = localFor(r.profile_id);
            if (p && quiet(loc.minutes, p.quiet_start, p.quiet_end)) { keep.add(r.profile_id); continue; }
            await send(r.profile_id, "challenges_enabled", "challenge_overtaken", `${c.id}:${loc.date}`, {
              title: `${ahead ? shortName(ahead.name) : "Alguien"} te ha adelantado en el reto`,
              body: `${c.title}: ahora vas ${now_}º con ${fmt(r.score, c.metric)} ${unit}. ${left > 1 ? `Quedan ${left} días.` : "Hoy es el último día."}`,
              url: "/social", tag: `challenge-${c.id}`,
            });
          }
        }
        const upd = rows.filter((r) => !keep.has(r.profile_id)).map((r) => ({ challenge_id: c.id, profile_id: r.profile_id, rank: rankOf.get(r.profile_id), score: r.score, updated_at: now.toISOString() }));
        if (upd.length) await db().from("challenge_rank_state").upsert(upd, { onConflict: "challenge_id,profile_id" });

        if (left === 3) {
          for (const r of rows) {
            if (localFor(r.profile_id).minutes < 10 * 60) continue;
            await send(r.profile_id, "challenges_enabled", "challenge_3days", c.id, {
              title: `Quedan 3 días del reto`,
              body: `${c.title}: vas ${rankOf.get(r.profile_id)}º de ${rows.length} con ${fmt(r.score, c.metric)} ${unit}.`,
              url: "/social", tag: `challenge-${c.id}`,
            });
          }
        }
      } else if (today > c.ends_on) {
        for (const r of rows) {
          if (localFor(r.profile_id).minutes < 10 * 60) continue;
          const pos = rankOf.get(r.profile_id)!;
          await send(r.profile_id, "challenges_enabled", "challenge_end", c.id, {
            title: pos === 1 && r.score > 0 ? "🏆 ¡Has ganado el reto!" : `Reto terminado: quedaste ${pos}º`,
            body: `${c.title}: ${fmt(r.score, c.metric)} ${unit}${c.goal && r.score >= Number(c.goal) ? " · meta cumplida ✓" : ""}.`,
            url: "/social", tag: `challenge-${c.id}`,
          });
        }
      }
    }
  });

  // 6) y 7) Entrenador: atletas sin entrenar (10:00) y resumen del domingo (20:00)
  await safe("entrenador", async () => {
    for (const [coach, athletes] of athletesOf) {
      const local = localFor(coach);
      if (local.minutes >= 10 * 60) {
        const idle = athletes
          .map((a) => {
            const last = [...(trainedBy.get(a) ?? [])].sort().pop();
            return { a, days: last ? daysBetween(last, local.date) : null };
          })
          .filter((x) => x.days != null && [4, 7, 14].includes(x.days));
        if (idle.length) {
          await send(coach, "coach_idle_enabled", "coach_idle", local.date, {
            title: idle.length === 1 ? `${name(idle[0].a)} lleva ${idle[0].days} días sin entrenar` : `${idle.length} atletas llevan varios días sin entrenar`,
            body: idle.length === 1 ? "Quizá le venga bien un mensaje tuyo." : idle.map((x) => `${name(x.a)} (${x.days} d)`).join(", "),
            url: idle.length === 1 ? `/entrenador?a=${idle[0].a}` : "/entrenador", tag: "coach-idle",
          });
        }
      }
      const wd = new Date(`${local.date}T12:00:00Z`).getUTCDay();
      if (wd === 0 && local.minutes >= 20 * 60) {
        const monday = mondayOf(local.date);
        const week = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
        const trained = athletes.filter((a) => week.some((d) => trainedBy.get(a)?.has(d)));
        const { data: prs } = await db().from("personal_record_history").select("id").in("user_id", athletes).gte("changed_at", `${monday}T00:00:00Z`);
        const none = athletes.filter((a) => !trained.includes(a));
        await send(coach, "coach_weekly_enabled", "coach_weekly", local.date, {
          title: "La semana de tus atletas",
          body: [`${trained.length} de ${athletes.length} han entrenado`, prs?.length ? `${prs.length} récords` : null, none.length ? `sin entrenar: ${none.map(name).join(", ")}` : null].filter(Boolean).join(" · "),
          url: "/entrenador", tag: "coach-weekly",
        });
      }
    }
  });

  return counts;
}

function shortName(n: string) { const p = n.trim().split(/\s+/); return p.length > 1 ? `${p[0]} ${p[1][0]}.` : p[0]; }
function fmt(n: number, metric: string) {
  const v = Number(n) || 0;
  return metric === "volume" ? Math.round(v).toLocaleString("es-ES") : String(Math.round(v * 10) / 10).replace(".", ",");
}
