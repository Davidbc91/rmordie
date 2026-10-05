import { createFileRoute, Link } from "@tanstack/react-router";
import { usePlanning, useAllResults, usePersonalRecords, type WorkoutResult } from "@/lib/store";
import { useAthleteProfile, useMilestones, useGoals, useAllPrHistory, useWellnessLogs } from "@/lib/profile-store";
import { streaks, sessionDays, volumeOf, fmtKg, estimate1rm } from "@/lib/analytics";
import { extractPercentages } from "@/lib/plates";
import { detectExercise, loadsForPercentages, formatKg } from "@/lib/rm-matcher";
import { GlassCard, GlassSection, GlassBadge } from "@/components/glass";
import {
  Calendar, Upload, Flame, Trophy, ChevronRight, Timer, Dumbbell, User, Play, ArrowUpRight, Users,
  Award, Target, CalendarCheck, Activity, Layers,
} from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useState, type ReactNode } from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from "recharts";
import {
  completedBlockMap,
  isSessionCompleted,
  planningCompletion,
  sessionProgress,
} from "@/lib/session-progress";
import { Moon } from "lucide-react";



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
  const [selectedTrendWeek, setSelectedTrendWeek] = useState<string | null>(null);
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
  const { data: milestones = [] } = useMilestones();
  const { data: profile } = useAthleteProfile();
  const { data: prHistory = [] } = useAllPrHistory();
  const { data: goals = [] } = useGoals();
  const { data: wellnessLogs = [] } = useWellnessLogs();
  const deferredResults = useDeferredValue(results);\n  const deferredRecords = useDeferredValue(records);\n  const deferredPlanning = useDeferredValue(planning);\n  const deferredPrHistory = useDeferredValue(prHistory);\n  const deferredWellnessLogs = useDeferredValue(wellnessLogs);


  const blockMap = useMemo(() => completedBlockMap(results), [results]);

  const todayPlan = useMemo(() => {
    if (!planning) return null;
    const now = new Date();
    const month = planning.data.months.find((m) => m.key.toUpperCase().includes(MONTH_ABBR[now.getMonth()]));
    if (!month) return null;
    const weekday = normalizeDayKey(WEEKDAY_KEYS[now.getDay()]);
    const weekOfMonth = Math.ceil((now.getDate() + ((new Date(now.getFullYear(), now.getMonth(), 1).getDay() + 6) % 7)) / 7);
    const week = month.weeks.find((item) => item.index === weekOfMonth) ?? month.weeks.find((item) => item.days.some((d) => normalizeDayKey(d.key) === weekday));
    const day = week?.days.find((item) => normalizeDayKey(item.key) === weekday);
    if (!week || !day) return null;
    return { month, week, day, progress: sessionProgress(day, month.key, week.index, blockMap) };
  }, [planning, blockMap]);

  const stats = useMemo(() => {
    const done = results.filter((r) => r.status === "completed");
    const comp = planningCompletion(planning?.data, results);
    return { blocks: done.length, sessions: comp.completed, totalDays: comp.total, pct: comp.pct };
  }, [results, planning]);

  const next = useMemo(() => {
    if (!planning) return null;
    const months = planning.data.months;
    const now = new Date();
    const cur = MONTH_ABBR[now.getMonth()];
    const currentMonth = months.find((m) => m.key.toUpperCase().includes(cur));
    const startIdx = Math.max(0, months.findIndex((m) => m.key.toUpperCase().includes(cur)));
    const order = [...months.slice(startIdx), ...months.slice(0, startIdx)];
    const pick = (() => {
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
      headline,
      blocks: d.blocks.length,
      progress: prog,
      isToday,
      focus,
    };
  }, [planning, blockMap, records, todayPlan]);

  const resultsByBlock = useMemo(() => {
    const map = new Map<string, WorkoutResult[]>();
    for (const result of results) {
      if (result.status !== "completed" || result.weight == null || result.reps == null || result.weight <= 0 || result.reps <= 0) continue;
      const key = `${result.month_key}|${result.week}|${result.day_key}|${result.block_key}`;
      const bucket = map.get(key);
      if (bucket) bucket.push(result);
      else map.set(key, [result]);
    }
    return map;
  }, [results]);

  const sessionCoach = useMemo(() => {
    if (!analyticsReady || !deferredPlanning || !next || next.focus.length === 0) return null;
    const byExercise = new Map<string, { result: WorkoutResult; date: number }[]>();
    for (const month of deferredPlanning.data.months) {
      for (const week of month.weeks) {
        for (const day of week.days) {
          for (const block of day.blocks) {
            const detected = detectExercise(block.content, records);
            if (!detected) continue;
            const matches = resultsByBlock.get(`${month.key}|${week.index}|${day.key}|${block.key}`) ?? [];
            if (!matches.length) continue;
            const list = byExercise.get(detected.exercise) ?? [];
            for (const result of matches) list.push({ result, date: new Date(result.updated_at).getTime() });
            byExercise.set(detected.exercise, list);
          }
        }
      }
    }
    const candidates = next.focus.map((focus) => {
      const recent = [...(byExercise.get(focus.exercise) ?? [])].sort((a, b) => b.date - a.date).filter((item, index, arr) => arr.findIndex((x) => x.result.id === item.result.id) === index).slice(0, 4);
      if (!recent.length) return null;
      const rpes = recent.map((x) => x.result.rpe).filter((x): x is number => x != null);
      const avgRpe = rpes.length ? rpes.reduce((a, b) => a + b, 0) / rpes.length : null;
      const latest = recent[0].result;
      const estimated = estimate1rm(Number(latest.weight), Number(latest.reps));
      const gap = ((estimated - Number(focus.rm)) / Number(focus.rm)) * 100;
      let title = "Consolida la carga";
      let detail = "Última referencia: " + formatKg(Number(latest.weight)) + " kg × " + latest.reps + ".";
      if (avgRpe != null && avgRpe <= 7.5) {
        title = "Hay margen para progresar";
        detail = "RPE medio " + avgRpe.toFixed(1) + " en las últimas sesiones. Si la técnica es sólida, valora una subida de 2,5 kg.";
      } else if (avgRpe != null && avgRpe >= 9) {
        title = "Mantén antes de subir";
        detail = "RPE medio " + avgRpe.toFixed(1) + ". Repite la carga y busca una ejecución consistente.";
      } else if (gap >= 2.5) {
        title = "Tu estimado apunta por encima";
        detail = "El 1RM estimado reciente está aproximadamente un " + gap.toFixed(0) + "% por encima de tu RM registrada.";
      }
      return { exercise: focus.exercise, title, detail, avgRpe };
    }).filter((x): x is NonNullable<typeof x> => x !== null).slice(0, 2);
    return candidates.length ? candidates : null;
  }, [analyticsReady, deferredPlanning, next, deferredRecords, resultsByBlock]);

  const weekProgress = useMemo(() => {
    if (!analyticsReady || !deferredPlanning || !next) return null;
    const m = deferredPlanning.data.months.find((x) => x.key === next.monthKey);
    const w = m?.weeks.find((x) => x.index === next.week);
    if (!m || !w) return null;
    const train = w.days.filter((d) => !d.isRest);
    const done = train.filter((d) => isSessionCompleted(d, m.key, w.index, blockMap)).length;
    return { done, total: train.length };
  }, [analyticsReady, deferredPlanning, next, blockMap]);


  const streak = useMemo(() => analyticsReady ? streaks(deferredResults) : null, [analyticsReady, deferredResults]);
  const weekStats = useMemo(() => {
    if (!analyticsReady) return { sessions: 0, volume: 0, avgRpe: null as number | null };
    const cutoff = Date.now() - 7 * 864e5;
    const recent = deferredResults.filter((r) => r.status === "completed" && new Date(r.updated_at).getTime() >= cutoff);
    const sessions = new Set(recent.map((r) => `${r.month_key}|${r.week}|${r.day_key}`)).size;
    const volume = recent.reduce((sum, r) => sum + (r.weight ?? 0) * (r.sets ?? 1) * (r.reps ?? 0), 0);
    const rpes = recent.map((r) => r.rpe).filter((x): x is number => x != null);
    return { sessions, volume, avgRpe: rpes.length ? rpes.reduce((a, b) => a + b, 0) / rpes.length : null };
  }, [analyticsReady, deferredResults]);
  const recentPrCount = useMemo(() => analyticsReady ? deferredPrHistory.filter((h) => Date.now() - new Date(h.changed_at).getTime() <= 30 * 864e5).length : 0, [analyticsReady, deferredPrHistory]);
  const activeGoal = useMemo(() => goals.find((g) => g.status !== "completed"), [goals]);

  const smartState = useMemo(() => {
    if (!analyticsReady) return null;
    const cutoff = Date.now() - 7 * 864e5;
    const recent = results.filter((r) => r.status === "completed" && new Date(r.updated_at).getTime() >= cutoff);
    const rpes = recent.map((r) => r.rpe).filter((x): x is number => x != null);
    const avgRpe = rpes.length ? rpes.reduce((a, b) => a + b, 0) / rpes.length : null;
    const volume = recent.reduce((sum, r) => sum + volumeOf(r), 0);
    const sessions = new Set(recent.map((r) => `${r.month_key}|${r.week}|${r.day_key}`)).size;
    let tone = "neutral";
    let title = "Empieza a registrar tu rendimiento";
    let detail = "Cuando acumules sesiones, RMORDIE podrá interpretar tu carga y recuperación de forma más precisa.";
    if (sessions >= 3 && avgRpe != null) {
      if (avgRpe >= 9) { tone = "attention"; title = "Semana exigente"; detail = `Tu RPE medio está en ${avgRpe.toFixed(1)}. Vigila la recuperación antes de añadir carga.`; }
      else if (avgRpe <= 7) { tone = "positive"; title = "Buen margen esta semana"; detail = `RPE medio ${avgRpe.toFixed(1)}. Hay margen para progresar si la técnica y la recuperación acompañan.`; }
      else { title = "Carga bien controlada"; detail = `RPE medio ${avgRpe.toFixed(1)} con ${sessions} sesiones completadas esta semana.`; }
    }
    return { tone, title, detail, sessions, volume, avgRpe };
  }, [analyticsReady, deferredResults]);

  const dashboardTrend = useMemo(() => {
    if (!analyticsReady) return null;
    const weeks = Array.from({ length: 8 }, (_, i) => {
      const end = new Date(); end.setHours(23,59,59,999); end.setDate(end.getDate() - (7 - i) * 7);
      const start = new Date(end); start.setDate(end.getDate() - 6); start.setHours(0,0,0,0);
      const rows = deferredResults.filter((r) => r.status === "completed" && new Date(r.updated_at) >= start && new Date(r.updated_at) <= end);
      const volume = rows.reduce((sum, r) => sum + volumeOf(r), 0);
      const rpes = rows.map((r) => r.rpe).filter((x): x is number => x != null);
      return { label: `S${i + 1}`, volume, rpe: rpes.length ? rpes.reduce((a,b) => a+b,0)/rpes.length : null };
    });
    const withVolume = weeks.filter((w) => w.volume > 0);
    const first = withVolume[0]?.volume ?? null;
    const last = withVolume.at(-1)?.volume ?? null;
    const volumeChange = first && last && first > 0 ? ((last-first)/first)*100 : null;
    const latestWellness = [...deferredWellnessLogs].sort((a,b) => b.logged_on.localeCompare(a.logged_on))[0];
    const recovery = latestWellness ? [latestWellness.sleep_hours, latestWellness.energy, latestWellness.mood].filter((x): x is number => x != null) : [];
    const recoveryAvg = recovery.length ? recovery.reduce((a,b)=>a+b,0)/recovery.length : null;
    return { weeks, volumeChange, recoveryAvg, latestWellness };
  }, [analyticsReady, deferredResults, deferredWellnessLogs]);

  const recentPrs = useMemo(
    () => {
      if (!analyticsReady) return [];
      if (deferredPrHistory.length) {
        return [...deferredPrHistory]
          .sort((a, b) => new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime())
          .slice(0, 3);
      }
      return [...deferredRecords]
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
        .slice(0, 3)
        .map((record) => ({ ...record, changed_at: record.updated_at, new_weight: record.weight }));
    },
    [analyticsReady, deferredPrHistory, deferredRecords],
  );

  return (
          <div className="page-enter">
      <header className="rise rise-1 glass-panel glass-refraction glass-breathe mb-5 rounded-[30px] p-6">
        <div className="flex items-center gap-2">
          <span className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-gold" />
          <p className="cinematic-label">RM / OR DIE</p>
        </div>
        <h1 className="cinematic-title mt-5 text-[3.5rem] leading-[.84]">¿Qué toca<br /><span className="gold-text">hoy?</span></h1>
        <p className="mt-4 max-w-xs text-xs leading-relaxed text-muted-foreground">Tu rendimiento, tu sesión y tu progreso. Todo lo importante, de un vistazo.</p>
      </header>

      {isLoading && <DashboardLoading />}
      {isError && !planning && !isLoading && <PlanningError onRetry={() => void refetch()} />}
      {!planning && !isLoading && !isError && <EmptyState />}

      {planning && (
        <>
          {/* Entrenamiento de hoy */}
          {todayPlan?.day.isRest ? (
            <GlassCard level={3} className="rise rise-2 glass-panel glass-refraction p-6">
              <div className="flex items-center justify-between gap-3"><GlassBadge>Hoy · Recuperación</GlassBadge><Moon className="h-5 w-5 text-muted-foreground" /></div>
              <h2 className="display-lg mt-5">Día de descanso</h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">Tu planificación marca hoy como día de descanso. Recarga energía; la próxima sesión está preparada abajo.</p>
              <Link to="/calendar" className="mt-4 inline-flex min-h-10 items-center gap-2 text-xs font-semibold text-gold">Ver planificación <ChevronRight className="h-4 w-4" /></Link>
            </GlassCard>
          ) : todayPlan?.day && todayPlan.progress.state === "completed" ? (
            <GlassCard level={3} className="rise rise-2 glass-panel p-6"><GlassBadge tone="gold">Hoy · Completado</GlassBadge><h2 className="mt-4 text-xl font-semibold">Entrenamiento hecho</h2><p className="mt-2 text-sm text-muted-foreground">Buen trabajo. Tu próxima sesión aparece a continuación.</p></GlassCard>
          ) : null}

          {/* Próxima sesión disponible; si hoy toca entrenar, esta tarjeta es el CTA principal. */}
          {next ? (
            <GlassCard level={3} gold className="rise rise-2 sheen glass-panel glass-refraction p-6">
              <div className="flex items-center justify-between gap-3">
                <GlassBadge tone="gold">
                  {next.progress.state === "in_progress" ? "Sesión en curso" : next.isToday ? "Entrenamiento de hoy" : "Próximo entrenamiento"}
                </GlassBadge>
                {weekProgress && (
                  <span className="text-[11px] tabular text-muted-foreground">
                    Semana {next.week} · {weekProgress.done}/{weekProgress.total}
                  </span>
                )}
              </div>

              <div className="mt-5 flex items-end justify-between gap-4">
                <div className="min-w-0">
                  <div className="display-xl gold-text truncate">{next.dayKey}</div>
                  <p className="cinematic-label mt-3">{next.monthLabel} · SEMANA {next.week}</p>
                </div>
                <div className="shrink-0 text-right">
                  <div className="cinematic-number tabular">
                    {next.progress.done}<span className="text-xl text-muted-foreground">/{next.progress.total}</span>
                  </div>
                  <p className="eyebrow mt-1.5">Bloques</p>
                </div>
              </div>

              <div
                className="mt-5 h-1.5 w-full overflow-hidden rounded-full"
                style={{ background: "rgba(255,255,255,0.09)" }}
              >
                <div
                  className="h-full rounded-full transition-[width] duration-700"
                  style={{
                    width: `${Math.max(next.progress.pct, 2)}%`,
                    background: "linear-gradient(90deg,var(--gold-soft),var(--gold))",
                  }}
                />
              </div>
              <p className="eyebrow mt-2.5">
                {next.progress.state === "in_progress" ? "Sesión en curso" : "Sesión pendiente"}
              </p>

              <p className="mt-4 line-clamp-2 text-sm text-muted-foreground">{next.headline}</p>

              {sessionCoach && (
                <div className="mt-4 rounded-[var(--r-md)] border border-[color:var(--glass-border)] bg-black/20 p-3.5">
                  <p className="eyebrow">Recomendación para hoy</p>
                  <div className="mt-3 space-y-3">
                    {sessionCoach.map((item) => (
                      <div key={item.exercise}>
                        <div className="flex items-center justify-between gap-3">
                          <span className="min-w-0 truncate text-xs font-semibold">{item.exercise}</span>
                          {item.avgRpe != null && <span className="shrink-0 text-[11px] font-semibold text-gold">RPE {item.avgRpe.toFixed(1)}</span>}
                        </div>
                        <p className="mt-1 text-xs font-medium">{item.title}</p>
                        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{item.detail}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {next.focus.length > 0 && (
                <div className="mt-4 rounded-[var(--r-md)] border border-[color:var(--glass-border)] bg-black/20 p-3.5">
                  <p className="eyebrow">Claves de la sesión</p>
                  <div className="mt-3 space-y-2">
                    {next.focus.map((item) => (
                      <div key={item.exercise} className="flex items-center justify-between gap-3">
                        <span className="min-w-0 truncate text-xs font-medium">{item.exercise}</span>
                        {item.loads.length > 0 ? (
                          <span className="shrink-0 text-xs font-semibold text-gold">
                            {item.loads.map((load) => `${load.pct}% · ${formatKg(load.suggested)} kg`).join(" · ")}
                          </span>
                        ) : (
                          <span className="shrink-0 text-[11px] text-muted-foreground">
                            RM {formatKg(item.rm)} kg
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Link
                to="/workout/$month/$week/$day"
                params={{ month: next.monthKey, week: String(next.week), day: next.dayKey }}
                className="pressable gold-gradient mt-5 flex min-h-[58px] w-full items-center justify-center gap-2 rounded-[var(--r-lg)] text-[15px] font-semibold"
              >
                <Play className="h-4 w-4" fill="currentColor" />{" "}
                {next.progress.state === "in_progress" ? "Continuar entreno" : "Empezar entreno"}
              </Link>

            </GlassCard>
          ) : (
            <GlassCard level={3} className="rise rise-2 p-6 text-center">
              <p className="text-sm text-muted-foreground">Planificación completada. Nada pendiente.</p>
            </GlassCard>
          )}

          {/* 2 · Estado actual */}
          <div className="rise rise-3 mt-3 grid grid-cols-3 gap-2">
            <DashboardStat value={String(streak.current)} label="Racha" icon={<Flame className="h-3.5 w-3.5" />} onClick={() => navigate({ to: "/profile", search: { section: "consistency" } })} />
            <DashboardStat value={String(weekStats.sessions)} label="Esta semana" icon={<Activity className="h-3.5 w-3.5" />} onClick={() => navigate({ to: "/calendar" })} />
            <DashboardStat value={recentPrCount > 0 ? String(recentPrCount) : "—"} label="PR · 30 días" icon={<Trophy className="h-3.5 w-3.5" />} onClick={() => navigate({ to: "/records" })} />
          </div>

          {activeGoal && (
            <button type="button" onClick={() => navigate({ to: "/profile", search: { section: "goals" } })} className="w-full text-left">
            <GlassCard level={2} className="rise rise-3 rise-stagger-1 mt-3 glass-panel glass-refraction p-5 pressable">
              <div className="flex items-center justify-between gap-3"><div><p className="eyebrow">Objetivo activo</p><p className="mt-2 text-sm font-semibold">{activeGoal.title}</p></div><Target className="h-5 w-5 shrink-0 text-gold" /></div>
              <div className="mt-4 flex items-end justify-between gap-3"><div className="text-2xl font-semibold tabular">{activeGoal.current_value ?? activeGoal.start_value ?? "—"} <span className="text-xs text-muted-foreground">{activeGoal.unit ?? ""}</span></div><div className="text-right text-xs text-muted-foreground">Objetivo <span className="font-semibold text-foreground">{activeGoal.target_value} {activeGoal.unit ?? ""}</span></div></div>
              {activeGoal.current_value != null && activeGoal.target_value > 0 && <div className="mt-3 h-[3px] overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-[linear-gradient(90deg,#EBD6A6,#D8B46B)]" style={{ width: Math.min(100, Math.max(0, (activeGoal.current_value / activeGoal.target_value) * 100)) + "%" }} /></div>}
            </GlassCard>
          </button>
          )}

          {/* 3 · Estado de entrenamiento */}
          <button type="button" onClick={() => navigate({ to: "/profile", search: { section: "performance" } })} className="w-full text-left">
          <GlassCard level={2} className="rise rise-3 rise-stagger-2 mt-3 glass-panel p-5 pressable">
            <div className="flex items-start justify-between gap-4"><div className="min-w-0"><p className="eyebrow">Estado de entrenamiento</p><h2 className="mt-2 text-xl font-semibold tracking-tight">{smartState.title}</h2><p className="mt-2 text-xs leading-relaxed text-muted-foreground">{smartState.detail}</p></div><Activity className={`h-5 w-5 shrink-0 ${smartState.tone === "positive" ? "text-gold" : "text-muted-foreground"}`} /></div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <DashboardStat value={String(smartState.sessions)} label="Sesiones" icon={<CalendarCheck className="h-3.5 w-3.5" />} />
              <DashboardStat value={smartState.avgRpe != null ? smartState.avgRpe.toFixed(1) : "—"} label="RPE medio" icon={<Activity className="h-3.5 w-3.5" />} />
              <DashboardStat value={smartState.volume > 0 ? fmtKg(smartState.volume, 0) : "—"} label="Volumen" icon={<Dumbbell className="h-3.5 w-3.5" />} />
            </div>
          </GlassCard>
          </button>

          {/* 4 · Evolución */}
          <GlassCard level={2} className="rise rise-4 rise-stagger-3 mt-3 glass-panel p-5">
            <div className="flex items-start justify-between gap-3"><div><p className="eyebrow">Evolución</p><h2 className="mt-2 text-xl font-semibold tracking-tight">Carga de las últimas 8 semanas</h2></div>{dashboardTrend.volumeChange != null && <span className="text-xs font-semibold text-gold">{dashboardTrend.volumeChange >= 0 ? "+" : ""}{dashboardTrend.volumeChange.toFixed(0)}%</span>}</div>
            <div className="mt-4 h-[150px] w-full">
              <ResponsiveContainer width="100%" height="100%"><LineChart data={dashboardTrend.weeks} margin={{ top: 8, right: 4, left: -24, bottom: 0 }} onClick={(state) => {
                const label = state?.activeLabel;
                if (typeof label === "string") setSelectedTrendWeek(label);
              }}><XAxis dataKey="label" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} /><YAxis hide /><Tooltip formatter={(value: number) => [fmtKg(value, 0), "Volumen"]} contentStyle={{ background: "rgba(20,20,20,.94)", border: "1px solid rgba(216,180,107,.25)", borderRadius: 12, fontSize: 11 }} /><Line type="monotone" dataKey="volume" stroke="var(--gold)" strokeWidth={2.5} dot={{ r: 3, fill: "var(--gold)", stroke: "var(--gold)" }} activeDot={{ r: 5 }} connectNulls /></LineChart></ResponsiveContainer>
            </div>
            {selectedTrendWeek && (() => {
              const point = dashboardTrend.weeks.find((w) => w.label === selectedTrendWeek);
              return point ? (
                <button type="button" onClick={() => setSelectedTrendWeek(null)} className="mt-2 w-full rounded-xl border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] px-3 py-2 text-left pressable">
                  <span className="eyebrow">{point.label}</span>
                  <span className="ml-2 text-xs font-semibold">{fmtKg(point.volume, 0)} de volumen</span>
                  {point.rpe != null && <span className="ml-2 text-xs text-muted-foreground">· RPE {point.rpe.toFixed(1)}</span>}
                </button>
              ) : null;
            })()}
            <p className="mt-2 text-[11px] text-muted-foreground">Toca un punto para ver el detalle de esa semana.</p>
          </GlassCard>

          {dashboardTrend.recoveryAvg != null && (
            <button type="button" onClick={() => navigate({ to: "/profile", search: { section: "recovery" } })} className="w-full text-left">
            <GlassCard level={2} className="rise rise-4 rise-stagger-4 mt-3 glass-panel p-5 pressable">
              <div className="flex items-center justify-between gap-3"><div><p className="eyebrow">Último registro de recuperación</p><h2 className="mt-2 text-lg font-semibold">Estado reciente</h2></div><Activity className="h-5 w-5 text-gold" /></div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                <DashboardStat value={dashboardTrend.latestWellness?.sleep_hours != null ? `${dashboardTrend.latestWellness.sleep_hours}h` : "—"} label="Sueño" icon={<Activity className="h-3.5 w-3.5" />} />
                <DashboardStat value={dashboardTrend.latestWellness?.energy != null ? String(dashboardTrend.latestWellness.energy) : "—"} label="Energía" icon={<Flame className="h-3.5 w-3.5" />} />
                <DashboardStat value={dashboardTrend.latestWellness?.mood != null ? String(dashboardTrend.latestWellness.mood) : "—"} label="Ánimo" icon={<User className="h-3.5 w-3.5" />} />
              </div>
            </GlassCard>
          </button>
          )}

          {/* 5 · Progreso */}
          <button type="button" onClick={() => navigate({ to: "/profile", search: { section: "progress" } })} className="w-full text-left">
          <GlassCard level={2} className="rise rise-3 rise-stagger-5 mt-3 glass-panel p-5 pressable">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="eyebrow">Sesiones completadas</p>
                <div className="display-xl mt-3">{stats.sessions}</div>
                <p className="mt-3 text-xs text-muted-foreground">
                  de {stats.totalDays} días planificados
                </p>
              </div>
              <ProgressRing pct={stats.pct} />
            </div>
            <div className="mt-5 h-[3px] w-full overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.09)" }}>
              <div
                className="h-full rounded-full transition-[width] duration-700"
                style={{ width: `${Math.max(stats.pct, 2)}%`, background: "linear-gradient(90deg,#EBD6A6,#D8B46B)" }}
              />
            </div>
          </GlassCard>
          </button>

          {/* 6 · Estadísticas rápidas */}
          <div className="rise rise-3 mt-3 grid grid-cols-2 gap-3">
            <button type="button" onClick={() => navigate({ to: "/profile", search: { section: "progress" } })} className="text-left"><MiniStat label="Bloques" value={String(stats.blocks)} icon={<Dumbbell className="h-3.5 w-3.5" />} /></button>
            <button type="button" onClick={() => navigate({ to: "/profile", search: { section: "progress" } })} className="text-left"><MiniStat label="Constancia" value={String(stats.pct) + "%"} icon={<Flame className="h-3.5 w-3.5" />} /></button>
          </div>

          {/* PRs recientes desde el historial real */}
          <GlassSection
            title="PRs recientes"
            action={
              <Link to="/records" className="inline-flex items-center gap-1 text-[11px] font-semibold text-gold">
                Ver todos <ArrowUpRight className="h-3 w-3" />
              </Link>
            }
            className="rise rise-4"
          >
            {recentPrs.length > 0 ? (
              <div className="space-y-2">
                {recentPrs.map((r) => (
                  <Link
                    key={r.id}
                    to="/records"
                    className="pressable glass-quiet flex items-center gap-3 px-4 py-3.5"
                  >
                    <Trophy className="h-4 w-4 shrink-0 text-gold" strokeWidth={1.8} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{r.exercise}</span>
                      <span className="eyebrow mt-1 block">{r.rep_max ? `${r.rep_max}RM` : "RM"} · {new Date(r.changed_at).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}</span>
                    </span>
                    <span className="metric shrink-0 text-right gold-text">
                      {r.new_weight}
                      <span className="ml-1 text-xs font-medium text-muted-foreground">kg</span>
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="rounded-2xl border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] px-4 py-5 text-sm text-muted-foreground">Cuando registres una nueva marca personal, aparecerá aquí.</p>
            )}
          </GlassSection>

          {/* 8 · Accesos */}
          <GlassSection title="Accesos" className="rise rise-5">
            <div className="space-y-2">
              <QuickAction to="/calendar" icon={<Calendar className="h-[18px] w-[18px]" />} title="Calendario" subtitle="Tu planificación mes a mes" />
              <QuickAction to="/profile" icon={<User className="h-[18px] w-[18px]" />} title="Mi perfil" subtitle="Progreso, fuerza, constancia e informes" />
              <QuickAction to="/records" icon={<Trophy className="h-[18px] w-[18px]" />} title="Récords" subtitle="1RM, 3RM, 5RM y WODs" />
              <QuickAction to="/timers" icon={<Timer className="h-[18px] w-[18px]" />} title="Temporizadores" subtitle="AMRAP · EMOM · Tabata" />
              <QuickAction to="/social" icon={<Users className="h-[18px] w-[18px]" />} title="Comunidad" subtitle="Feed, PR board y atletas" />
              <QuickAction
                to="/import"
                icon={<Upload className="h-[18px] w-[18px]" />}
                title="Actualizar planificación"
                subtitle={`Versión ${planning.version} · ${planning.source_filename ?? "sin nombre"}`}
              />
            </div>
          </GlassSection>
        </>
      )}
    </div>
  );
}

function ProgressRing({ pct }: { pct: number }) {
  const r = 30;
  const c = 2 * Math.PI * r;
  const offset = c - (c * pct) / 100;
  return (
    <div className="relative h-[78px] w-[78px] shrink-0">
      <svg viewBox="0 0 76 76" className="h-full w-full -rotate-90">
        <circle cx="38" cy="38" r={r} fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="5" />
        <circle
          cx="38"
          cy="38"
          r={r}
          fill="none"
          stroke="var(--gold)"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 800ms cubic-bezier(0.22,1,0.36,1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-sm font-semibold tabular">{pct}%</div>
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

function DashboardStat({ value, label, icon, onClick }: { value: string; label: string; icon: ReactNode; onClick?: () => void }) {
  const inner = (
    <>
      <div className="flex items-center gap-1.5 eyebrow">{icon}<span className="truncate">{label}</span></div>
      <div className="metric mt-2 truncate">{value}</div>
    </>
  );
  if (onClick) return <button type="button" onClick={onClick} className="glass glass-sheen pressable min-w-0 w-full p-3 text-left cinematic-card-dark">{inner}</button>;
  return <div className="glass glass-sheen min-w-0 p-3 cinematic-card-dark">{inner}</div>;
}

function MiniStat({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <div className="glass glass-sheen pressable p-4 cinematic-card-dark">
      <div className="flex items-center gap-1.5 eyebrow">
        {icon}
        {label}
      </div>
      <div className="metric mt-3">{value}</div>
    </div>
  );
}

function QuickAction({ to, icon, title, subtitle }: { to: string; icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <Link to={to} className="pressable glass-quiet group flex items-center gap-4 px-4 py-3.5">
      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-[15px] border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] text-foreground">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold">{title}</div>
        <div className="truncate text-xs text-muted-foreground">{subtitle}</div>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
