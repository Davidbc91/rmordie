import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { usePlanning, useAllResults } from "@/lib/store";
import { Calendar, Upload, Flame, Trophy, ChevronRight } from "lucide-react";
import { useMemo } from "react";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Inicio — Malitos Premium Check" }] }),
  component: Home,
});

function Home() {
  const { data: planning, isLoading } = usePlanning();
  const { data: results = [] } = useAllResults();

  const stats = useMemo(() => {
    const completed = results.filter((r) => r.status === "completed").length;
    // Compute streak by distinct days worked
    const byDay = new Set(results.filter((r) => r.status === "completed").map((r) => `${r.month_key}|${r.week}|${r.day_key}`));
    return { completed, sessions: byDay.size };
  }, [results]);

  return (
    <AppShell>
      <header className="mb-8">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Team Vader</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Malitos Premium Check</h1>
      </header>

      {!planning && !isLoading && <EmptyState />}

      {planning && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Completados" value={String(stats.completed)} icon={<Flame className="h-4 w-4" />} />
            <StatCard label="Sesiones" value={String(stats.sessions)} icon={<Trophy className="h-4 w-4" />} gold />
          </div>

          <section className="mt-6 space-y-3">
            <QuickAction to="/calendar" icon={<Calendar className="h-5 w-5" />} title="Calendario" subtitle="Ver mi planificación mes a mes" />
            <QuickAction to="/import" icon={<Upload className="h-5 w-5" />} title="Actualizar planificación" subtitle={`Versión ${planning.version} · ${planning.source_filename ?? "sin nombre"}`} />
          </section>
        </>
      )}
    </AppShell>
  );
}

function EmptyState() {
  return (
    <div className="card-elevated p-8 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl gold-gradient">
        <Upload className="h-5 w-5" style={{ color: "var(--gold-foreground)" }} />
      </div>
      <h2 className="text-lg font-semibold">Importa tu planificación</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Sube tu Excel para comenzar. La app leerá cada mes, semana y día automáticamente.
      </p>
      <Link
        to="/import"
        className="mt-5 inline-flex items-center gap-2 rounded-xl gold-gradient px-5 py-2.5 text-sm font-medium"
        style={{ color: "var(--gold-foreground)" }}
      >
        Importar Excel <ChevronRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

function StatCard({ label, value, icon, gold }: { label: string; value: string; icon: React.ReactNode; gold?: boolean }) {
  return (
    <div className="card-elevated p-5">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
        {icon}{label}
      </div>
      <div className={`mt-3 text-3xl font-semibold tabular ${gold ? "gold-text" : ""}`}>{value}</div>
    </div>
  );
}

function QuickAction({ to, icon, title, subtitle }: { to: string; icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <Link to={to} className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-4 transition hover:border-gold/40">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-2 text-gold">{icon}</div>
      <div className="flex-1">
        <div className="text-sm font-medium">{title}</div>
        <div className="text-xs text-muted-foreground">{subtitle}</div>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </Link>
  );
}
