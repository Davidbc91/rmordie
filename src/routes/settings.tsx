import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useSettings, useSaveSettings, useProfiles, useUpdateProfilePin, useDeleteProfile } from "@/lib/store";
import { signOut, getCurrentUserId } from "@/lib/pin-gate";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { NotificationSettings } from "@/components/NotificationSettings";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Ajustes — RM OR DIE" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const navigate = useNavigate();
  const uid = getCurrentUserId();
  const { data: s, isLoading: settingsLoading, isError: settingsError } = useSettings();
  const { data: profiles = [] } = useProfiles();
  const save = useSaveSettings();
  const updatePin = useUpdateProfilePin();
  const deleteProfile = useDeleteProfile();
  const me = profiles.find((p) => p.id === uid);

  const [bars, setBars] = useState(s?.bar_weights.join(", ") ?? "10, 15, 20");
  const [plates, setPlates] = useState(s?.plate_weights.join(", ") ?? "20, 15, 10, 5, 2.5, 1.25");
  const [barsEdited, setBarsEdited] = useState(false);
  const [platesEdited, setPlatesEdited] = useState(false);
  const [pin, setPin] = useState("");
  const [currentPin, setCurrentPin] = useState("");

  useEffect(() => {
    setBarsEdited(false);
    setPlatesEdited(false);
  }, [uid]);

  useEffect(() => {
    if (!s) return;
    if (!barsEdited) setBars(s.bar_weights.join(", "));
    if (!platesEdited) setPlates(s.plate_weights.join(", "));
  }, [s, barsEdited, platesEdited]);

  async function saveGym() {
    const parseList = (t: string) => t.split(",").map((x) => Number(x.trim())).filter((n) => n > 0);
    await save.mutateAsync({ bar_weights: parseList(bars), plate_weights: parseList(plates) });
    toast.success("Material guardado");
  }

  const errorMessage = (e: unknown, fallback: string) => (e as { message?: string })?.message ?? fallback;

  async function changePin() {
    if (!uid) return;
    if (currentPin.length < 4) return toast.error("Escribe tu PIN actual");
    if (pin.length < 4) return toast.error("El PIN nuevo necesita mínimo 4 dígitos");
    try {
      await updatePin.mutateAsync({ id: uid, currentPin, pin });
      setPin("");
      setCurrentPin("");
      toast.success("PIN actualizado");
    } catch (e) {
      toast.error(errorMessage(e, "No se pudo cambiar el PIN"));
    }
  }

  function switchProfile() {
    signOut();
    navigate({ to: "/" });
    setTimeout(() => window.location.reload(), 50);
  }

  async function removeProfile() {
    if (!uid) return;
    if (currentPin.length < 4) return toast.error("Escribe tu PIN actual para eliminar el perfil");
    const ok = window.confirm("¿Eliminar tu perfil y TODOS tus registros? Esta acción no se puede deshacer.");
    if (!ok) return;
    try {
      await deleteProfile.mutateAsync({ id: uid, pin: currentPin });
    } catch (e) {
      toast.error(errorMessage(e, "No se pudo eliminar el perfil"));
      return;
    }
    signOut();
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
        {settingsLoading && <p className="mt-2 text-xs text-muted-foreground">Cargando tu material guardado…</p>}
        {settingsError && !s && <p role="alert" className="mt-2 text-xs text-destructive">No se pudo cargar tu material. Inténtalo de nuevo antes de guardar.</p>}
        <label className="mt-4 block">
          <span className="mb-1 block text-[11px] uppercase tracking-wider text-muted-foreground">Barras (kg)</span>
          <input value={bars} onChange={(e) => { setBarsEdited(true); setBars(e.target.value); }} disabled={!s} className="min-h-11 w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm tabular outline-none focus:border-gold disabled:opacity-50" />
        </label>
        <label className="mt-3 block">
          <span className="mb-1 block text-[11px] uppercase tracking-wider text-muted-foreground">Discos por lado (kg)</span>
          <input value={plates} onChange={(e) => { setPlatesEdited(true); setPlates(e.target.value); }} disabled={!s} className="min-h-11 w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm tabular outline-none focus:border-gold disabled:opacity-50" />
        </label>
        <button onClick={saveGym} disabled={!s || save.isPending} className="mt-4 rounded-xl gold-gradient px-4 py-2 text-sm font-semibold disabled:opacity-50" style={{ color: "var(--gold-foreground)" }}>{save.isPending ? "Guardando…" : "Guardar"}</button>
      </section>

      <NotificationSettings />

      <section className="mt-4 card-elevated p-5">
        <h2 className="text-sm font-semibold">Perfil y seguridad</h2>
        <label className="mt-3 block">
          <span className="mb-1 block text-[11px] uppercase tracking-wider text-muted-foreground">PIN actual</span>
          <input type="password" inputMode="numeric" autoComplete="current-password" value={currentPin} onChange={(e) => setCurrentPin(e.target.value.replace(/[^0-9]/g, ""))} className="min-h-11 w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm tabular tracking-widest outline-none focus:border-gold" />
          <span className="mt-1 block text-xs text-muted-foreground">Necesario para cambiar el PIN o eliminar el perfil.</span>
        </label>
        <label className="mt-3 block">
          <span className="mb-1 block text-[11px] uppercase tracking-wider text-muted-foreground">PIN nuevo</span>
          <input type="password" inputMode="numeric" autoComplete="new-password" value={pin} onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, ""))} className="min-h-11 w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm tabular tracking-widest outline-none focus:border-gold" />
        </label>
        <div className="mt-4 grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
          <button onClick={changePin} disabled={updatePin.isPending} className="rounded-xl bg-surface-2 px-4 py-2 text-sm font-medium disabled:opacity-50">{updatePin.isPending ? "Actualizando…" : "Actualizar PIN"}</button>
          <button onClick={switchProfile} className="rounded-xl border border-border px-4 py-2 text-sm font-medium">Cambiar de perfil</button>
          <button onClick={removeProfile} disabled={deleteProfile.isPending} className="rounded-xl border border-destructive/40 text-destructive px-4 py-2 text-sm font-medium disabled:opacity-50">Eliminar mi perfil</button>
        </div>
      </section>
    </AppShell>
  );
}
