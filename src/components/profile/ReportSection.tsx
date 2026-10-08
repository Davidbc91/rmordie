import { useMemo, useState } from "react";
import { exerciseStats, monthlyReport, fmtKg, fmtNum } from "@/lib/analytics";
import { Card, Stat, Empty, ReportList } from "./shared";

export function ReportSection({ results, history, metrics, records }: any) {
  const [offset, setOffset] = useState(0);
  const monthDate = useMemo(() => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - offset);
    return d;
  }, [offset]);

  const rep = monthlyReport(results, history, metrics, monthDate);
  const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
  const stats = exerciseStats(records, history, 60);
  const improving = stats.filter((s) => (s.changePct ?? 0) > 1);
  const stalled = stats.filter((s) => s.lastPrDate && Date.now() - new Date(s.lastPrDate).getTime() > 42 * 864e5);
  const stable = stats.filter((s) => !improving.includes(s) && !stalled.includes(s));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={() => setOffset(offset + 1)} className="rounded-xl border border-border px-3 py-2 text-xs">Anterior</button>
        <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">{rep.label}</p>
        <button onClick={() => setOffset(Math.max(0, offset - 1))} disabled={offset === 0} className="rounded-xl border border-border px-3 py-2 text-xs disabled:opacity-30">Siguiente</button>
      </div>

      {rep.sessions === 0 && rep.prs.length === 0 ? (
        <Empty text="No hay registros en este mes." />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Entrenos" value={String(rep.sessions)} sub={`de ${daysInMonth} días`} />
            <Stat label="PRs" value={String(rep.prs.length)} />
            <Stat label="Volumen" value={`${Math.round(rep.volume).toLocaleString("es-ES")} kg`} />
            <Stat label="RPE medio" value={rep.avgRpe != null ? fmtNum(rep.avgRpe) : "—"} />
            <Stat label="Peso corporal" value={rep.bodyweight != null ? fmtKg(rep.bodyweight) : "—"} />
            <Stat label="Bloques" value={String(rep.blocks)} />
          </div>

          <Card>
            <ReportList title="Improving" items={improving.map((s) => `${s.exercise} +${s.changePct!.toFixed(1)}%`)} />
            <div className="my-4 h-px" style={{ background: "rgba(255,255,255,0.10)" }} />
            <ReportList title="Stable" items={stable.map((s) => s.exercise)} />
            <div className="my-4 h-px" style={{ background: "rgba(255,255,255,0.10)" }} />
            <ReportList title="Stalled" items={stalled.map((s) => `${s.exercise} · sin PR desde ${new Date(s.lastPrDate!).toLocaleDateString("es-ES")}`)} />
          </Card>
        </>
      )}
    </div>
  );
}
