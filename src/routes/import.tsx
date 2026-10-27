import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useState } from "react";
import { ArrowDown, ArrowUp, ChevronDown, Plus } from "lucide-react";
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
  const [sorting, setSorting] = useState(false);
  const [allMonths, setAllMonths] = useState(false);

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
        <h1 className="page-title">Revisar importación</h1>
        <p className="mt-2 text-[15px] text-muted-foreground">
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

  const errMsg = (e: unknown, fallback: string) => (e as { message?: string })?.message ?? fallback;

  async function moveMonth(index: number, dir: -1 | 1) {
    if (!current) return;
    const keys = current.data.months.map((m) => m.key);
    const j = index + dir;
    if (j < 0 || j >= keys.length) return;
    [keys[index], keys[j]] = [keys[j], keys[index]];
    try {
      await reorderMonths.mutateAsync({ planningId: current.id, monthKeys: keys });
    } catch (e) {
      toast.error(errMsg(e, "No se pudo cambiar el orden."));
    }
  }

  async function removeMonth(monthKey: string, label: string) {
    if (!current) return;
    if (!window.confirm('¿Quitar el mes "' + label + '" de esta planificación? Tus entrenos registrados no se borran.')) return;
    try {
      await deleteMonth.mutateAsync({ planningId: current.id, monthKey });
      toast.success("Mes quitado: " + label);
    } catch (e) {
      toast.error(errMsg(e, "No se pudo quitar el mes."));
    }
  }

  async function removeVersion(id: string, label: string) {
    if (!window.confirm('¿Eliminar "' + label + '"? Se borra esa versión guardada, nunca tus resultados de entrenamiento.')) return;
    try {
      await deletePlanning.mutateAsync(id);
      toast.success("Versión eliminada.");
    } catch (e) {
      toast.error(errMsg(e, "No se pudo eliminar la versión."));
    }
  }

  async function clearAll() {
    const confirmed = window.confirm(
      "¿Eliminar TODA la planificación?\n\nSe borrarán meses y versiones de planificación. Se conservan entrenamientos, pesos, RM, marcas, progreso, tiempos y notas."
    );
    if (!confirmed) return;
    try {
      await clearPlanning.mutateAsync();
      toast.success("Planificación eliminada. Tus datos y progreso siguen intactos.");
    } catch (e) {
      toast.error(errMsg(e, "No se pudo limpiar la planificación."));
    }
  }

  const months = current?.data.months ?? [];
  const shownMonths = sorting || allMonths ? months : months.slice(0, 3);
  const otherVersions = visiblePlanningVersions.filter((v) => v.id !== current?.id);
  const fmtDate = (d: string) => new Date(d).toLocaleDateString("es-ES", { day: "numeric", month: "short" });

  return (
    <AppShell>
      <p className="eyebrow">Tu programación</p>
      <h1 className="page-title mt-1">Planificación</h1>

      {current && months.length > 0 && (
        <section className="mt-4 rounded-[22px] border border-[color:var(--gold)]/35 bg-[color:var(--gold)]/[0.07] p-4">
          <p className="flex items-center gap-2 text-[13px] font-bold tracking-[0.1em] text-gold">
            <CheckCircle2 className="h-4 w-4" /> ACTIVA · VERSIÓN {current.version}
          </p>
          <p className="mt-1.5 truncate text-[17px] font-bold">{current.source_filename ?? "Sin nombre"}</p>
          <p className="text-sm text-muted-foreground">{months.length} meses · importada el {fmtDate(current.imported_at)}</p>
        </section>
      )}

      <label className={`mt-3.5 flex cursor-pointer flex-col items-center gap-2.5 rounded-[22px] border-2 border-dashed border-[color:var(--gold)]/45 px-4 py-7 text-center transition hover:border-[color:var(--gold)]/70 ${busy ? "opacity-80" : ""}`}>
        <span className="gold-gradient grid h-14 w-14 place-items-center rounded-[18px]">
          {busy && ocrProgress > 0 ? <ImageIcon className="h-6 w-6" /> : <Upload className="h-6 w-6" strokeWidth={2.2} />}
        </span>
        <span className="text-[26px] font-extrabold uppercase leading-none" style={{ fontFamily: "var(--font-editorial)" }}>
          {busy
            ? (ocrProgress > 0 ? `Leyendo la foto… ${Math.round(ocrProgress * 100)}%` : "Leyendo…")
            : current ? "Subir nueva planificación" : "Subir planificación"}
        </span>
        <span className="text-sm text-muted-foreground">Excel, PDF, CSV, texto o foto de la pizarra</span>
        <span className="text-[13px] text-foreground/85">Tus pesos, récords, tiempos y notas nunca se borran.</span>
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

      <button
        type="button"
        onClick={() => navigate({ to: "/plan-builder" })}
        className="pressable mt-2.5 flex min-h-[52px] w-full items-center justify-center gap-1.5 rounded-[16px] bg-white/[0.06] text-[15px] font-bold"
      >
        <Plus className="h-4 w-4" /> Crear una planificación a mano
      </button>

      {current && months.length > 0 && (
        <section className="mt-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-extrabold">Meses</h2>
            <button type="button" onClick={() => setSorting((v) => !v)} className="min-h-11 px-1 text-sm font-bold text-gold">
              {sorting ? "Hecho" : "Ordenar"}
            </button>
          </div>
          <div className="overflow-hidden rounded-[18px] bg-white/[0.045]">
            {shownMonths.map((month, index) => (
              <div key={month.key} className="flex min-h-14 items-center gap-3 border-b border-white/[0.06] px-3.5 last:border-b-0">
                <span className="w-7 text-[22px] font-extrabold text-gold" style={{ fontFamily: "var(--font-editorial)" }}>{index + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold">{month.label}</span>
                  {sorting && <span className="block text-xs text-muted-foreground">{month.weeks.length} semanas</span>}
                </span>
                {sorting ? (
                  <span className="flex shrink-0 items-center gap-1">
                    <button type="button" aria-label={"Subir " + month.label} disabled={index === 0 || reorderMonths.isPending} onClick={() => moveMonth(index, -1)} className="grid h-11 w-11 place-items-center rounded-[12px] bg-white/[0.06] disabled:opacity-25"><ArrowUp className="h-4 w-4" /></button>
                    <button type="button" aria-label={"Bajar " + month.label} disabled={index === months.length - 1 || reorderMonths.isPending} onClick={() => moveMonth(index, 1)} className="grid h-11 w-11 place-items-center rounded-[12px] bg-white/[0.06] disabled:opacity-25"><ArrowDown className="h-4 w-4" /></button>
                    <button type="button" aria-label={"Quitar " + month.label} disabled={months.length <= 1 || deleteMonth.isPending} onClick={() => removeMonth(month.key, month.label)} className="grid h-11 w-11 place-items-center rounded-[12px] text-red-300 disabled:opacity-25"><Trash2 className="h-4 w-4" /></button>
                  </span>
                ) : (
                  <span className="shrink-0 text-[13px] text-muted-foreground">{month.weeks.length} semanas</span>
                )}
              </div>
            ))}
            {!sorting && months.length > 3 && (
              <button type="button" onClick={() => setAllMonths((v) => !v)} className="flex min-h-12 w-full items-center justify-center gap-1.5 text-sm text-muted-foreground">
                {allMonths ? "Ver menos" : `Ver los ${months.length} meses`}
                <ChevronDown className={`h-4 w-4 transition-transform ${allMonths ? "rotate-180" : ""}`} />
              </button>
            )}
          </div>
          <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
            {sorting ? "El orden de aquí es el de tu calendario. Quitar un mes no borra tus entrenos." : "Con «Ordenar» puedes mover o quitar meses."}
          </p>
        </section>
      )}

      {otherVersions.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-lg font-extrabold">Versiones anteriores</h2>
          <div className="overflow-hidden rounded-[18px] bg-white/[0.045]">
            {otherVersions.map((version) => {
              const label = version.source_filename ?? ("Planificación v" + version.version);
              return (
                <div key={version.id} className="flex min-h-[60px] items-center gap-3 border-b border-white/[0.06] px-3.5 last:border-b-0">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold">{label}</span>
                    <span className="text-[13px] text-muted-foreground">v{version.version} · {version.data.months.length} meses · {fmtDate(version.imported_at)}</span>
                  </span>
                  <button type="button" disabled={deletePlanning.isPending} onClick={() => removeVersion(version.id, label)} className="min-h-11 shrink-0 px-2 text-sm font-semibold text-muted-foreground hover:text-red-300">
                    Eliminar
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {current && months.length > 0 && (
        <details className="mt-7 rounded-[18px] border border-red-400/25 px-3.5">
          <summary className="flex min-h-[52px] cursor-pointer items-center text-[15px] font-bold text-red-200">Zona de borrado</summary>
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            Borra todos los meses y versiones de planificación. Nunca borra tus entrenos, pesos, RM, marcas, progreso ni notas.
          </p>
          <button
            type="button"
            disabled={clearPlanning.isPending}
            onClick={clearAll}
            className="mb-3.5 mt-3 min-h-12 w-full rounded-[14px] border border-red-400/30 bg-red-400/10 text-sm font-bold text-red-200 disabled:opacity-40"
          >
            {clearPlanning.isPending ? "Borrando…" : "Eliminar toda la planificación"}
          </button>
        </details>
      )}
    </AppShell>
  );
}
