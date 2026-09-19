import { useEffect, useState } from "react";
import { setUnlocked, setCurrentUserId, getCurrentUserId, isUnlocked } from "@/lib/pin-gate";
import { useProfiles, useCreateProfile, verifyProfilePin } from "@/lib/store";

import { UserPlus, ChevronLeft, User } from "lucide-react";

type Mode = "pick" | "pin" | "create";

export function PinGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [unlocked, setUL] = useState(false);
  const { data: profiles = [], isLoading } = useProfiles();
  const createProfile = useCreateProfile();

  const [mode, setMode] = useState<Mode>("pick");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setUL(isUnlocked());
    setReady(true);
  }, []);

  // Auto-jump to create when there are no profiles yet
  useEffect(() => {
    if (ready && !isLoading && profiles.length === 0 && mode === "pick") {
      setMode("create");
    }
  }, [ready, isLoading, profiles.length, mode]);

  // Already unlocked: never wait on the network (works with no connection).
  if (ready && unlocked && getCurrentUserId()) return <>{children}</>;

  if (!ready || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground text-sm">Cargando…</div>
      </div>
    );
  }

  const selected = profiles.find((p) => p.id === selectedId);

  async function submitPin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!selected) return;
    try {
      const ok = await verifyProfilePin(selected.id, pin);
      if (ok) {
        setCurrentUserId(selected.id);
        setUnlocked(true);
        setUL(true);
      } else {
        setError("PIN incorrecto");
        setPin("");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo verificar el PIN");
    }
  }


  async function submitCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const n = name.trim();
    if (n.length < 2) return setError("El nombre es demasiado corto");
    if (pin.length < 4) return setError("PIN mínimo 4 dígitos");
    if (pin !== pin2) return setError("Los PIN no coinciden");
    if (profiles.some((p) => p.name.toLowerCase() === n.toLowerCase())) {
      return setError("Ya existe un perfil con ese nombre");
    }
    try {
      const p = await createProfile.mutateAsync({ name: n, pin });
      setCurrentUserId(p.id);
      setUnlocked(true);
      setUL(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear el perfil");
    }
  }

  return (
    <div className="grain relative flex min-h-screen items-center justify-center px-6 py-12">
      <div aria-hidden className="aura pointer-events-none absolute inset-x-0 top-0 h-[380px]" />
      <div
        aria-hidden
        className="dotgrid pointer-events-none absolute inset-0 opacity-[0.3]"
        style={{ maskImage: "radial-gradient(70% 50% at 50% 20%, #000, transparent)", WebkitMaskImage: "radial-gradient(70% 50% at 50% 20%, #000, transparent)" }}
      />
      <div className="relative w-full max-w-sm">
        <div className="rise rise-1 mb-10 flex flex-col items-center text-center">
          <div className="font-bold leading-none tracking-tight" style={{ fontSize: "60px", letterSpacing: "-0.06em", color: "var(--foreground)" }}>
            RM
          </div>
          <div className="mt-2 text-[10px] uppercase text-white/70" style={{ letterSpacing: "0.42em" }}>OR DIE</div>
          <div className="rule-fade mt-6 w-24" />
          <p className="mt-6 text-sm text-muted-foreground">
            {mode === "pick" && "Selecciona tu perfil"}
            {mode === "pin" && `Introduce el PIN de ${selected?.name ?? ""}`}
            {mode === "create" && "Crea tu perfil"}
          </p>
        </div>

        {mode === "pick" && (
          <div className="rise rise-2 space-y-2">
            {profiles.map((p) => (
              <button
                key={p.id}
                onClick={() => { setSelectedId(p.id); setPin(""); setError(null); setMode("pin"); }}
                className="pressable group flex w-full items-center gap-3 rounded-[20px] border border-border bg-surface px-4 py-3.5 text-left hover:border-white/35"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-surface-2 text-foreground">
                  <User className="h-4 w-4" />
                </div>
                <div className="flex-1 text-sm font-medium">{p.name}</div>
                <ChevronLeft className="h-4 w-4 rotate-180 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </button>
            ))}
            <button
              onClick={() => { setMode("create"); setName(""); setPin(""); setPin2(""); setError(null); }}
              className="pressable flex w-full items-center gap-3 rounded-[20px] border border-dashed border-border px-4 py-3.5 text-left text-sm text-muted-foreground hover:border-white/35 hover:text-foreground"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-[14px]" style={{ background: "linear-gradient(140deg,#EBD6A6,#D8B46B)" }}>
                <UserPlus className="h-4 w-4" style={{ color: "var(--foreground)" }} />
              </div>
              Crear nuevo perfil
            </button>
          </div>
        )}

        {mode === "pin" && (
          <form onSubmit={submitPin} className="space-y-3">
            <input
              autoFocus
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, ""))}
              className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-center text-lg tabular tracking-widest outline-none focus:border-gold"
            />
            {error && <p className="text-center text-sm text-destructive">{error}</p>}
            <button type="submit" className="w-full rounded-xl gold-gradient py-3 font-medium" style={{ color: "var(--gold-foreground)" }}>
              Entrar
            </button>
            <button
              type="button"
              onClick={() => { setMode("pick"); setPin(""); setError(null); }}
              className="flex w-full items-center justify-center gap-1 rounded-xl border border-border py-2.5 text-sm text-muted-foreground"
            >
              <ChevronLeft className="h-4 w-4" /> Cambiar de perfil
            </button>
          </form>
        )}

        {mode === "create" && (
          <form onSubmit={submitCreate} className="space-y-3">
            <input
              autoFocus
              type="text"
              placeholder="Tu nombre"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-center outline-none focus:border-gold"
            />
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="PIN (mínimo 4 dígitos)"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, ""))}
              className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-center text-lg tabular tracking-widest outline-none focus:border-gold"
            />
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="Confirma PIN"
              value={pin2}
              onChange={(e) => setPin2(e.target.value.replace(/[^0-9]/g, ""))}
              className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-center text-lg tabular tracking-widest outline-none focus:border-gold"
            />
            {error && <p className="text-center text-sm text-destructive">{error}</p>}
            <button
              type="submit"
              disabled={createProfile.isPending}
              className="w-full rounded-xl gold-gradient py-3 font-medium disabled:opacity-60"
              style={{ color: "var(--gold-foreground)" }}
            >
              {createProfile.isPending ? "Creando…" : "Crear perfil y entrar"}
            </button>
            {profiles.length > 0 && (
              <button
                type="button"
                onClick={() => { setMode("pick"); setError(null); }}
                className="flex w-full items-center justify-center gap-1 rounded-xl border border-border py-2.5 text-sm text-muted-foreground"
              >
                <ChevronLeft className="h-4 w-4" /> Volver a perfiles
              </button>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
