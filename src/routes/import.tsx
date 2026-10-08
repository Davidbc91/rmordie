import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useState } from "react";
import { parsePlanningFromArrayBuffer, type Planning } from "@/lib/excel-parser";
import { importPlanningFile, type ImportEngineResult } from "@/lib/import-engine";
import { ImportReview } from "@/components/import/ImportReview";
import { usePlanning, usePlanningVersions, useSavePlanning, useDeletePlanningMonth, useDeletePlanningVersion, useReorderPlanningMonths, useClearAllPlanning } from "@/lib/store";
import { toast } from "sonner";
import { Upload, CheckCircle2, Trash2, Image as ImageIcon } from "lucide-react";

export const Route = createFileRoute("/import")({
  head: () => ({
    meta: [
      { title: "Importar planificación — RM OR DIE" },
      { name: "description", content: "Importa tu planificación desde Excel, CSV, TXT, PDF o una foto y revisa la lectura antes de guardar." },
    ],
  }),
  component: ImportPage,
});

function ImportPage() {
  const { data: current } = usePlanning();
  const { data: planningVersions = [] } = usePlanningVersions();
  const save = useSavePlanning();
  const deleteMonth = useDeletePlanningMonth();
  const deletePlanning = useDeletePlanningVersion();
  const reorderMonths = useReorderPlanningMonths();
  const clearPlanning = useClearAllPlanning();
  const visiblePlanningVersions = planningVersions.filter((version) => version.source_filename !== "Sin planificación" || version.data.months.length > 0);
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [review, setReview] = useState<{ result: ImportEngineResult; filename: string } | null>(null);

  /** Excel con el formato anual propio: se guarda directamente (solo cambia la programación). */
  async function saveNativePlanning(planning: Planning, filename: string) {
    try {
      await save.mutateAsync({ planning, filename });
    } catch (e) {
      const err = e as { message?: string; code?: string; details?: string; hint?: string };
      console.error("[import] error guardando la planificación:", err);
      const raw = `${err?.code ?? ""} ${err?.message ?? ""} ${err?.details ?? ""}`.toLowerCase();
      const isPermission =
        raw.includes("row-level security") ||
        raw.includes("row level security") ||
        raw.includes("permission denied") ||
        raw.includes("violates row") ||
        err?.code === "42501" ||
        err?.code === "401" ||
        err?.code === "403";
      if (isPermission) {
        toast.error("Sin permisos para guardar la planificación (reglas de acceso). El Excel se leyó bien.");
      } else {
        toast.error(`El Excel se leyó bien, pero falló al guardar: ${err?.message ?? "error desconocido"}`);
      }
      return;
    }
    toast.success(`Planificación importada: ${planning.months.length} meses. Tus registros están intactos.`);
    navigate({ to: "/calendar" });
  }

  async function onFile(f: File) {
    setBusy(true);
    setOcrProgress(0);
    try {
      // 1) Excel con el formato anual (meses/semanas): se reconoce entero y se
      //    guarda sin pasos intermedios, como hasta ahora.
      if (/\.(xlsx|xls)$/i.test(f.name)) {
        let native: Planning | null = null;
        try {
          native = parsePlanningFromArrayBuffer(await f.arrayBuffer());
        } catch (e) {
          console.warn("[import] el Excel no tiene el formato anual; se usa la lectura genérica:", e);
        }
        if (native && native.months.length > 0) {
          await saveNativePlanning(native, f.name);
          return;
        }
      }

      // 2) Cualquier otro formato (o un Excel libre): lectura automática y
      //    revisión fila a fila antes de guardar.
      const result = await importPlanningFile(f, setOcrProgress);
      if (result.rows.length === 0) {
        toast.error("El archivo se ha leído, pero no contiene filas con datos.");
        return;
      }
      setReview({ result, filename: f.name });
      toast.success(`${result.rows.length} filas leídas. Revísalas antes de confirmar.`);
    } catch (e) {
      const err = e as { message?: string };
      console.error("[import] error leyendo el archivo:", e);
      toast.error(`No pude leer el archivo: ${err?.message ?? "formato no reconocido"}`);
    } finally {
      setBusy(false);
      setOcrProgress(0);
    }
  }

  if (review) {
    return (
      <AppShell>
        <h1 className="text-2xl font-semibold tracking-tight">Revisar importación</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Comprueba cada fila. <span className="gold-text">Nada se guarda hasta que confirmes y lo anterior se conserva.</span>
        </p>
        <ImportReview
          result={review.result}
          filename={review.filename}
          onCancel={() => setReview(null)}
          onSaved={() => {
            setReview(null);
            navigate({ to: "/calendar" });
          }}
        />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <h1 className="text-2xl font-semibold tracking-tight">Planificación</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Sube tu planificación en Excel, CSV, TXT, PDF o foto. Solo cambia la programación; <span className="gold-text">tus pesos, PR, tiempos y notas nunca se borran.</span>
      </p>

      {current && current.data.months.length > 0 && (
        <div className="mt-6 card-elevated p-4">
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4 text-gold" />
            <span>Planificación activa v{current.version}</span>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {current.source_filename ?? "Sin nombre"} · {current.data.months.length} meses · importada {new Date(current.imported_at).toLocaleDateString("es-ES")}
          </div>
        </div>
      )}

      {current && current.data.months.length > 0 && (
        <section className="mt-4">
          <div className="rounded-2xl border border-red-400/25 bg-red-400/[0.07] p-4">
            <div className="flex items-center gap-3">
              <Trash2 className="h-5 w-5 shrink-0 text-red-300" />
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-semibold">Limpiar planificación</h2>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                  Borra meses y versiones de planificación sin borrar entrenamientos, RMs, marcas, pesos, progreso ni notas.
                </p>
              </div>
            </div>
            <button
              type="button"
              className="mt-3 w-full rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-xs font-bold text-red-200 active:scale-[0.99] disabled:opacity-40"
              disabled={clearPlanning.isPending}
              onClick={async () => {
                const confirmed = window.confirm(
                  "¿Eliminar TODA la planificación?\n\nSe borrarán meses y versiones de planificación. Se conservarán entrenamientos realizados, pesos, RMs, marcas, progreso, tiempos, notas y datos del atleta.\n\nEsta acción no elimina ningún registro de entrenamiento."
                );
                if (!confirmed) return;
                try {
                  await clearPlanning.mutateAsync();
                  toast.success("Planificación eliminada. Tus datos y progreso siguen intactos.");
                } catch (e) {
                  toast.error((e as { message?: string })?.message ?? "No se pudo limpiar la planificación.");
                }
              }}
            >
              {clearPlanning.isPending ? "LIMPIANDO…" : "ELIMINAR TODA LA PLANIFICACIÓN"}
            </button>
          </div>
        </section>
      )}


      {current && (
        <section className="mt-6">
          <div className="mb-2 flex items-end justify-between gap-3">
            <div>
              <p className="eyebrow">Gestionar planificación activa</p>
              <h2 className="mt-1 text-lg font-semibold">Meses importados</h2>
            <p className="mt-1 text-[11px] text-muted-foreground">Usa ↑ y ↓ para colocarlos en el orden que quieras. Ese orden será el de tu calendario.</p>
            </div>
            <span className="text-[11px] text-muted-foreground">{current.data.months.length} meses</span>
          </div>
          <div className="space-y-2">
            {current.data.months.map((month, index) => (
              <div key={month.key} className="glass flex items-center gap-3 px-3 py-3">
                <div className="flex shrink-0 flex-col gap-1">
                  <button
                    type="button"
                    aria-label={"Mover " + month.label + " arriba"}
                    disabled={index === 0 || reorderMonths.isPending}
                    className="grid h-7 w-7 place-items-center rounded-lg border border-[color:var(--glass-border)] bg-white/[0.03] text-xs text-muted-foreground disabled:opacity-20"
                    onClick={async () => {
                      const keys = current.data.months.map((m) => m.key);
                      [keys[index - 1], keys[index]] = [keys[index], keys[index - 1]];
                      try {
                        await reorderMonths.mutateAsync({ planningId: current.id, monthKeys: keys });
                      } catch (e) {
                        toast.error((e as { message?: string })?.message ?? "No se pudo cambiar el orden.");
                      }
                    }}
                  >↑</button>
                  <button
                    type="button"
                    aria-label={"Mover " + month.label + " abajo"}
                    disabled={index === current.data.months.length - 1 || reorderMonths.isPending}
                    className="grid h-7 w-7 place-items-center rounded-lg border border-[color:var(--glass-border)] bg-white/[0.03] text-xs text-muted-foreground disabled:opacity-20"
                    onClick={async () => {
                      const keys = current.data.months.map((m) => m.key);
                      [keys[index], keys[index + 1]] = [keys[index + 1], keys[index]];
                      try {
                        await reorderMonths.mutateAsync({ planningId: current.id, monthKeys: keys });
                      } catch (e) {
                        toast.error((e as { message?: string })?.message ?? "No se pudo cambiar el orden.");
                      }
                    }}
                  >↓</button>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold tabular text-gold">{index + 1}</span>
                    <div className="text-sm font-semibold truncate">{month.label}</div>
                  </div>
                  <div className="text-[11px] text-muted-foreground">{month.key} · {month.weeks.length} semanas</div>
                </div>
                <button
                  type="button"
                  className="pressable rounded-full border border-red-400/20 bg-red-400/10 px-3 py-2 text-[11px] font-semibold text-red-300 disabled:opacity-40"
                  disabled={current.data.months.length <= 1 || deleteMonth.isPending || reorderMonths.isPending}
                  onClick={async () => {
                    if (!window.confirm('¿Eliminar el mes "' + month.label + '" de esta planificación? Los registros de entrenamiento no se borrarán.')) return;
                    try {
                      await deleteMonth.mutateAsync({ planningId: current.id, monthKey: month.key });
                      toast.success("Mes eliminado: " + month.label);
                    } catch (e) {
                      toast.error((e as { message?: string })?.message ?? "No se pudo eliminar el mes.");
                    }
                  }}
                >
                  Eliminar
                </button>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Eliminar un mes solo modifica la planificación. Tus entrenamientos registrados, pesos, PR y notas se conservan.
          </p>
        </section>
      )}

      {visiblePlanningVersions.length > 0 && (
        <section className="mt-7">
          <div className="mb-2">
            <p className="eyebrow">Historial</p>
            <h2 className="mt-1 text-lg font-semibold">Otras planificaciones</h2>
          </div>
          <div className="space-y-2">
            {visiblePlanningVersions.map((version) => {
              const active = version.id === current?.id;
              return (
                <div key={version.id} className="glass flex items-center gap-3 px-4 py-3.5">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold truncate">
                      {version.source_filename ?? ("Planificación v" + version.version)}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      v{version.version} · {version.data.months.length} meses · {new Date(version.imported_at).toLocaleDateString("es-ES")}
                      {active ? " · ACTIVA" : ""}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="pressable rounded-full border border-red-400/20 bg-red-400/10 px-3 py-2 text-[11px] font-semibold text-red-300"
                    disabled={deletePlanning.isPending}
                    onClick={async () => {
                      const label = version.source_filename ?? ("planificación v" + version.version);
                      if (!window.confirm('¿Eliminar "' + label + '" por completo? Esta acción elimina esa versión guardada, pero no tus resultados de entrenamiento.')) return;
                      try {
                        await deletePlanning.mutateAsync(version.id);
                        toast.success("Planificación eliminada.");
                      } catch (e) {
                        toast.error((e as { message?: string })?.message ?? "No se pudo eliminar la planificación.");
                      }
                    }}
                  >
                    Eliminar
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <button
        onClick={() => navigate({ to: "/plan-builder" })}
        className="tap mt-6 w-full rounded-[var(--r-md)] gold-gradient px-4 text-sm font-semibold"
      >
        + CREAR PLANIFICACIÓN
      </button>

      <label className="mt-3 flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-border bg-surface p-10 text-center transition hover:border-gold/50">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl gold-gradient">
          {busy && ocrProgress > 0
            ? <ImageIcon className="h-5 w-5" style={{ color: "var(--gold-foreground)" }} />
            : <Upload className="h-5 w-5" style={{ color: "var(--gold-foreground)" }} />}
        </div>
        <div>
          <div className="text-sm font-medium">
            {busy
              ? (ocrProgress > 0 ? `Reconociendo texto… ${Math.round(ocrProgress * 100)}%` : "Leyendo…")
              : (current ? "Actualizar planificación" : "Subir planificación")}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">Excel, CSV, TXT, PDF o foto (JPG, PNG, WEBP)</div>
        </div>
        <input
          type="file"
          accept=".xlsx,.xls,.csv,.txt,.pdf,.jpg,.jpeg,.png,.webp,text/plain,text/csv,application/pdf,image/jpeg,image/png,image/webp"
          disabled={busy}
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) onFile(f);
          }}
          className="hidden"
        />
      </label>
    </AppShell>
  );
}
