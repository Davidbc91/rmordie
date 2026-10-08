import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { GlassBadge, GlassButton, GlassCard, GlassInput, GlassSection } from "@/components/glass";
import { usePlanning, useSavePlanning, usePersonalRecords } from "@/lib/store";
import { detectExercise, loadsForPercentages, formatKg } from "@/lib/rm-matcher";
import { IMPORT_DAYS, type ReviewRow, buildPlanningFromRows, needsReview, rowIssues } from "@/lib/generic-import";
import { mergePlanningPreservingPrevious } from "@/lib/pdf-import";
import type { ImportEngineResult } from "@/lib/import-engine";

/**
 * Revisión fila a fila de una planificación leída de CSV, PDF, imagen, TXT o
 * un Excel con formato libre. Nada se guarda hasta pulsar «Confirmar».
 */
export function ImportReview({
  result,
  filename,
  onCancel,
  onSaved,
}: {
  result: ImportEngineResult;
  filename: string;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const { data: current } = usePlanning();
  const { data: records = [] } = usePersonalRecords();
  const save = useSavePlanning();

  const parsed = result;
  const diagnostics = result.diagnostics;
  const [rows, setRows] = useState<ReviewRow[]>(result.rows);
  const [monthKey, setMonthKey] = useState(result.detectedMonth?.key ?? "1. IMPORTADO");
  const [monthLabel, setMonthLabel] = useState(result.detectedMonth?.label ?? "Importado");

  function patch(id: string, p: Partial<ReviewRow>) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...p } : r)));
  }

  const reviewCount = rows.filter(needsReview).length;
  const validCount = rows.length - reviewCount;
  const previewLimit = rows.length > 250 ? 250 : rows.length;
  const previewRows = rows.slice(0, previewLimit);

  async function onConfirm() {
    if (validCount === 0) {
      toast.error("Ninguna fila es válida todavía. Corrige día y ejercicio.");
      return;
    }
    const planning = buildPlanningFromRows(rows, { monthKey, monthLabel });
    const mergedPlanning = mergePlanningPreservingPrevious(current?.data, planning);
    try {
      await save.mutateAsync({ planning: mergedPlanning, filename: filename || "Importación genérica" });
      toast.success(`Planificación importada: ${validCount} filas.`);
      onSaved();
    } catch (e) {
      const err = e as { message?: string };
      toast.error(`No se pudo guardar: ${err?.message ?? "error desconocido"}`);
    }
  }

  return (
    <>
      <GlassSection title="Revisar importación">
        <GlassCard className="p-4">
          <div className="text-xs text-muted-foreground">
            {filename} · {rows.length} filas · <span className="text-foreground">{validCount} listas</span>
            {reviewCount > 0 && <> · <span className="text-gold">{reviewCount} necesitan revisión</span></>}
          </div>
          {diagnostics && (
            <div className="mt-3 rounded-2xl border border-[color:var(--glass-border)] bg-white/[0.025] p-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Calidad de lectura</span>
                <span className={diagnostics.level === "high" ? "text-emerald-300" : diagnostics.level === "medium" ? "text-gold" : "text-red-300"}>
                  {Math.round(diagnostics.confidence * 100)}%
                </span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className={`h-full rounded-full transition-all ${diagnostics.level === "high" ? "bg-emerald-300" : diagnostics.level === "medium" ? "bg-gold" : "bg-red-300"}`}
                  style={{ width: `${Math.round(diagnostics.confidence * 100)}%` }}
                />
              </div>
              <div className="mt-2 text-[10px] text-muted-foreground">
                {diagnostics.daysDetected} días · {diagnostics.weeksDetected} semanas · {diagnostics.rows} registros
                {diagnostics.datedRows > 0 ? ` · ${diagnostics.datedRows} con fecha` : ""}
              </div>
              {diagnostics.warnings.length > 0 && (
                <div className="mt-2 space-y-1 text-[10px] text-gold">
                  {diagnostics.warnings.map((warning) => <div key={warning}>• {warning}</div>)}
                </div>
              )}
            </div>
          )}

          <div className="mt-2 text-[11px] text-muted-foreground">
            {parsed.layout ? (
              <>
                Estructura detectada: <span className="text-foreground">{parsed.layout}</span>
                {parsed.detectedColumns?.length ? <> · {parsed.detectedColumns.length} columnas/días detectados</> : null}
              </>
            ) : (
              <>
                Columnas detectadas:{" "}
                {Object.keys(parsed.columns).length
                  ? Object.entries(parsed.columns).map(([field, index]) => `${field} → ${parsed.header[index as number] || `col ${(index as number) + 1}`}`).join(" · ")
                  : "ninguna"}
              </>
            )}
          </div>
          {parsed.unmapped.length > 0 && (
            <div className="mt-2 text-[11px] text-gold">
              Sin identificar: {parsed.unmapped.join(", ")}. Puedes rellenarlos a mano abajo.
            </div>
          )}
          <div className="mt-3 grid grid-cols-2 gap-3">
            <GlassInput label="Clave del mes" value={monthKey} onChange={(e) => setMonthKey(e.target.value)} />
            <GlassInput label="Nombre del mes" value={monthLabel} onChange={(e) => setMonthLabel(e.target.value)} />
          </div>
        </GlassCard>
      </GlassSection>

      <GlassSection title="Filas">
        <div className="space-y-3">
          {rows.length > previewLimit && (
            <GlassCard className="p-3 border-[color:var(--glass-border)]">
              <div className="text-xs text-muted-foreground">
                Planificación grande detectada: <span className="text-foreground">{rows.length} filas</span>.
                Para mantener la app fluida solo mostramos las primeras {previewLimit} en la revisión.
                <span className="text-foreground"> Todas las filas se conservarán al importar.</span>
              </div>
            </GlassCard>
          )}
          {previewRows.map((r) => {
            const issues = rowIssues(r);
            const rec = r.exercise.trim() ? detectExercise(r.exercise, records) : null;
            const pct = Number(r.percent.replace(",", "."));
            const target = rec && pct > 0 ? loadsForPercentages(rec.weight, [pct])[0] : null;
            return (
              <GlassCard key={r.id} className="p-4" gold={issues.length > 0}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <GlassBadge tone={issues.length ? "gold" : "neutral"}>
                      {r.day || "SIN DÍA"}
                    </GlassBadge>
                    <span className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                      Semana {r.week} · {r.block || "Sin bloque"}
                    </span>
                  </div>
                  <span className="text-[11px] text-muted-foreground">fila {r.sourceRow}</span>
                </div>

                <div className="mt-2 text-sm">
                  <span className="font-medium">{r.exercise || "—"}</span>
                  {(r.sets || r.reps) && (
                    <span className="tabular text-muted-foreground"> · {r.sets || "?"} × {r.reps || "?"}</span>
                  )}
                  {pct > 0 && <span className="tabular text-muted-foreground"> · {r.percent}% RM</span>}
                  {r.load && <span className="tabular text-muted-foreground"> · {r.load} kg</span>}
                  {r.time && <span className="text-muted-foreground"> · {r.time}</span>}
                  {r.distance && <span className="text-muted-foreground"> · {r.distance}</span>}
                </div>

                {pct > 0 && (
                  <div className="mt-1 text-xs">
                    {rec && target ? (
                      <span className="text-muted-foreground">
                        RM actual: <span className="tabular text-foreground">{formatKg(rec.weight)} kg</span> · Carga objetivo:{" "}
                        <span className="tabular text-gold">{formatKg(target.suggested)} kg</span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">RM no disponible</span>
                    )}
                  </div>
                )}

                {issues.length > 0 && (
                  <div className="mt-2 flex items-center gap-2 text-xs text-gold">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Necesita revisión: {issues.join(" · ")}
                  </div>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  {IMPORT_DAYS.map((d) => (
                    <button
                      key={d}
                      onClick={() => patch(r.id, { day: d })}
                      className={`tap rounded-full px-3 text-[11px] font-semibold uppercase tracking-[0.12em] ${d === r.day ? "gold-gradient" : "glass"}`}
                    >
                      {d.slice(0, 3)}
                    </button>
                  ))}
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <GlassInput label="Ejercicio" value={r.exercise} onChange={(e) => patch(r.id, { exercise: e.target.value })} />
                  <GlassInput label="Bloque" value={r.block} onChange={(e) => patch(r.id, { block: e.target.value })} />
                  <GlassInput label="Series" inputMode="decimal" value={r.sets} onChange={(e) => patch(r.id, { sets: e.target.value })} />
                  <GlassInput label="Reps" inputMode="decimal" value={r.reps} onChange={(e) => patch(r.id, { reps: e.target.value })} />
                  <GlassInput label="% RM" inputMode="decimal" value={r.percent} onChange={(e) => patch(r.id, { percent: e.target.value })} />
                  <GlassInput label="Carga kg" inputMode="decimal" value={r.load} onChange={(e) => patch(r.id, { load: e.target.value })} />
                  <GlassInput label="Tiempo" value={r.time} onChange={(e) => patch(r.id, { time: e.target.value })} />
                  <GlassInput label="Distancia" value={r.distance} onChange={(e) => patch(r.id, { distance: e.target.value })} />
                  <GlassInput
                    label="Semana"
                    inputMode="numeric"
                    value={String(r.week)}
                    onChange={(e) => patch(r.id, { week: Math.max(1, Number(e.target.value.replace(/\D/g, "")) || 1) })}
                  />
                </div>

                <GlassButton size="sm" variant="ghost" className="mt-2" onClick={() => setRows((rs) => rs.filter((x) => x.id !== r.id))}>
                  Descartar fila
                </GlassButton>
              </GlassCard>
            );
          })}
        </div>
      </GlassSection>

      <GlassSection title="Confirmar">
        <GlassCard className="p-4">
          {current && (
            <div className="rounded-2xl border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] p-3 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">Actualización segura.</span>{" "}
              La nueva planificación se integra con la actual por mes, semana y día.
              Las sesiones anteriores, pesos, PR, tiempos y notas se conservan.
            </div>
          )}
          <GlassButton variant="gold" className="mt-3 w-full" onClick={onConfirm} disabled={save.isPending}>
            <CheckCircle2 className="h-4 w-4" />
            {save.isPending ? "Guardando…" : "CONFIRMAR IMPORTACIÓN"}
          </GlassButton>
          <GlassButton size="sm" variant="ghost" className="mt-2 w-full" onClick={onCancel}>
            Cancelar y elegir otro archivo
          </GlassButton>
        </GlassCard>
      </GlassSection>
    </>
  );
}
