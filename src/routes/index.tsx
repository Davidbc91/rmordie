import { createFileRoute, Link } from "@tanstack/react-router";
import { WeekCard } from "@/components/week/Week";
import { CoachCommentsCard } from "@/components/coach/CoachAthleteSide";
import { usePlanning, useAllResults, usePersonalRecords, type PersonalRecord } from "@/lib/store";
import { useAthleteProfile, useAllPrHistory, useWellnessLogs } from "@/lib/profile-store";
import { sessionDays, volumeOf, fmtKg, trainedAt, trainedDay } from "@/lib/analytics";
import { extractPercentages } from "@/lib/plates";
import { detectExercise, loadsForPercentages, formatKg } from "@/lib/rm-matcher";
import { GlassCard } from "@/components/glass";
import { Upload, Trophy, ChevronRight, Play, CalendarDays, Share2 } from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  completedBlockMap,
  isSessionCompleted,
  sessionProgress,
} from "@/lib/session-progress";
import { Moon, Camera } from "lucide-react";
import { getCurrentUserId } from "@/lib/pin-gate";
import { challengeState, fmtScore, useChallenges, useLeaderboard } from "@/lib/challenges";
import { useMedals } from "@/lib/use-medals";
import { nextMedal } from "@/lib/medals";
import { buildPlanDateIndex, findMonthIndexForDate, isoKey, weekdayOf } from "@/lib/plan-dates";



export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Inicio — RMORDIE" },
      { name: "description", content: "Tu panel de entrenamiento: entreno de hoy, progreso mensual, récords y constancia." },
      { property: "og:title", content: "RMORDIE — Panel del atleta" },
      { property: "og:description", content: "Entreno de hoy, progreso, récords y constancia en una sola pantalla." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

const MONTH_ABBR = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
const WEEKDAY_KEYS = ["DOMINGO", "LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES", "SABADO"];

function normalizeDayKey(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
}

function Home() {
  const navigate = Route.useNavigate();
  const [analyticsReady, setAnalyticsReady] = useState(false);

  useEffect(() => {
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    const ready = () => setAnalyticsReady(true);
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(ready, { timeout: 1200 });
      return () => w.cancelIdleCallback?.(id);
    }
    const id = window.setTimeout(ready, 120);
    return () => window.clearTimeout(id);
  }, []);
  const { data: planning, isLoading, isError, refetch } = usePlanning();
  const { data: results = [] } = useAllResults();
  const { data: records = [] } = usePersonalRecords();
  const { data: profile } = useAthleteProfile();
  const { data: prHistory = [] } = useAllPrHistory();
  const { data: wellnessLogs = [] } = useWellnessLogs();
  const deferredResults = useDeferredValue(results);
  const deferredRecords = useDeferredValue(records);
  const deferredPlanning = useDeferredValue(planning);
  const deferredPrHistory = useDeferredValue(prHistory);
  const deferredWellnessLogs = useDeferredValue(wellnessLogs);


  const blockMap = useMemo(() => completedBlockMap(results), [results]);

  // Hoy según las fechas reales del plan (año incluido), no solo por el nombre del mes.
  const todayPlan = useMemo(() => {
    if (!planning) return null;
    const hit = buildPlanDateIndex(planning.data.months).get(isoKey(new Date()));
    if (!hit) return null;
    const week = hit.month.weeks.find((w) => w.index === hit.week);
    if (!week) return null;
    return { month: hit.month, week, day: hit.day, progress: sessionProgress(hit.day, hit.month.key, hit.week, blockMap) };
  }, [planning, blockMap]);

  const next = useMemo(() => {
    if (!planning) return null;
    const months = planning.data.months;
    const now = new Date();
    const startIdx = Math.max(0, findMonthIndexForDate(months, now));
    const currentMonth = months[startIdx];
    const order = [...months.slice(startIdx), ...months.slice(0, startIdx)];
    const pick = (() => {
      // Con fechas: el siguiente por orden de calendario (aunque se hayan movido días)
      const todayIso = isoKey(now);
      const byDate = [...buildPlanDateIndex(months).entries()].sort(([a], [b]) => a.localeCompare(b));
      for (const [iso, pd] of byDate) {
        if (iso < todayIso || pd.day.isRest) continue;
        if (sessionProgress(pd.day, pd.month.key, pd.week, blockMap).state === "completed") continue;
        const w = pd.month.weeks.find((x) => x.index === pd.week);
        if (!w) continue;
        return { m: pd.month, w, d: pd.day, isToday: iso === todayIso };
      }
      for (const m of order) {
        const days = m.weeks.flatMap((w) => w.days.map((d) => ({ d, w })));
        const todayIndex = currentMonth && todayPlan?.month.key === m.key
          ? days.findIndex(({ d, w }) => d.key === todayPlan.day.key && w.index === todayPlan.week.index)
          : -1;
        const candidates = todayIndex >= 0 ? days.slice(todayIndex) : days;
        for (const { d, w } of candidates) {
          if (d.isRest) continue;
          const prog = sessionProgress(d, m.key, w.index, blockMap);
          if (prog.state === "completed") continue;
          const isToday = !!todayPlan && todayPlan.month.key === m.key && todayPlan.week.index === w.index && todayPlan.day.key === d.key;
          return { m, w, d, isToday };
        }
      }
      return null;
    })();

    if (!pick) return null;
    const { m, w, d, isToday } = pick;
    const prog = sessionProgress(d, m.key, w.index, blockMap);
    const headline =
      d.blocks.find((b) => /^[A-D]$/.test(b.key))?.content.split("\n")[0] ??
      d.blocks[0]?.content.split("\n")[0] ??
      "Sesión";

    const focus = d.blocks
      .filter((b) => /^[A-D]$/.test(b.key))
      .flatMap((b) => {
        const record = detectExercise(b.content, records);
        if (!record) return [];
        const percentages = extractPercentages(b.content);
        const loads = percentages.length ? loadsForPercentages(record.weight, percentages) : [];
        return [{ exercise: record.exercise, rm: record.weight, percentages, loads, block: b.key }];
      })
      .filter((item, index, arr) => arr.findIndex((x) => x.exercise === item.exercise) === index)
      .slice(0, 3);

    return {
      monthKey: m.key,
      monthLabel: m.label,
      week: w.index,
      dayKey: d.key,
      dayLabel: d.date ? weekdayOf(d.date) : d.key,
      date: d.date ?? null,
      blockList: d.blocks.map((b) => ({ key: b.key, content: b.content })),
      headline,
      blocks: d.blocks.length,
      progress: prog,
      isToday,
      focus,
    };
  }, [planning, blockMap, records, todayPlan]);

  const weekProgress = useMemo(() => {
    if (!analyticsReady || !deferredPlanning || !next) return null;
    const m = deferredPlanning.data.months.find((x) => x.key === next.monthKey);
    const w = m?.weeks.find((x) => x.index === next.week);
    if (!m || !w) return null;
    const train = w.days.filter((d) => !d.isRest);
    const done = train.filter((d) => isSessionCompleted(d, m.key, w.index, blockMap)).length;
    return { done, total: train.length };
  }, [analyticsReady, deferredPlanning, next, blockMap]);

  const weeklyTarget = profile?.weekly_target ?? 4;
  // Semana de calendario (lunes a domingo) y la anterior, para comparar kilos
  const calWeek = useMemo(() => {
    const today = new Date();
    const monday = new Date(today);
    monday.setHours(12, 0, 0, 0);
    monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(monday); d.setDate(monday.getDate() + i); return isoKey(d); });
    const prevStart = new Date(monday); prevStart.setDate(monday.getDate() - 7);
    const prevStartIso = isoKey(prevStart);
    const trained = new Set(sessionDays(deferredResults));
    const sumVol = (from: string, to: string) => deferredResults.filter((r) => r.status === "completed" && trainedDay(r) >= from && trainedDay(r) <= to).reduce((a, r) => a + volumeOf(r), 0);
    const volume = sumVol(days[0], days[6]);
    const prev = sumVol(prevStartIso, isoKey(new Date(monday.getTime() - 864e5)));
    const sessions = days.filter((d) => trained.has(d)).length;
    return { days, trained, volume, delta: prev > 0 && volume > 0 ? Math.round(((volume - prev) / prev) * 100) : null, sessions };
  }, [deferredResults]);

  const recentPrCount = useMemo(() => analyticsReady ? deferredPrHistory.filter((h) => Date.now() - new Date(h.changed_at).getTime() <= 30 * 864e5).length : 0, [analyticsReady, deferredPrHistory]);

  const smartState = useMemo(() => {
    if (!analyticsReady) return { title: "Analizando tu rendimiento…", detail: "", sessions: 0, volume: 0, avgRpe: null as number | null };
    const cutoff = Date.now() - 7 * 864e5;
    const recent = deferredResults.filter((r) => r.status === "completed" && new Date(trainedAt(r)).getTime() >= cutoff);
    const rpes = recent.map((r) => r.rpe).filter((x): x is number => x != null);
    const avgRpe = rpes.length ? rpes.reduce((a, b) => a + b, 0) / rpes.length : null;
    const volume = recent.reduce((sum, r) => sum + volumeOf(r), 0);
    const sessions = new Set(recent.map((r) => `${r.month_key}|${r.week}|${r.day_key}`)).size;
    let title = "Empieza a registrar tu rendimiento";
    let detail = "Con unas cuantas sesiones apuntadas podré leer tu carga y tu recuperación.";
    if (sessions >= 3 && avgRpe != null) {
      if (avgRpe >= 9) { title = "Semana exigente"; detail = `RPE medio ${avgRpe.toFixed(1)}. Vigila la recuperación antes de añadir carga.`; }
      else if (avgRpe <= 7) { title = "Buen margen esta semana"; detail = `RPE medio ${avgRpe.toFixed(1)}. Hay margen para progresar si la técnica acompaña.`; }
      else { title = "Carga bien controlada"; detail = `RPE medio ${avgRpe.toFixed(1)} con ${sessions} sesiones en 7 días.`; }
    } else if (sessions > 0) {
      title = `${sessions} ${sessions === 1 ? "sesión" : "sesiones"} en 7 días`;
      detail = "Apunta el RPE de tus series para afinar la lectura.";
    }
    return { title, detail, sessions, volume, avgRpe };
  }, [analyticsReady, deferredResults]);

  const dashboardTrend = useMemo(() => {
    if (!analyticsReady) return { weeks: [] as { label: string; volume: number }[], volumeChange: null as number | null, latestWellness: undefined as (typeof wellnessLogs)[number] | undefined };
    const weeks = Array.from({ length: 8 }, (_, i) => {
      const end = new Date(); end.setHours(23, 59, 59, 999); end.setDate(end.getDate() - (7 - i) * 7);
      const start = new Date(end); start.setDate(end.getDate() - 6); start.setHours(0, 0, 0, 0);
      const rows = deferredResults.filter((r) => r.status === "completed" && new Date(trainedAt(r)) >= start && new Date(trainedAt(r)) <= end);
      return { label: `S${i + 1}`, volume: rows.reduce((sum, r) => sum + volumeOf(r), 0) };
    });
    const withVolume = weeks.filter((w) => w.volume > 0);
    const first = withVolume[0]?.volume ?? null;
    const last = withVolume.at(-1)?.volume ?? null;
    const volumeChange = first && last && first > 0 && withVolume.length > 1 ? ((last - first) / first) * 100 : null;
    const latestWellness = [...deferredWellnessLogs].sort((a, b) => b.logged_on.localeCompare(a.logged_on))[0];
    return { weeks, volumeChange, latestWellness };
  }, [analyticsReady, deferredResults, deferredWellnessLogs]);

  const recentPrs = useMemo(() => {
    if (!analyticsReady) return [];
    if (deferredPrHistory.length) {
      return [...deferredPrHistory].sort((a, b) => new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime()).slice(0, 3);
    }
    return [...deferredRecords]
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, 3)
      .map((record) => ({ ...record, changed_at: record.updated_at, new_weight: record.weight }));
  }, [analyticsReady, deferredPrHistory, deferredRecords]);

  // Lo que se hizo hoy (si ya está completado)
  const todayDone = useMemo(() => {
    if (!todayPlan || todayPlan.progress.state !== "completed") return null;
    const rows = results.filter((r) => r.month_key === todayPlan.month.key && r.week === todayPlan.week.index && r.day_key === todayPlan.day.key && r.status === "completed");
    const rpes = rows.map((r) => r.rpe).filter((x): x is number => x != null);
    const todayIso = isoKey(new Date());
    return {
      volume: rows.reduce((a, r) => a + volumeOf(r), 0),
      rpe: rpes.length ? Math.max(...rpes) : null,
      prs: prHistory.filter((h) => isoKey(new Date(h.changed_at)) === todayIso).length,
    };
  }, [todayPlan, results, prHistory]);

  const planIndex = useMemo(() => (planning ? buildPlanDateIndex(planning.data.months) : null), [planning]);
  const maxTrend = Math.max(1, ...dashboardTrend.weeks.map((w) => w.volume));

  return (
    <div className="page-enter flex flex-col gap-4">
      {isLoading && <DashboardLoading />}
      {isError && !planning && !isLoading && <PlanningError onRetry={() => void refetch()} />}
      {!planning && !isLoading && !isError && <EmptyState />}

      {/* 1 · Tu semana de un vistazo */}
      <div className="rise rise-1 -mt-1 grid grid-cols-7 gap-1">
        {calWeek.days.map((iso, i) => {
          const isToday = iso === isoKey(new Date());
          const done = calWeek.trained.has(iso);
          const pd = planIndex?.get(iso);
          const rest = !done && (!pd || pd.day.isRest);
          const body = (
            <>
              <span
                className="grid h-10 w-10 place-items-center rounded-full text-[14px] font-bold"
                style={
                  done ? { background: "#333B18", color: "var(--gold)" }
                  : isToday ? { border: "2px solid var(--foreground)", color: "var(--foreground)" }
                  : { background: "rgba(255,255,255,.08)", color: "var(--muted-foreground)", opacity: rest ? 0.45 : 1 }
                }
              >
                {"LMXJVSD"[i]}
              </span>
              <span className="text-[11px] font-semibold text-muted-foreground" style={{ opacity: rest && !isToday ? 0.6 : 1 }}>{Number(iso.slice(8))}</span>
            </>
          );
          return pd && !pd.day.isRest ? (
            <Link key={iso} to="/workout/$month/$week/$day" params={{ month: pd.month.key, week: String(pd.week), day: pd.day.key }} aria-label={`Entreno del ${weekdayOf(iso).toLowerCase()}`} className="pressable flex flex-col items-center gap-1">{body}</Link>
          ) : (
            <span key={iso} className="flex flex-col items-center gap-1">{body}</span>
          );
        })}
      </div>

      {/* 2 · Hoy */}
      {planning && <TodayCard next={next} todayPlan={todayPlan} todayDone={todayDone} weekProgress={weekProgress} records={records} />}

      <CoachCommentsCard />

      {/* 3 · Semana pasada (hasta que la cierras) */}
      <WeekCard />

      {planning && (
        <>
          {/* 4 · Tu progreso */}
          <section className="rise rise-3 flex flex-col gap-2">
            <div className="flex items-baseline justify-between px-1">
              <h2 className="text-[17px] font-extrabold tracking-tight">Tu progreso</h2>
              <Link to="/profile" className="text-[13px] font-semibold text-muted-foreground">Perfil ›</Link>
            </div>
            <div className="grid grid-cols-3 overflow-hidden rounded-[22px] bg-card">
              <button type="button" onClick={() => navigate({ to: "/semana" })} className="pressable flex flex-col items-center gap-0.5 px-1 py-3">
                <span className="num text-[30px] leading-none">{calWeek.sessions}<span className="text-[14px] text-muted-foreground">/{weeklyTarget}</span></span>
                <span className="text-[12px] text-muted-foreground">esta semana</span>
              </button>
              <button type="button" onClick={() => navigate({ to: "/semana" })} className="pressable flex flex-col items-center gap-0.5 border-l border-white/[0.06] px-1 py-3">
                <span className="num text-[30px] leading-none">{calWeek.volume > 0 ? fmtTons(calWeek.volume) : "—"}</span>
                {calWeek.delta != null ? (
                  <span className="text-[11.5px] font-bold" style={{ color: calWeek.delta >= 0 ? "var(--gold)" : "#FF8A3D" }}>{calWeek.delta >= 0 ? "▲" : "▼"} {Math.abs(calWeek.delta)} %</span>
                ) : <span className="text-[12px] text-muted-foreground">kilos semana</span>}
              </button>
              <button type="button" onClick={() => navigate({ to: "/records" })} className="pressable flex flex-col items-center gap-0.5 border-l border-white/[0.06] px-1 py-3">
                <span className={`num text-[30px] leading-none ${recentPrCount > 0 ? "text-gold" : ""}`}>{recentPrCount > 0 ? recentPrCount : "—"}</span>
                <span className="text-[12px] text-muted-foreground">PR en 30 días</span>
              </button>
            </div>
          </section>

          {/* 5 · Reto y medalla */}
          <ChallengeAndMedal />

          {/* 6 · Cómo vas */}
          <button type="button" onClick={() => navigate({ to: "/profile", search: { section: "performance" } })} className="rise rise-4 pressable flex w-full flex-col gap-3 rounded-[24px] bg-card p-4 text-left">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[15.5px] font-bold">Cómo vas</span>
              {dashboardTrend.volumeChange != null && (
                <span className="text-[12px] font-bold" style={{ color: dashboardTrend.volumeChange >= 0 ? "var(--gold)" : "#FF8A3D" }}>
                  Carga {dashboardTrend.volumeChange >= 0 ? "▲" : "▼"} {Math.abs(dashboardTrend.volumeChange).toFixed(0)} % en 8 semanas
                </span>
              )}
            </div>
            <div className="-mt-1.5">
              <p className="text-[14.5px] font-semibold">{smartState.title}</p>
              {smartState.detail && <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">{smartState.detail}</p>}
            </div>
            <div className="flex h-[84px] items-end gap-1.5" aria-label="Carga de las últimas 8 semanas">
              {dashboardTrend.weeks.map((w, i) => (
                <span key={w.label} className="flex-1 rounded-[6px_6px_3px_3px]" style={{ height: `${Math.max(6, (w.volume / maxTrend) * 100)}%`, background: i === dashboardTrend.weeks.length - 1 ? "var(--gold)" : "rgba(255,255,255,.09)" }} />
              ))}
            </div>
            <div className="flex justify-between gap-2 text-[13px] text-muted-foreground">
              <span><b className="text-foreground">{smartState.avgRpe != null ? smartState.avgRpe.toFixed(1) : "—"}</b> RPE medio</span>
              {dashboardTrend.latestWellness ? (
                <>
                  <span><b className="text-foreground">{dashboardTrend.latestWellness.sleep_hours != null ? `${dashboardTrend.latestWellness.sleep_hours} h` : "—"}</b> sueño</span>
                  <span><b className="text-foreground">{dashboardTrend.latestWellness.energy ?? "—"}</b> energía</span>
                </>
              ) : (
                <>
                  <span><b className="text-foreground">{smartState.sessions}</b> sesiones (7 d)</span>
                  <span><b className="text-foreground">{smartState.volume > 0 ? fmtKg(smartState.volume, 0) : "—"}</b></span>
                </>
              )}
            </div>
          </button>

          {/* 7 · Últimos récords */}
          <section className="rise rise-5 flex flex-col gap-2">
            <div className="flex items-baseline justify-between px-1">
              <h2 className="text-[17px] font-extrabold tracking-tight">Últimos récords</h2>
              <Link to="/records" className="text-[13px] font-semibold text-muted-foreground">Ver todos ›</Link>
            </div>
            {recentPrs.length > 0 ? (
              <div className="flex flex-col rounded-[24px] bg-card px-4 py-1">
                {recentPrs.map((r, i) => (
                  <Link key={r.id} to="/records" className={`pressable flex min-h-[62px] items-center gap-3 py-2.5 ${i > 0 ? "border-t border-white/[0.06]" : ""}`}>
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px]" style={{ background: "#333B18", color: "var(--gold)" }}><Trophy className="h-[18px] w-[18px]" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-bold">{r.exercise}</span>
                      <span className="block text-[13px] text-muted-foreground">{r.rep_max ? `${r.rep_max}RM` : "RM"} · {new Date(r.changed_at).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}</span>
                    </span>
                    <span className="num shrink-0 text-[24px] text-gold">{formatKg(Number(r.new_weight))}<span className="ml-1 text-[13px] text-muted-foreground">kg</span></span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="rounded-[20px] bg-card px-4 py-5 text-sm text-muted-foreground">Cuando registres una nueva marca personal, aparecerá aquí.</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}

const fmtTons = (kg: number) => (kg >= 1000 ? `${(Math.round(kg / 100) / 10).toString().replace(".", ",")} t` : `${Math.round(kg)}`);
const cap = (s: string) => { const l = s.toLowerCase(); return l.charAt(0).toUpperCase() + l.slice(1); };

type NextInfo = { monthKey: string; monthLabel: string; week: number; dayKey: string; dayLabel: string; date: string | null; headline: string; blocks: number; blockList: { key: string; content: string }[]; progress: { done: number; total: number; pct: number; state: string }; isToday: boolean };

function blockLoad(content: string, records: PersonalRecord[]): string | null {
  const rec = detectExercise(content, records);
  if (!rec) return null;
  const pcts = extractPercentages(content);
  if (!pcts.length) return null;
  const loads = loadsForPercentages(rec.weight, pcts);
  return loads.length === 1 ? `${formatKg(loads[0].suggested)} kg` : `${formatKg(loads[0].suggested)}–${formatKg(loads[loads.length - 1].suggested)} kg`;
}

function firstLine(content: string) {
  return content.split("\n").map((l) => l.trim()).find(Boolean) ?? "";
}

function TodayCard({ next, todayPlan, todayDone, weekProgress, records }: {
  next: NextInfo | null;
  todayPlan: { month: { key: string }; week: { index: number }; day: { key: string; isRest?: boolean; blocks: { key: string; content: string }[] } } | null;
  todayDone: { volume: number; rpe: number | null; prs: number } | null;
  weekProgress: { done: number; total: number } | null;
  records: PersonalRecord[];
}) {
  const todayIso = isoKey(new Date());
  const todayLabel = `${cap(weekdayOf(todayIso))} ${Number(todayIso.slice(8))}`;
  const weekTag = weekProgress && next ? `Semana ${next.week} · ${weekProgress.done}/${weekProgress.total}` : null;
  const links = (second: { to: string; label: string; icon: ReactNode; search?: Record<string, string> }) => (
    <div className="grid grid-cols-2 gap-2">
      <Link to="/pizarra" className="pressable flex min-h-11 items-center justify-center gap-1.5 rounded-[14px] bg-white/[0.05] text-[13px] font-bold"><Camera className="h-4 w-4" />Escanear pizarra</Link>
      <Link to={second.to as any} search={second.search as any} className="pressable flex min-h-11 items-center justify-center gap-1.5 rounded-[14px] bg-white/[0.05] text-[13px] font-bold">{second.icon}{second.label}</Link>
    </div>
  );
  const shell = "rise rise-2 flex flex-col gap-3.5 rounded-[26px] border border-white/[0.06] bg-card p-[18px]";
  const nextRow = (n: NextInfo) => (
    <Link to="/workout/$month/$week/$day" params={{ month: n.monthKey, week: String(n.week), day: n.dayKey }} className="pressable flex items-center gap-2.5 rounded-[14px] bg-white/[0.04] px-2.5 py-2.5">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-[9px] text-[13px] font-extrabold" style={{ background: "var(--gold)", color: "var(--gold-foreground)" }}>{cap(n.dayLabel).charAt(0)}</span>
      <span className="min-w-0 flex-1 truncate text-[14.5px] font-bold">{cap(n.dayLabel)}{n.date ? ` ${Number(n.date.slice(8))}` : ""} · {firstLine(n.headline)}</span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </Link>
  );

  // a) Entreno de hoy pendiente o en curso
  if (next && next.isToday) {
    const inProgress = next.progress.state === "in_progress";
    return (
      <section className={shell}>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[12.5px] font-extrabold text-gold">{inProgress ? "Hoy · en curso" : `Hoy · ${todayLabel.toLowerCase()}`}</span>
          {weekTag && <span className="text-[13px] text-muted-foreground">{weekTag}</span>}
        </div>
        <h2 className="line-clamp-2 text-[24px] font-extrabold leading-[1.1] tracking-tight">{firstLine(next.headline)}</h2>
        <div className="flex flex-col gap-2">
          {next.blockList.slice(0, 4).map((b, i) => {
            const load = blockLoad(b.content, records);
            return (
              <div key={b.key} className="flex items-center gap-2.5 rounded-[14px] bg-white/[0.04] px-2.5 py-2">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-[9px] text-[13px] font-extrabold" style={i === 0 ? { background: "var(--gold)", color: "var(--gold-foreground)" } : { background: "rgba(255,255,255,.08)" }}>{b.key}</span>
                <span className="min-w-0 flex-1 truncate text-[14.5px] font-bold">{firstLine(b.content)}</span>
                {load && <span className="shrink-0 text-[14px] font-extrabold text-gold">{load}</span>}
              </div>
            );
          })}
          {next.blockList.length > 4 && <span className="px-1 text-[13px] text-muted-foreground">+{next.blockList.length - 4} bloques más</span>}
        </div>
        {inProgress && (
          <div className="h-2 overflow-hidden rounded-full bg-white/[0.08]"><div className="h-full rounded-full" style={{ width: `${Math.max(next.progress.pct, 4)}%`, background: "var(--gold)" }} /></div>
        )}
        <Link to="/workout/$month/$week/$day" params={{ month: next.monthKey, week: String(next.week), day: next.dayKey }} className="pressable flex min-h-[54px] items-center justify-center gap-2 rounded-full text-[16px] font-extrabold" style={{ background: "var(--gold)", color: "var(--gold-foreground)" }}>
          <Play className="h-4 w-4" fill="currentColor" />{inProgress ? `Continuar · ${next.progress.done}/${next.progress.total}` : "Empezar entreno"}
        </Link>
        {links({ to: "/calendar", label: "Ver la semana", icon: <CalendarDays className="h-4 w-4" /> })}
      </section>
    );
  }

  // b) Hoy ya está hecho
  if (todayPlan && todayDone) {
    return (
      <section className={shell}>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[12.5px] font-extrabold text-gold">Hoy · hecho ✓</span>
          {weekTag && <span className="text-[13px] text-muted-foreground">{weekTag}</span>}
        </div>
        <h2 className="text-[22px] font-extrabold leading-tight tracking-tight">Entreno completado</h2>
        <div className="flex flex-wrap gap-1.5">
          {todayDone.prs > 0 && <span className="rounded-full px-3 py-1.5 text-[13px] font-bold" style={{ background: "#333B18", color: "var(--gold)" }}>🏆 {todayDone.prs} {todayDone.prs === 1 ? "récord" : "récords"}</span>}
          {todayDone.volume > 0 && <span className="rounded-full bg-white/[0.07] px-3 py-1.5 text-[13px] font-bold">{Math.round(todayDone.volume).toLocaleString("es-ES")} kg</span>}
          {todayDone.rpe != null && <span className="rounded-full bg-white/[0.07] px-3 py-1.5 text-[13px] font-bold">RPE {formatKg(todayDone.rpe)}</span>}
        </div>
        {next && <div className="flex flex-col gap-1"><span className="px-1 text-[12.5px] font-semibold text-muted-foreground">Próximo</span>{nextRow(next)}</div>}
        <div className="grid grid-cols-2 gap-2">
          <Link to="/workout/$month/$week/$day" params={{ month: todayPlan.month.key, week: String(todayPlan.week.index), day: todayPlan.day.key }} className="pressable flex min-h-11 items-center justify-center gap-1.5 rounded-[14px] bg-white/[0.05] text-[13px] font-bold"><Share2 className="h-4 w-4" />Ver y compartir</Link>
          <Link to="/pizarra" className="pressable flex min-h-11 items-center justify-center gap-1.5 rounded-[14px] bg-white/[0.05] text-[13px] font-bold"><Camera className="h-4 w-4" />Escanear pizarra</Link>
        </div>
      </section>
    );
  }

  // c) Descanso o sin entreno hoy
  if (next) {
    const rest = !!todayPlan?.day.isRest;
    const tomorrow = next.date && next.date === isoKey(new Date(Date.now() + 864e5));
    return (
      <section className={shell}>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[12.5px] font-extrabold" style={{ color: "#3BB8F5" }}>{rest ? "Hoy · descanso" : `Hoy · ${todayLabel.toLowerCase()}`}</span>
          <Moon className="h-5 w-5 text-muted-foreground" />
        </div>
        <h2 className="text-[22px] font-extrabold leading-tight tracking-tight">
          {rest ? "Recupera." : "Hoy no hay entreno en tu plan."} {tomorrow ? "Mañana toca:" : "Lo próximo:"}
        </h2>
        {nextRow(next)}
        <Link to="/workout/$month/$week/$day" params={{ month: next.monthKey, week: String(next.week), day: next.dayKey }} className="pressable flex min-h-12 items-center justify-center rounded-full bg-white/[0.08] text-[15px] font-extrabold">
          Ver el {tomorrow ? "entreno de mañana" : "próximo entreno"}
        </Link>
        {links({ to: "/profile", search: { section: "recovery" }, label: "Apuntar sueño", icon: <Moon className="h-4 w-4" /> })}
      </section>
    );
  }

  // d) Plan terminado
  return (
    <section className={shell}>
      <span className="text-[12.5px] font-extrabold text-gold">Planificación completada</span>
      <h2 className="text-[22px] font-extrabold leading-tight tracking-tight">No queda nada pendiente</h2>
      <p className="text-[14px] text-muted-foreground">Sube la siguiente planificación o escanea la pizarra del box para entrenar hoy.</p>
      {links({ to: "/import", label: "Subir plan", icon: <Upload className="h-4 w-4" /> })}
    </section>
  );
}

/** Reto del mes y siguiente medalla, lado a lado (o uno solo si no hay el otro). */
function ChallengeAndMedal() {
  const me = getCurrentUserId();
  const { data: challenges } = useChallenges();
  const active = (challenges ?? []).find((c) => c.participants.includes(me ?? "") && challengeState(c) === "active") ?? null;
  const { data: board } = useLeaderboard(active?.id ?? null);
  const { list } = useMedals();
  const medal = nextMedal(list);
  const mine = active && board ? board.findIndex((r) => r.profile_id === me) : -1;
  const score = mine >= 0 && board ? board[mine].score : 0;
  if (!active && !medal) return null;
  return (
    <div className={`rise rise-3 grid gap-2.5 ${active && medal ? "grid-cols-2" : "grid-cols-1"}`}>
      {active && (
        <Link to="/social" className="pressable flex min-w-0 flex-col gap-1.5 rounded-[20px] bg-card p-3.5">
          <span className="truncate text-[12.5px] text-muted-foreground">Reto del mes</span>
          <span className="truncate text-[14px] font-bold">{active.title}</span>
          <span className="flex items-baseline gap-1">
            <span className="num text-[24px] leading-none text-gold">{fmtScore(active.metric, score)}</span>
            <span className="truncate text-[12.5px] text-muted-foreground">{active.goal ? `/${fmtScore(active.metric, active.goal)}` : ""}{mine >= 0 ? ` · ${mine + 1}º` : ""}</span>
          </span>
          <span className="block h-1.5 overflow-hidden rounded-full bg-white/[0.08]"><span className="block h-full" style={{ width: `${Math.round(Math.min(1, active.goal ? score / active.goal : board?.[0]?.score ? score / board[0].score : 0) * 100)}%`, background: "var(--gold)" }} /></span>
        </Link>
      )}
      {medal && (
        <Link to="/profile" search={{ section: "milestones" } as any} className="pressable flex min-w-0 flex-col gap-1.5 rounded-[20px] bg-card p-3.5">
          <span className="truncate text-[12.5px] text-muted-foreground">Siguiente medalla</span>
          <span className="truncate text-[14px] font-bold">{medal.name}</span>
          <span className="truncate text-[12.5px] text-muted-foreground">{medal.progressText}</span>
          <span className="block h-1.5 overflow-hidden rounded-full bg-white/[0.08]"><span className="block h-full" style={{ width: `${Math.round(medal.progress * 100)}%`, background: "var(--gold)" }} /></span>
        </Link>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <GlassCard level={3} className="rise rise-2 p-8 text-center">
      <div className="gold-gradient mx-auto mb-5 grid h-14 w-14 place-items-center rounded-[20px]">
        <Upload className="h-5 w-5" />
      </div>
      <h2 className="text-xl font-semibold tracking-tight">Importa tu planificación</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Sube tu Excel para comenzar. La app leerá cada mes, semana y día automáticamente.
      </p>
      <Link
        to="/import"
        className="pressable gold-gradient mt-6 inline-flex min-h-[50px] items-center gap-2 rounded-[var(--r-lg)] px-5 text-sm font-semibold"
      >
        Importar Excel <ChevronRight className="h-4 w-4" />
      </Link>
    </GlassCard>
  );
}

function DashboardLoading() {
  return (
    <div className="space-y-3" role="status" aria-label="Cargando inicio">
      <span className="sr-only">Cargando tu planificación y rendimiento…</span>
      <div className="glass glass-sheen h-48 animate-pulse rounded-[28px]" />
      <div className="grid grid-cols-3 gap-2"><div className="glass h-20 animate-pulse rounded-2xl" /><div className="glass h-20 animate-pulse rounded-2xl" /><div className="glass h-20 animate-pulse rounded-2xl" /></div>
      <div className="glass glass-sheen h-36 animate-pulse rounded-[24px]" />
    </div>
  );
}

function PlanningError({ onRetry }: { onRetry: () => void }) {
  return (
    <GlassCard level={3} className="rise rise-2 p-6 text-center">
      <h2 className="text-lg font-semibold">No se pudo cargar el inicio</h2>
      <p className="mt-2 text-sm text-muted-foreground">Comprueba la conexión y vuelve a intentarlo.</p>
      <button type="button" onClick={onRetry} className="pressable gold-gradient mt-5 min-h-[46px] rounded-[var(--r-lg)] px-5 text-sm font-semibold">Reintentar</button>
    </GlassCard>
  );
}
