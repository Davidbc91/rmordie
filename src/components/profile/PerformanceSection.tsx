import { useMemo } from "react";
import {
  windowStats,
  exerciseStats,
  progressionInsights,
  trendOf,
  fmtNum,
  type Trend,
} from "@/lib/analytics";
import { Card, Stat, Empty, TrendIcon, invert, trendWord } from "./shared";

export function PerformanceSection({ results, history, records, bodyWeight, days, rangeLabel }: any) {
  const cur = windowStats(results, history, days);
  const prev = windowStats(results, history, days, true);
  const insights = useMemo(
    () => progressionInsights(results, history, records, bodyWeight, days, rangeLabel),
    [results, history, records, bodyWeight, days, rangeLabel],
  );

  const strengthTrend: Trend = (() => {
    const stats = exerciseStats(records, history, days).filter((s) => s.changePct != null);
    if (!stats.length) return "unknown";
    const avg = stats.reduce((a, b) => a + (b.changePct ?? 0), 0) / stats.length;
    return avg > 1 ? "up" : avg < -1 ? "down" : "stable";
  })();

  const statuses: { label: string; trend: Trend; detail: string }[] = [
    { label: "Fuerza", trend: strengthTrend, detail: "Basado en la evolución de tus RM" },
    { label: "Volumen", trend: trendOf(cur.volume, prev.volume, 5), detail: `${Math.round(cur.volume).toLocaleString("es-ES")} kg` },
    { label: "Frecuencia", trend: trendOf(cur.weeklyFreq, prev.weeklyFreq, 8), detail: cur.weeklyFreq != null ? `${fmtNum(cur.weeklyFreq)} ses/sem` : "—" },
    {
      label: "RPE",
      trend: invert(trendOf(cur.avgRpe, prev.avgRpe, 5)),
      detail: cur.avgRpe != null ? fmtNum(cur.avgRpe) : "—",
    },
    { label: "PRs", trend: trendOf(cur.prs, prev.prs, 0), detail: `${cur.prs} en ${rangeLabel}` },
  ];

  if (cur.sessions === 0 && history.length === 0) {
    return <Empty text="Sin entrenamientos registrados en este periodo." />;
  }

  return (
    <div className="space-y-4">
      <Card>
        <p className="text-[11px] uppercase tracking-[0.24em]" style={{ color: "#6F6F6F" }}>
          Athlete status
        </p>
        <div className="mt-4 space-y-3">
          {statuses.map((s) => (
            <div key={s.label} className="flex items-center justify-between gap-3 border-b pb-3 last:border-0 last:pb-0" style={{ borderColor: "rgba(255,255,255,0.10)" }}>
              <div>
                <div className="text-sm font-semibold uppercase tracking-[0.1em]">{s.label}</div>
                <div className="text-[11px]" style={{ color: "#6F6F6F" }}>{s.detail}</div>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-semibold">
                <TrendIcon trend={s.trend} />
                {trendWord(s.trend)}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Stat label="Sesiones" value={String(cur.sessions)} sub={`antes: ${prev.sessions}`} />
        <Stat label="Volumen" value={`${Math.round(cur.volume).toLocaleString("es-ES")} kg`} sub={`antes: ${Math.round(prev.volume).toLocaleString("es-ES")} kg`} />
        <Stat label="RPE medio" value={cur.avgRpe != null ? fmtNum(cur.avgRpe) : "—"} sub={prev.avgRpe != null ? `antes: ${fmtNum(prev.avgRpe)}` : undefined} />
        <Stat label="Horas" value={fmtNum(cur.hours)} />
      </div>

      <div>
        <p className="mb-2 text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Progression</p>
        {insights.length === 0 ? (
          <Empty text="Necesitas más historial para detectar tendencias." />
        ) : (
          <div className="space-y-2">
            {insights.map((i, idx) => (
              <div key={idx} className="flex items-start gap-3 rounded-[22px] border border-border bg-surface p-4">
                <span className="mt-0.5 text-foreground"><TrendIcon trend={i.trend} /></span>
                <p className="text-sm">{i.text}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
