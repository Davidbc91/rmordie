import { useMemo, useState } from "react";
import { exerciseStats, fmtKg, fmtNum } from "@/lib/analytics";
import { Card, Empty, MonoChart, Row } from "./shared";

export function StrengthSection({ records, history, days, bodyWeight }: any) {
  const stats = useMemo(() => exerciseStats(records, history, days), [records, history, days]);
  const [openEx, setOpenEx] = useState<string | null>(null);

  if (stats.length === 0) return <Empty text="Registra tus RM para ver el análisis de fuerza." />;

  return (
    <div className="space-y-3">
      {stats.map((s) => {
        const open = openEx === s.exercise;
        const rel = bodyWeight && s.currentPr ? s.currentPr / bodyWeight : null;
        return (
          <Card key={s.exercise}>
            <button className="w-full text-left" onClick={() => setOpenEx(open ? null : s.exercise)}>
              <div className="flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-[0.12em]" style={{ color: "#6F6F6F" }}>
                    {s.exercise}
                  </p>
                  <p className="mt-1 text-[40px] font-semibold leading-none tabular tracking-tight">
                    {s.currentPr != null ? fmtNum(s.currentPr, 1) : "—"}
                    <span className="text-base"> kg</span>
                  </p>
                </div>
                <div className="text-right text-[13px]" style={{ color: "#6F6F6F" }}>
                  {s.changePct != null && <div>{s.changePct >= 0 ? "+" : ""}{s.changePct.toFixed(1)}%</div>}
                  <div>{s.updates} registros</div>
                </div>
              </div>
            </button>

            <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-xs" style={{ color: "#6F6F6F" }}>
              <Row label="1RM real" value={s.realOneRm != null ? fmtKg(s.realOneRm) : "—"} />
              <Row
                label="1RM estimado"
                value={s.realOneRm != null ? "—" : s.estimatedOneRm != null ? `≈ ${fmtKg(s.estimatedOneRm, 1)}` : "—"}
              />
              <Row label="Mejor peso" value={fmtKg(s.bestWeight)} />
              <Row label="Último peso" value={fmtKg(s.lastWeight)} />
              <Row
                label="Fuerza relativa"
                value={rel ? `${rel.toFixed(2)}x BW` : "—"}
              />
              <Row
                label="Último PR"
                value={s.lastPrDate ? new Date(s.lastPrDate).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "2-digit" }) : "—"}
              />
            </div>
            {s.realOneRm == null && s.estimatedOneRm != null && (
              <p className="mt-3 text-[13px]" style={{ color: "#6F6F6F" }}>
                Estimado (Epley) a partir de {s.estimatedFrom}. No es un récord real.
              </p>
            )}

            {open && (
              <div className="mt-4">
                <MonoChart
                  data={s.series.map((p) => ({
                    label: new Date(p.date).toLocaleDateString("es-ES", { day: "2-digit", month: "short" }),
                    value: p.weight,
                  }))}
                />
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
