import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useSettings, useSaveSettings, useProfiles, useUpdateProfilePin, useDeleteProfile } from "@/lib/store";
import { signOut, getCurrentUserId } from "@/lib/pin-gate";
import { supabase } from "@/integrations/supabase/client";

import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Ajustes — RM OR DIE" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const navigate = useNavigate();
  const uid = getCurrentUserId();
  const { data: s } = useSettings();
  const { data: profiles = [] } = useProfiles();
  const save = useSaveSettings();
  const updatePin = useUpdateProfilePin();
  const deleteProfile = useDeleteProfile();
  const me = profiles.find((p) => p.id === uid);

  const [bars, setBars] = useState(s?.bar_weights.join(", ") ?? "10, 15, 20");
  const [plates, setPlates] = useState(s?.plate_weights.join(", ") ?? "20, 15, 10, 5, 2.5, 1.25");
  const [pin, setPin] = useState("");

  async function saveGym() {
    const parseList = (t: string) => t.split(",").map((x) => Number(x.trim())).filter((n) => n > 0);
    await save.mutateAsync({ bar_weights: parseList(bars), plate_weights: parseList(plates) });
    toast.success("Material guardado");
  }

  async function changePin() {
    if (!uid) return;
    if (pin.length < 4) return toast.error("Mínimo 4 dígitos");
    await updatePin.mutateAsync({ id: uid, pin });
    setPin("");
    toast.success("PIN actualizado");
  }

  async function switchProfile() {
    signOut();
    await supabase.auth.signOut();
    navigate({ to: "/" });
    setTimeout(() => window.location.reload(), 50);
  }

  async function removeProfile() {
    if (!uid) return;
    const ok = window.confirm("¿Eliminar tu perfil y TODOS tus registros? Esta acción no se puede deshacer.");
    if (!ok) return;
    await deleteProfile.mutateAsync(uid);
    signOut();
    await supabase.auth.signOut();
    window.location.reload();
  }


  return (
    <AppShell>
      <h1 className="text-2xl font-semibold tracking-tight">Ajustes</h1>
      {me && (
        <p className="mt-1 text-sm text-muted-foreground">
          Perfil activo: <span className="text-foreground font-medium">{me.name}</span>
        </p>
      )}

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
        <h2 className="text-sm font-semibold">Perfil y seguridad</h2>
        <label className="mt-3 block">
          <span className="mb-1 block text-[11px] uppercase tracking-wider text-muted-foreground">Cambiar mi PIN</span>
          <input type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, ""))} className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm tabular tracking-widest outline-none focus:border-gold" />
        </label>
        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={changePin} className="rounded-xl bg-surface-2 px-4 py-2 text-sm font-medium">Actualizar PIN</button>
          <button onClick={switchProfile} className="rounded-xl border border-border px-4 py-2 text-sm font-medium">Cambiar de perfil</button>
          <button onClick={removeProfile} className="rounded-xl border border-destructive/40 text-destructive px-4 py-2 text-sm font-medium">Eliminar mi perfil</button>
        </div>
      </section>
    </AppShell>
  );
}
