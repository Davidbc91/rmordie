import { useState } from "react";
import { toast } from "sonner";
import { exportAllData, wipeAllHistory } from "@/lib/profile-store";
import { Card } from "./shared";

export function DataSection() {
  const [busy, setBusy] = useState(false);

  async function doExport() {
    setBusy(true);
    try {
      const data = await exportAllData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `rmordie-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Datos exportados");
    } catch (e: any) {
      toast.error(e?.message ?? "Error");
    } finally {
      setBusy(false);
    }
  }

  async function doWipe() {
    if (!window.confirm("Se eliminará TODO tu historial (entrenos, RM, cuerpo, objetivos). ¿Continuar?")) return;
    if (!window.confirm("Esta acción no se puede deshacer. ¿Seguro?")) return;
    setBusy(true);
    try {
      await wipeAllHistory();
      toast.success("Historial eliminado");
      window.location.reload();
    } catch (e: any) {
      toast.error(e?.message ?? "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <Card>
        <p className="text-[11px] uppercase tracking-[0.24em]" style={{ color: "#6F6F6F" }}>Privacidad y control</p>
        <p className="mt-3 text-sm" style={{ color: "#6F6F6F" }}>
          Tus datos son tuyos. Puedes exportarlos en cualquier momento o eliminarlos por completo. Nunca se borra nada de forma automática.
        </p>
        <a
          href="/athlete-report"
          target="_blank"
          rel="noreferrer"
          className="mt-5 flex w-full items-center justify-center rounded-[18px] py-3 text-sm font-semibold"
          style={{ background: "linear-gradient(140deg,#EBD6A6,#D8B46B)", color: "#0A0A0B" }}
        >
          Generar informe para entrenador (PDF)
        </a>
        <button onClick={doExport} disabled={busy} className="mt-3 w-full rounded-[18px] border border-border py-3 text-sm font-semibold">
          Exportar datos completos (JSON)
        </button>
      </Card>
      <button onClick={doWipe} disabled={busy} className="w-full rounded-[18px] border border-border py-3 text-sm font-semibold text-muted-foreground">
        Eliminar todo mi historial
      </button>
    </div>
  );
}
