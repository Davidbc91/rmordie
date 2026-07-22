import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useSettings, useSaveSettings } from "@/lib/store";
import { setUnlocked, sha256 } from "@/lib/pin-gate";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Ajustes — Malitos" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { data: s } = useSettings();
  const save = useSaveSettings();
  const [bars, setBars] = useState(s?.bar_weights.join(", ") ?? "10, 15, 20");
  const [plates, setPlates] = useState(s?.plate_weights.join(", ") ?? "20, 15, 10, 5, 2.5, 1.25");
  const [pin, setPin] = useState("");

  async function saveGym() {
    const parseList = (t: string) => t.split(",").map((x) => Number(x.trim())).filter((n) => n > 0);
    await save.mutateAsync({ bar_weights: parseList(bars), plate_weights: parseList(plates) });
    toast.success("Material guardado");
  }

  async function changePin() {
    if (pin.length < 4) return toast.error("Mínimo 4 dígitos");
    const hash = await sha256(pin);
    await save.mutateAsync({ pin_hash: hash });
    setPin("");
    toast.success("PIN actualizado");
  }

  function lock() {
    setUnlocked(false);
    window.location.href = "/";
  }

  return (
    <AppShell>
      <h1 className="text-2xl font-semibold tracking-tight">Ajustes</h1>

      <section className="mt-6 card-elevated p-5">
        <h2 className="text-sm font-semibold">Material disponible</h2>
        <p className="mt-1 text-xs text-muted-foreground">Para redondear el peso del asistente de %.</p>
        <label className="mt-4 block">
          <span className="mb-1 block text-[11px] uppercase tracking-wider text-muted-foreground">Barras (kg)</span>
          <input value={bars} onChange={(e) => setBars(e.target.value)} className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm tabular outline-none focus:border-gold" />
        </label>
        <label className="mt-3 block">
          <span className="mb-1 block text-[11px] uppercase tracking-wider text-muted-foreground">Discos por lado (kg)</span>
          <input value={plates} onChange={(e) => setPlates(e.target.value)} className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm tabular outline-none focus:border-gold" />
        </label>
        <button onClick={saveGym} className="mt-4 rounded-xl gold-gradient px-4 py-2 text-sm font-semibold" style={{ color: "var(--gold-foreground)" }}>Guardar</button>
      </section>

      <section className="mt-4 card-elevated p-5">
        <h2 className="text-sm font-semibold">Seguridad</h2>
        <label className="mt-3 block">
          <span className="mb-1 block text-[11px] uppercase tracking-wider text-muted-foreground">Cambiar PIN</span>
          <input type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, ""))} className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm tabular tracking-widest outline-none focus:border-gold" />
        </label>
        <div className="mt-4 flex gap-2">
          <button onClick={changePin} className="rounded-xl bg-surface-2 px-4 py-2 text-sm font-medium">Actualizar PIN</button>
          <button onClick={lock} className="rounded-xl border border-border px-4 py-2 text-sm font-medium">Bloquear ahora</button>
        </div>
      </section>
    </AppShell>
  );
}
