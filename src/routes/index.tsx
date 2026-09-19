import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { usePlanning, useAllResults, usePersonalRecords } from "@/lib/store";
import { GlassCard, GlassSection, GlassBadge } from "@/components/glass";
import {
  Calendar, Upload, Flame, Trophy, ChevronRight, Timer, Dumbbell, User, Play, ArrowUpRight, Users,
} from "lucide-react";
import { useMemo } from "react";

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

  const doneSet = useMemo(() => {
    const s = new Set<string>();
    for (const r of results) if (r.status === "completed") s.add(`${r.month_key}|${r.week}|${r.day_key}`);
    return s;
  }, [results]);

  const stats = useMemo(() => {
    const done = results.filter((r) => r.status === "completed");
    let totalDays = 0;
    if (planning) {
      for (const m of planning.data.months)
        for (const w of m.weeks)
          for (const d of w.days) if (!d.isRest) totalDays++;
    }
    const pct = totalDays ? Math.min(100, Math.round((doneSet.size / totalDays) * 100)) : 0;
    return { blocks: done.length, sessions: doneSet.size, totalDays, pct };
  }, [results, planning, doneSet]);

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
          if (doneSet.has(`${m.key}|${w.index}|${d.key}`)) continue;
          const headline =
            d.blocks.find((b) => /^[A-D]$/.test(b.key))?.content.split("\n")[0] ??
            d.blocks[0]?.content.split("\n")[0] ??
            "Sesión";
          return { monthKey: m.key, monthLabel: m.label, week: w.index, dayKey: d.key, headline, blocks: d.blocks.length };
        }
    return null;
  }, [planning, doneSet]);

  const weekProgress = useMemo(() => {
    if (!planning || !next) return null;
    const m = planning.data.months.find((x) => x.key === next.monthKey);
    const w = m?.weeks.find((x) => x.index === next.week);
    if (!m || !w) return null;
    const train = w.days.filter((d) => !d.isRest);
    const done = train.filter((d) => doneSet.has(`${m.key}|${w.index}|${d.key}`)).length;
    return { done, total: train.length };
  }, [planning, next, doneSet]);

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
                <GlassBadge tone="gold">Siguiente sesión</GlassBadge>
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
                  <div className="metric">{next.blocks}</div>
                  <p className="eyebrow mt-1.5">Bloques</p>
                </div>
              </div>

              <p className="mt-4 line-clamp-2 text-sm text-muted-foreground">{next.headline}</p>

              <Link
                to="/workout/$month/$week/$day"
                params={{ month: next.monthKey, week: String(next.week), day: next.dayKey }}
                className="pressable gold-gradient mt-5 flex min-h-[54px] w-full items-center justify-center gap-2 rounded-[var(--r-lg)] text-[15px] font-semibold"
              >
                <Play className="h-4 w-4" fill="currentColor" /> Empezar entreno
              </Link>
            </GlassCard>
          ) : (
            <GlassCard level={3} className="rise rise-2 p-6 text-center">
              <p className="text-sm text-muted-foreground">Planificación completada. Nada pendiente.</p>
            </GlassCard>
          )}

          {/* 2 · Progreso */}
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

          {/* 3 · Estadísticas rápidas */}
          <div className="rise rise-3 mt-3 grid grid-cols-2 gap-3">
            <MiniStat label="Bloques" value={String(stats.blocks)} icon={<Dumbbell className="h-3.5 w-3.5" />} />
            <MiniStat label="Constancia" value={`${stats.pct}%`} icon={<Flame className="h-3.5 w-3.5" />} />
          </div>

          {/* 4 · PRs */}
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

          {/* 5 · Accesos */}
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
