import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { usePlanning, useAllResults, usePersonalRecords, type WorkoutResult } from "@/lib/store";
import { useAthleteProfile, useMilestones, useGoals, useAllPrHistory, useWellnessLogs } from "@/lib/profile-store";
import { streaks, sessionDays, volumeOf, fmtKg } from "@/lib/analytics";
import { GlassCard, GlassSection, GlassBadge } from "@/components/glass";
import {
  Calendar, Upload, Flame, Trophy, ChevronRight, Timer, Dumbbell, User, Play, ArrowUpRight, Users,
  Award, Target, CalendarCheck, Activity, Layers,
} from "lucide-react";
import { useMemo } from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from "recharts";
import {
  completedBlockMap,
  isSessionCompleted,
  planningCompletion,
  sessionProgress,
} from "@/lib/session-progress";



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

function Home() {
  const { data: planning, isLoading } = usePlanning();
  const { data: results = [] } = useAllResults();
  const { data: records = [] } = usePersonalRecords();
  const { data: milestones = [] } = useMilestones();
  const { data: profile } = useAthleteProfile();
  const { data: prHistory = [] } = useAllPrHistory();
  const { data: goals = [] } = useGoals();
  const { data: wellnessLogs = [] } = useWellnessLogs();


  const blockMap = useMemo(() => completedBlockMap(results), [results]);

  const stats = useMemo(() => {
    const done = results.filter((r) => r.status === "completed");
    const comp = planningCompletion(planning?.data, results);
    return { blocks: done.length, sessions: comp.completed, totalDays: comp.total, pct: comp.pct };
  }, [results, planning]);

  const next = useMemo(() => {
    if (!planning) return null;
    const months = planning.data.months;
    const cur = MONTH_ABBR[new Date().getMonth()];
    const startIdx = Math.max(0, months.findIndex((m) => m.key.toUpperCase().includes(cur)));
    const order = [...months.slice(startIdx), ...months.slice(0, startIdx)];
    for (const m of order)
      for (const w of m.weeks)
        for (const d of w.days) {
          if (d.isRest) continue;
          const prog = sessionProgress(d, m.key, w.index, blockMap);
          if (prog.state === "completed") continue;
          const headline =
            d.blocks.find((b) => /^[A-D]$/.test(b.key))?.content.split("\n")[0] ??
            d.blocks[0]?.content.split("\n")[0] ??
            "Sesión";
          return {
            monthKey: m.key,
            monthLabel: m.label,
            week: w.index,
            dayKey: d.key,
            headline,
            blocks: d.blocks.length,
            progress: prog,
          };
        }
    return null;
  }, [planning, blockMap]);

  const weekProgress = useMemo(() => {
    if (!planning || !next) return null;
    const m = planning.data.months.find((x) => x.key === next.monthKey);
    const w = m?.weeks.find((x) => x.index === next.week);
    if (!m || !w) return null;
    const train = w.days.filter((d) => !d.isRest);
    const done = train.filter((d) => isSessionCompleted(d, m.key, w.index, blockMap)).length;
    return { done, total: train.length };
  }, [planning, next, blockMap]);


  const streak = useMemo(() => streaks(results), [results]);
  const weekStats = useMemo(() => {
    const cutoff = Date.now() - 7 * 864e5;
    const recent = results.filter((r) => r.status === "completed" && new Date(r.updated_at).getTime() >= cutoff);
    const sessions = new Set(recent.map((r) => `${r.month_key}|${r.week}|${r.day_key}`)).size;
    const volume = recent.reduce((sum, r) => sum + (r.weight ?? 0) * (r.sets ?? 1) * (r.reps ?? 0), 0);
    const rpes = recent.map((r) => r.rpe).filter((x): x is number => x != null);
    return { sessions, volume, avgRpe: rpes.length ? rpes.reduce((a, b) => a + b, 0) / rpes.length : null };
  }, [results]);
  const recentPrCount = useMemo(() => prHistory.filter((h) => Date.now() - new Date(h.changed_at).getTime() <= 30 * 864e5).length, [prHistory]);
  const activeGoal = useMemo(() => goals.find((g) => g.status !== "completed"), [goals]);

  const smartState = useMemo(() => {
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
  }, [results]);

  const dashboardTrend = useMemo(() => {
    const weeks = Array.from({ length: 8 }, (_, i) => {
      const end = new Date(); end.setHours(23,59,59,999); end.setDate(end.getDate() - (7 - i) * 7);
      const start = new Date(end); start.setDate(end.getDate() - 6); start.setHours(0,0,0,0);
      const rows = results.filter((r) => r.status === "completed" && new Date(r.updated_at) >= start && new Date(r.updated_at) <= end);
      const volume = rows.reduce((sum, r) => sum + volumeOf(r), 0);
      const rpes = rows.map((r) => r.rpe).filter((x): x is number => x != null);
      return { label: `S${i + 1}`, volume, rpe: rpes.length ? rpes.reduce((a,b) => a+b,0)/rpes.length : null };
    });
    const withVolume = weeks.filter((w) => w.volume > 0);
    const first = withVolume[0]?.volume ?? null;
    const last = withVolume.at(-1)?.volume ?? null;
    const volumeChange = first && last && first > 0 ? ((last-first)/first)*100 : null;
    const latestWellness = [...wellnessLogs].sort((a,b) => b.logged_on.localeCompare(a.logged_on))[0];
    const recovery = latestWellness ? [latestWellness.sleep_hours, latestWellness.energy, latestWellness.mood].filter((x): x is number => x != null) : [];
    const recoveryAvg = recovery.length ? recovery.reduce((a,b)=>a+b,0)/recovery.length : null;
    return { weeks, volumeChange, recoveryAvg, latestWellness };
  }, [results, wellnessLogs]);

  const topRecords = useMemo(
    () =>
      [...records]
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
        .slice(0, 3),
    [records],
  );

  return (
    <AppShell>
      <header className="rise rise-1 mb-6">
        <div className="flex items-center gap-2">
          <span className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-gold" />
          <p className="eyebrow">RMORDIE</p>
        </div>
        <h1 className="mt-3.5 text-[2rem] font-semibold leading-[1.02] tracking-tight">
          ¿Qué toca hoy?
        </h1>
      </header>

      {!planning && !isLoading && <EmptyState />}

      {planning && (
        <>
          {/* 1 · Entreno de hoy */}
          {next ? (
            <GlassCard level={3} gold className="rise rise-2 sheen p-5">
              <div className="flex items-center justify-between gap-3">
                <GlassBadge tone="gold">
                  {next.progress.state === "in_progress" ? "Sesión en curso" : "Siguiente sesión"}
                </GlassBadge>
                {weekProgress && (
                  <span className="text-[11px] tabular text-muted-foreground">
                    Semana {next.week} · {weekProgress.done}/{weekProgress.total}
                  </span>
                )}
              </div>

              <div className="mt-5 flex items-end justify-between gap-4">
                <div className="min-w-0">
                  <div className="display-lg gold-text truncate">{next.dayKey}</div>
                  <p className="eyebrow mt-2.5">{next.monthLabel}</p>
                </div>
                <div className="shrink-0 text-right">
                  <div className="metric tabular">
                    {next.progress.done} / {next.progress.total}
                  </div>
                  <p className="eyebrow mt-1.5">Bloques</p>
                </div>
              </div>

              <div
                className="mt-4 h-[3px] w-full overflow-hidden rounded-full"
                style={{ background: "rgba(255,255,255,0.09)" }}
              >
                <div
                  className="h-full rounded-full transition-[width] duration-700"
                  style={{
                    width: `${Math.max(next.progress.pct, 2)}%`,
                    background: "linear-gradient(90deg,#EBD6A6,#D8B46B)",
                  }}
                />
              </div>
              <p className="eyebrow mt-2.5">
                {next.progress.state === "in_progress" ? "Sesión en curso" : "Sesión pendiente"}
              </p>

              <p className="mt-4 line-clamp-2 text-sm text-muted-foreground">{next.headline}</p>

              <Link
                to="/workout/$month/$week/$day"
                params={{ month: next.monthKey, week: String(next.week), day: next.dayKey }}
                className="pressable gold-gradient mt-5 flex min-h-[54px] w-full items-center justify-center gap-2 rounded-[var(--r-lg)] text-[15px] font-semibold"
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
            <DashboardStat value={String(streak.current)} label="Racha" icon={<Flame className="h-3.5 w-3.5" />} />
            <DashboardStat value={String(weekStats.sessions)} label="Esta semana" icon={<Activity className="h-3.5 w-3.5" />} />
            <DashboardStat value={recentPrCount > 0 ? String(recentPrCount) : "—"} label="PR · 30 días" icon={<Trophy className="h-3.5 w-3.5" />} />
          </div>

          {activeGoal && (
            <GlassCard level={2} className="rise rise-3 mt-3 p-5">
              <div className="flex items-center justify-between gap-3"><div><p className="eyebrow">Objetivo activo</p><p className="mt-2 text-sm font-semibold">{activeGoal.title}</p></div><Target className="h-5 w-5 shrink-0 text-gold" /></div>
              <div className="mt-4 flex items-end justify-between gap-3"><div className="text-2xl font-semibold tabular">{activeGoal.current_value ?? activeGoal.start_value ?? "—"} <span className="text-xs text-muted-foreground">{activeGoal.unit ?? ""}</span></div><div className="text-right text-xs text-muted-foreground">Objetivo <span className="font-semibold text-foreground">{activeGoal.target_value} {activeGoal.unit ?? ""}</span></div></div>
              {activeGoal.current_value != null && activeGoal.target_value > 0 && <div className="mt-3 h-[3px] overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-[linear-gradient(90deg,#EBD6A6,#D8B46B)]" style={{ width: Math.min(100, Math.max(0, (activeGoal.current_value / activeGoal.target_value) * 100)) + "%" }} /></div>}
            </GlassCard>
          )}

          {/* 3 · Estado de entrenamiento */}
          <GlassCard level={2} className="rise rise-3 mt-3 p-5">
            <div className="flex items-start justify-between gap-4"><div className="min-w-0"><p className="eyebrow">Estado de entrenamiento</p><h2 className="mt-2 text-lg font-semibold">{smartState.title}</h2><p className="mt-2 text-xs leading-relaxed text-muted-foreground">{smartState.detail}</p></div><Activity className={`h-5 w-5 shrink-0 ${smartState.tone === "positive" ? "text-gold" : "text-muted-foreground"}`} /></div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <DashboardStat value={String(smartState.sessions)} label="Sesiones" icon={<CalendarCheck className="h-3.5 w-3.5" />} />
              <DashboardStat value={smartState.avgRpe != null ? smartState.avgRpe.toFixed(1) : "—"} label="RPE medio" icon={<Activity className="h-3.5 w-3.5" />} />
              <DashboardStat value={smartState.volume > 0 ? fmtKg(smartState.volume, 0) : "—"} label="Volumen" icon={<Dumbbell className="h-3.5 w-3.5" />} />
            </div>
          </GlassCard>

          {/* 4 · Evolución */}
          <GlassCard level={2} className="rise rise-4 mt-3 p-5">
            <div className="flex items-start justify-between gap-3"><div><p className="eyebrow">Evolución</p><h2 className="mt-2 text-lg font-semibold">Carga de las últimas 8 semanas</h2></div>{dashboardTrend.volumeChange != null && <span className="text-xs font-semibold text-gold">{dashboardTrend.volumeChange >= 0 ? "+" : ""}{dashboardTrend.volumeChange.toFixed(0)}%</span>}</div>
            <div className="mt-4 h-[150px] w-full">
              <ResponsiveContainer width="100%" height="100%"><LineChart data={dashboardTrend.weeks} margin={{ top: 8, right: 4, left: -24, bottom: 0 }}><XAxis dataKey="label" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} /><YAxis hide /><Tooltip formatter={(value: number) => [fmtKg(value, 0), "Volumen"]} contentStyle={{ background: "rgba(20,20,20,.94)", border: "1px solid rgba(216,180,107,.25)", borderRadius: 12, fontSize: 11 }} /><Line type="monotone" dataKey="volume" stroke="var(--gold)" strokeWidth={2.5} dot={false} connectNulls /></LineChart></ResponsiveContainer>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">Volumen calculado a partir de carga × series × repeticiones.</p>
          </GlassCard>

          {dashboardTrend.recoveryAvg != null && (
            <GlassCard level={2} className="rise rise-4 mt-3 p-5">
              <div className="flex items-center justify-between gap-3"><div><p className="eyebrow">Último registro de recuperación</p><h2 className="mt-2 text-lg font-semibold">Estado reciente</h2></div><Activity className="h-5 w-5 text-gold" /></div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                <DashboardStat value={dashboardTrend.latestWellness?.sleep_hours != null ? `${dashboardTrend.latestWellness.sleep_hours}h` : "—"} label="Sueño" icon={<Activity className="h-3.5 w-3.5" />} />
                <DashboardStat value={dashboardTrend.latestWellness?.energy != null ? String(dashboardTrend.latestWellness.energy) : "—"} label="Energía" icon={<Flame className="h-3.5 w-3.5" />} />
                <DashboardStat value={dashboardTrend.latestWellness?.mood != null ? String(dashboardTrend.latestWellness.mood) : "—"} label="Ánimo" icon={<User className="h-3.5 w-3.5" />} />
              </div>
            </GlassCard>
          )}

          {/* 5 · Progreso */}
          <GlassCard level={2} className="rise rise-3 mt-3 p-5">
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

          {/* 6 · Estadísticas rápidas */}
          <div className="rise rise-3 mt-3 grid grid-cols-2 gap-3">
            <MiniStat label="Bloques" value={String(stats.blocks)} icon={<Dumbbell className="h-3.5 w-3.5" />} />
            <MiniStat label="Constancia" value={`${stats.pct}%`} icon={<Flame className="h-3.5 w-3.5" />} />
          </div>

          {/* 7 · PRs */}
          {topRecords.length > 0 && (
            <GlassSection
              title="Récords recientes"
              action={
                <Link to="/records" className="inline-flex items-center gap-1 text-[11px] font-semibold text-gold">
                  Ver todos <ArrowUpRight className="h-3 w-3" />
                </Link>
              }
              className="rise rise-4"
            >
              <div className="space-y-2">
                {topRecords.map((r) => (
                  <Link
                    key={r.id}
                    to="/records"
                    className="pressable glass-quiet flex items-center gap-3 px-4 py-3.5"
                  >
                    <Trophy className="h-4 w-4 shrink-0 text-gold" strokeWidth={1.8} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{r.exercise}</span>
                      <span className="eyebrow mt-1 block">{r.rep_max ? `${r.rep_max}RM` : "RM"}</span>
                    </span>
                    <span className="metric shrink-0 text-right gold-text">
                      {r.weight}
                      <span className="ml-1 text-xs font-medium text-muted-foreground">kg</span>
                    </span>
                  </Link>
                ))}
              </div>
            </GlassSection>
          )}

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
    </AppShell>
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

function MiniStat({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="glass glass-sheen pressable p-4">
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
