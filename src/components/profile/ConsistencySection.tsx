import { useMemo } from "react";
import { windowStats, streaks, sessionDays, fmtNum } from "@/lib/analytics";
import { Card, Stat, Empty } from "./shared";

export function ConsistencySection({ results, plannedDays, completedSessions, weeklyTarget }: any) {
  const days = sessionDays(results);
  const s = streaks(results);
  const stats = windowStats(results, [], null);
  const completion = plannedDays ? Math.min(100, Math.round((completedSessions / plannedDays) * 100)) : null;

  const grid = useMemo(() => {
    const set = new Set(days);
    const cells: { date: string; done: boolean }[] = [];
    for (let i = 83; i >= 0; i--) {
      const d = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10);
      cells.push({ date: d, done: set.has(d) });
    }
    return cells;
  }, [days.join(",")]);

  if (days.length === 0) return <Empty text="Marca entrenamientos como completados para medir tu constancia." />;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Planificados" value={plannedDays ? String(plannedDays) : "—"} />
        <Stat label="Completados" value={String(completedSessions)} />
        <Stat label="Perdidos" value={plannedDays ? String(Math.max(0, plannedDays - completedSessions)) : "—"} />
        <Stat label="Cumplimiento" value={completion != null ? `${completion}%` : "—"} />
        <Stat label="Racha actual" value={`${s.current} d`} />
        <Stat label="Racha máxima" value={`${s.best} d`} />
      </div>
      <Card>
        <p className="text-[11px] uppercase tracking-[0.24em]" style={{ color: "#6F6F6F" }}>
          Últimas 12 semanas
        </p>
        <div className="mt-4 grid grid-cols-[repeat(14,1fr)] gap-1.5">
          {grid.map((c) => (
            <div
              key={c.date}
              title={c.date}
              className="aspect-square rounded-[5px]"
              style={{ background: c.done ? "var(--gold)" : "rgba(255,255,255,0.10)" }}
            />
          ))}
        </div>
        <p className="mt-4 text-xs" style={{ color: "#6F6F6F" }}>
          Media semanal: {stats.weeklyFreq != null ? fmtNum(stats.weeklyFreq) : "—"} sesiones
          {weeklyTarget ? ` · objetivo ${weeklyTarget}` : ""}
        </p>
      </Card>
    </div>
  );
}

/* ---------------- 10. Recovery ---------------- */
