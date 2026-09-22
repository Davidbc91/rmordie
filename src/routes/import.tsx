import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useState } from "react";
import { parsePlanningFromArrayBuffer } from "@/lib/excel-parser";
import { usePlanning, useSavePlanning } from "@/lib/store";
import { toast } from "sonner";
import { Upload, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/import")({
  head: () => ({ meta: [{ title: "Importar planificación — RM OR DIE" }] }),
  component: ImportPage,
});

function ImportPage() {
  const { data: current } = usePlanning();
  const save = useSavePlanning();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  async function onFile(f: File) {
    setBusy(true);
    try {
      // 1) Lectura del archivo Excel
      let planning;
      try {
        const buf = await f.arrayBuffer();
        planning = parsePlanningFromArrayBuffer(buf);
      } catch (e) {
        console.error("[import] error leyendo el Excel:", e);
        toast.error("No pude leer el Excel. Revisa el formato del archivo.");
        return;
      }

      if (planning.months.length === 0) {
        toast.error("El Excel se ha leído, pero no se detectaron meses.");
        return;
      }

      // 2) Guardado en la base de datos
      try {
        await save.mutateAsync({ planning, filename: f.name });
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
    } finally {
      setBusy(false);
    }
  }


  return (
    <AppShell>
      <h1 className="text-2xl font-semibold tracking-tight">Planificación</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Sube tu Excel. Se sobrescribe únicamente la programación; <span className="gold-text">tus pesos, PR, tiempos y notas nunca se borran.</span>
      </p>

      {current && (
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

      <button
        onClick={() => navigate({ to: "/plan-builder" })}
        className="tap mt-6 w-full rounded-[var(--r-md)] gold-gradient px-4 text-sm font-semibold"
      >
        + CREAR PLANIFICACIÓN
      </button>

      <button
        onClick={() => navigate({ to: "/import-generic" })}
        className="tap mt-3 w-full rounded-[var(--r-md)] glass px-4 text-sm font-semibold"
      >
        IMPORTAR PLANIFICACIÓN (.xlsx / .csv)
      </button>


      <label className="mt-3 flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-border bg-surface p-10 text-center transition hover:border-gold/50">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl gold-gradient">
          <Upload className="h-5 w-5" style={{ color: "var(--gold-foreground)" }} />
        </div>
        <div>
          <div className="text-sm font-medium">{busy ? "Procesando…" : (current ? "Actualizar planificación" : "Subir Excel de planificación")}</div>
          <div className="mt-1 text-xs text-muted-foreground">Archivo .xlsx</div>
        </div>
        <input
          type="file"
          accept=".xlsx,.xls"
          disabled={busy}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
          className="hidden"
        />
      </label>
    </AppShell>
  );
}
