import { useEffect, useState } from "react";
import { setUnlocked, sha256, setCurrentUserId, getCurrentUserId, isUnlocked } from "@/lib/pin-gate";
import { useProfiles, useCreateProfile } from "@/lib/store";
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

  if (!ready || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground text-sm">Cargando…</div>
      </div>
    );
  }
  if (unlocked && getCurrentUserId()) return <>{children}</>;

  const selected = profiles.find((p) => p.id === selectedId);

  async function submitPin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!selected) return;
    const hash = await sha256(pin);
    if (hash === selected.pin_hash) {
      setCurrentUserId(selected.id);
      setUnlocked(true);
      setUL(true);
    } else {
      setError("PIN incorrecto");
      setPin("");
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
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-border" style={{ background: "linear-gradient(135deg, var(--gold), var(--gold-soft))" }}>
            <span className="text-2xl font-bold" style={{ color: "var(--gold-foreground)" }}>M</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Malitos Premium Check</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {mode === "pick" && "Selecciona tu perfil"}
            {mode === "pin" && `Introduce el PIN de ${selected?.name ?? ""}`}
            {mode === "create" && "Crea tu perfil"}
          </p>
        </div>

        {mode === "pick" && (
          <div className="space-y-2">
            {profiles.map((p) => (
              <button
                key={p.id}
                onClick={() => { setSelectedId(p.id); setPin(""); setError(null); setMode("pin"); }}
                className="flex w-full items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-left transition hover:border-gold/50"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-2 text-gold">
                  <User className="h-4 w-4" />
                </div>
                <div className="flex-1 text-sm font-medium">{p.name}</div>
              </button>
            ))}
            <button
              onClick={() => { setMode("create"); setName(""); setPin(""); setPin2(""); setError(null); }}
              className="flex w-full items-center gap-3 rounded-xl border border-dashed border-border px-4 py-3 text-left text-sm text-muted-foreground transition hover:border-gold/50 hover:text-foreground"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg gold-gradient">
                <UserPlus className="h-4 w-4" style={{ color: "var(--gold-foreground)" }} />
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
