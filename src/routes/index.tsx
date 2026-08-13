import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { usePlanning, useAllResults } from "@/lib/store";
import { Calendar, Upload, Flame, Trophy, ChevronRight, Timer, Dumbbell, User } from "lucide-react";
import { useMemo } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Inicio — RM OR DIE" },
      { name: "description", content: "Tu panel de entrenamiento: sesiones completadas, progreso mensual y acceso rápido al calendario." },
      { property: "og:title", content: "RM OR DIE — Inicio" },
      { property: "og:description", content: "Panel de entrenamiento minimalista: progreso, sesiones y récords." },
    ],
  }),
  component: Home,
});

function Home() {
  const { data: planning, isLoading } = usePlanning();
  const { data: results = [] } = useAllResults();

  const stats = useMemo(() => {
    const done = results.filter((r) => r.status === "completed");
    const byDay = new Set(done.map((r) => `${r.month_key}|${r.week}|${r.day_key}`));
    let totalDays = 0;
    if (planning) {
      for (const m of planning.data.months)
        for (const w of m.weeks)
          for (const d of w.days) if (!d.isRest) totalDays++;
    }
    const pct = totalDays ? Math.min(100, Math.round((byDay.size / totalDays) * 100)) : 0;
    return { completed: done.length, sessions: byDay.size, totalDays, pct };
  }, [results, planning]);

  return (
    <AppShell>
      <header className="rise rise-1 relative mb-8">
        <div className="flex items-center gap-2">
          <span className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-white" />
          <p className="eyebrow">RM OR DIE</p>
        </div>
        <h1 className="mt-4 text-[2.5rem] font-semibold leading-[0.95] tracking-tight">
          Bienvenido.
        </h1>
        <div className="rule-fade mt-6" />
      </header>

      {!planning && !isLoading && <EmptyState />}

      {planning && (
        <>
          {/* Panel principal: cifra gigante + anillo de progreso */}
          <section className="rise rise-2 card-elevated sheen relative overflow-hidden p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="eyebrow">Sesiones completadas</p>
                <div className="display-xl mt-3">{stats.sessions}</div>
                <p className="mt-3 text-xs text-muted-foreground">
                  de {stats.totalDays} días de entreno planificados
                </p>
              </div>
              <ProgressRing pct={stats.pct} />
            </div>

            <div className="mt-6 h-[3px] w-full overflow-hidden rounded-full" style={{ background: "#ECECEC" }}>
              <div
                className="h-full rounded-full transition-[width] duration-700"
                style={{ width: `${Math.max(stats.pct, 2)}%`, background: "#000000" }}
              />
            </div>
          </section>

          <div className="rise rise-3 mt-3 grid grid-cols-2 gap-3">
            <MiniStat label="Bloques" value={String(stats.completed)} icon={<Dumbbell className="h-3.5 w-3.5" />} />
            <MiniStat label="Constancia" value={`${stats.pct}%`} icon={<Flame className="h-3.5 w-3.5" />} />
          </div>

          <section className="rise rise-4 mt-8">
            <h2 className="eyebrow mb-3">Accesos</h2>
            <div className="space-y-2">
              <QuickAction to="/calendar" icon={<Calendar className="h-[18px] w-[18px]" />} title="Calendario" subtitle="Tu planificación mes a mes" />
              <QuickAction to="/profile" icon={<User className="h-[18px] w-[18px]" />} title="Mi perfil" subtitle="Progreso, fuerza, constancia e informes" />
              <QuickAction to="/records" icon={<Trophy className="h-[18px] w-[18px]" />} title="Récords" subtitle="1RM, 3RM, 5RM y evolución" />
              <QuickAction to="/timers" icon={<Timer className="h-[18px] w-[18px]" />} title="Temporizadores" subtitle="AMRAP · EMOM · Tabata" />
              <QuickAction
                to="/import"
                icon={<Upload className="h-[18px] w-[18px]" />}
                title="Actualizar planificación"
                subtitle={`Versión ${planning.version} · ${planning.source_filename ?? "sin nombre"}`}
              />
            </div>
          </section>
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
    <div className="relative h-[76px] w-[76px] shrink-0">
      <svg viewBox="0 0 76 76" className="h-full w-full -rotate-90">
        <circle cx="38" cy="38" r={r} fill="none" stroke="#ECECEC" strokeWidth="6" />
        <circle
          cx="38"
          cy="38"
          r={r}
          fill="none"
          stroke="#000000"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 900ms cubic-bezier(0.22,1,0.36,1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-sm font-semibold tabular">
        {pct}%
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rise rise-2 card-elevated sheen p-8 text-center">
      <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: "#000000" }}>
        <Upload className="h-5 w-5" style={{ color: "#FFFFFF" }} />
      </div>
      <h2 className="text-xl font-semibold tracking-tight">Importa tu planificación</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Sube tu Excel para comenzar. La app leerá cada mes, semana y día automáticamente.
      </p>
      <Link
        to="/import"
        className="pressable mt-6 inline-flex items-center gap-2 rounded-[18px] px-5 py-3 text-sm font-semibold"
        style={{ background: "#000000", color: "#FFFFFF" }}
      >
        Importar Excel <ChevronRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

function MiniStat({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="pressable rounded-[22px] border border-border bg-surface p-4">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-2 text-3xl font-semibold tabular tracking-tight">{value}</div>
    </div>
  );
}

function QuickAction({ to, icon, title, subtitle }: { to: string; icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <Link
      to={to}
      className="pressable group flex items-center gap-4 rounded-[22px] border border-border bg-surface p-4 hover:border-white/35"
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-surface-2 text-foreground">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">{title}</div>
        <div className="truncate text-xs text-muted-foreground">{subtitle}</div>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
