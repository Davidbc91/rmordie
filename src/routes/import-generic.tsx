import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Upload } from "lucide-react";
import { GlassBadge, GlassButton, GlassCard, GlassInput, GlassSection } from "@/components/glass";
import { usePlanning, useSavePlanning, usePersonalRecords } from "@/lib/store";
import { detectExercise, loadsForPercentages, formatKg } from "@/lib/rm-matcher";
import {
  IMPORT_DAYS,
  type ParsedImport,
  type ReviewRow,
  buildPlanningFromRows,
  needsReview,
  parseGenericFile,
  rowIssues,
} from "@/lib/generic-import";

export const Route = createFileRoute("/import-generic")({
  head: () => ({
    meta: [
      { title: "Importar planificación genérica — RM OR DIE" },
      { name: "description", content: "Importa planificaciones en Excel o CSV con cualquier formato de columnas y revisa la interpretación antes de guardar." },
      { property: "og:title", content: "Importar planificación genérica — RM OR DIE" },
      { property: "og:description", content: "Revisa y corrige cada fila antes de confirmar la importación de tu planificación." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GenericImportPage,
});

function GenericImportPage() {
  const navigate = useNavigate();
  const { data: current } = usePlanning();
  const { data: records = [] } = usePersonalRecords();
  const save = useSavePlanning();

  const [busy, setBusy] = useState(false);
  const [parsed, setParsed] = useState<ParsedImport | null>(null);
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [filename, setFilename] = useState("");
  const [monthKey, setMonthKey] = useState("1. IMPORTADO");
  const [monthLabel, setMonthLabel] = useState("Importado");
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);

  async function onFile(f: File) {
    setBusy(true);
    try {
      const result = await parseGenericFile(f);
      if (result.rows.length === 0) {
        toast.error("El archivo se ha leído, pero no contiene filas con datos.");
        return;
      }
      setParsed(result);
      setRows(result.rows);
      setFilename(f.name);
      setConfirmOverwrite(false);
      toast.success(`${result.rows.length} filas leídas. Revísalas antes de confirmar.`);
    } catch (e) {
      const err = e as { message?: string };
      console.error("[import-generic] error leyendo el archivo:", e);
      toast.error(`No pude leer el archivo: ${err?.message ?? "formato no reconocido"}`);
    } finally {
      setBusy(false);
    }
  }

  function patch(id: string, p: Partial<ReviewRow>) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...p } : r)));
  }

  const reviewCount = rows.filter(needsReview).length;
  const validCount = rows.length - reviewCount;

  async function onConfirm() {
    if (validCount === 0) {
      toast.error("Ninguna fila es válida todavía. Corrige día y ejercicio.");
      return;
    }
    if (current && !confirmOverwrite) {
      toast.error("Marca la casilla para reemplazar la planificación activa.");
      return;
    }
    const planning = buildPlanningFromRows(rows, { monthKey, monthLabel });
    try {
      await save.mutateAsync({ planning, filename: filename || "Importación genérica" });
      toast.success(`Planificación importada: ${validCount} filas.`);
      navigate({ to: "/calendar" });
    } catch (e) {
      const err = e as { message?: string };
      toast.error(`No se pudo guardar: ${err?.message ?? "error desconocido"}`);
    }
  }

  return (
    <AppShell>
      <h1 className="text-2xl font-semibold tracking-tight">Importar planificación</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Excel o CSV con cualquier formato de columnas. <span className="gold-text">Nada se guarda hasta que confirmes.</span>
      </p>

      {!parsed && (
        <label className="mt-6 flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-border bg-surface p-10 text-center transition hover:border-gold/50">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl gold-gradient">
            <Upload className="h-5 w-5" style={{ color: "var(--gold-foreground)" }} />
          </div>
          <div>
            <div className="text-sm font-medium">{busy ? "Leyendo…" : "Seleccionar archivo"}</div>
            <div className="mt-1 text-xs text-muted-foreground">Archivo .xlsx o .csv</div>
          </div>
          <input
            type="file"
            accept=".xlsx,.xls,.csv,text/csv"
            disabled={busy}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
            className="hidden"
          />
        </label>
      )}

      {parsed && (
        <>
          <GlassSection title="Revisar importación">
            <GlassCard className="p-4">
              <div className="text-xs text-muted-foreground">
                {filename} · {rows.length} filas · <span className="text-foreground">{validCount} listas</span>
                {reviewCount > 0 && <> · <span className="text-gold">{reviewCount} necesitan revisión</span></>}
              </div>
              <div className="mt-2 text-[11px] text-muted-foreground">
                Columnas detectadas:{" "}
                {Object.keys(parsed.columns).length
                  ? Object.entries(parsed.columns)
                      .map(([f, i]) => `${f} → ${parsed.header[i as number] || `col ${(i as number) + 1}`}`)
                      .join(" · ")
                  : "ninguna"}
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
              {rows.map((r) => {
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
                <label className="flex items-start gap-3 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={confirmOverwrite}
                    onChange={(e) => setConfirmOverwrite(e.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-[color:var(--gold)]"
                  />
                  <span>
                    Entiendo que esto pasa a ser la planificación activa (v{current.version} dejará de estarlo).{" "}
                    <span className="gold-text">Tus pesos, PR y notas no se tocan.</span>
                  </span>
                </label>
              )}
              <GlassButton variant="gold" className="mt-3 w-full" onClick={onConfirm} disabled={save.isPending}>
                <CheckCircle2 className="h-4 w-4" />
                {save.isPending ? "Guardando…" : "CONFIRMAR IMPORTACIÓN"}
              </GlassButton>
              <GlassButton size="sm" variant="ghost" className="mt-2 w-full" onClick={() => { setParsed(null); setRows([]); }}>
                Cancelar y elegir otro archivo
              </GlassButton>
            </GlassCard>
          </GlassSection>
        </>
      )}
    </AppShell>
  );
}
