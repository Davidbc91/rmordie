import { useEffect, useState } from "react";
import { ScanFace } from "lucide-react";
import { toast } from "sonner";
import { getCurrentUserId } from "@/lib/pin-gate";
import { useProfiles } from "@/lib/store";
import { biometricLabel, disableBiometric, enableBiometric, isBiometricAvailable, isBiometricEnabled } from "@/lib/biometric";

/** Ajustes: desbloquear la app con Face ID / huella en este móvil. */
export function BiometricSettings() {
  const profileId = getCurrentUserId();
  const { data: profiles = [] } = useProfiles();
  const me = profiles.find((p) => p.id === profileId);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [on, setOn] = useState(() => isBiometricEnabled(profileId));
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const label = biometricLabel();

  useEffect(() => {
    void isBiometricAvailable().then(setAvailable);
  }, []);

  // Sin Face ID / huella en este móvil (o navegador que no lo permite): no se muestra.
  if (!profileId || available !== true) return null;

  async function activate() {
    if (!profileId) return;
    setBusy(true);
    try {
      await enableBiometric(profileId, me?.name ?? "");
      setOn(true);
      setConfirming(false);
      toast.success(`${label} activado en este móvil`);
    } catch (e) {
      const name = (e as { name?: string })?.name;
      if (name !== "NotAllowedError" && name !== "AbortError") toast.error(`No se pudo activar ${label}. Inténtalo de nuevo.`);
    } finally {
      setBusy(false);
    }
  }

  function toggle() {
    if (on) {
      disableBiometric(profileId);
      setOn(false);
      toast(`${label} desactivado. Entrarás con tu PIN.`);
    } else setConfirming(true);
  }

  return (
    <section className="mt-4 card-elevated p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: "var(--gold-tint)" }}>
            <ScanFace className="h-5 w-5" style={{ color: "var(--gold)" }} />
          </span>
          <div>
            <h2 className="text-sm font-semibold">Desbloquear con {label}</h2>
            <p className="text-xs text-muted-foreground">{on ? "✓ Activado en este móvil" : "En este móvil"}</p>
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label={`Desbloquear con ${label}`}
          onClick={toggle}
          disabled={busy}
          className="relative h-7 w-12 shrink-0 rounded-full transition disabled:opacity-60"
          style={{ background: on ? "var(--gold)" : "var(--chip)" }}
        >
          <span className="absolute top-[3px] h-[22px] w-[22px] rounded-full transition-all" style={{ left: on ? 23 : 3, background: on ? "var(--gold-foreground)" : "#FFFFFF" }} />
        </button>
      </div>
      {!on && !confirming && (
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">Al abrir la app entrarás mirando al móvil. El PIN sigue sirviendo si {label} falla.</p>
      )}
      {confirming && (
        <div className="mt-4 space-y-3 rounded-2xl border border-border p-4">
          <p className="text-sm font-semibold">¿Activar {label}?</p>
          <p className="text-xs leading-relaxed text-muted-foreground">El móvil te lo pedirá para confirmar. Tu cara o tu huella no salen nunca del teléfono: ni la app ni nadie ve ninguna imagen.</p>
          <button type="button" onClick={() => void activate()} disabled={busy} className="min-h-12 w-full rounded-xl gold-gradient text-sm font-bold disabled:opacity-60" style={{ color: "var(--gold-foreground)" }}>
            {busy ? "Esperando…" : "Activar"}
          </button>
          <button type="button" onClick={() => setConfirming(false)} className="min-h-11 w-full rounded-xl border border-border text-sm font-semibold text-muted-foreground">
            Ahora no
          </button>
        </div>
      )}
    </section>
  );
}
