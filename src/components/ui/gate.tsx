import { useEffect, useState } from "react";
import { isUnlocked, setUnlocked, sha256 } from "@/lib/pin-gate";
import { useSettings, useSaveSettings } from "@/lib/store";

export function PinGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [unlocked, setUL] = useState(false);
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { data: settings, isLoading } = useSettings();
  const save = useSaveSettings();

  useEffect(() => {
    setUL(isUnlocked());
    setReady(true);
  }, []);

  if (!ready || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground text-sm">Cargando…</div>
      </div>
    );
  }
  if (unlocked) return <>{children}</>;

  const isFirstTime = !settings?.pin_hash;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (isFirstTime) {
      if (pin.length < 4) return setError("Mínimo 4 dígitos");
      if (pin !== pin2) return setError("Los PIN no coinciden");
      const hash = await sha256(pin);
      await save.mutateAsync({ pin_hash: hash });
      setUnlocked(true);
      setUL(true);
    } else {
      const hash = await sha256(pin);
      if (hash === settings!.pin_hash) {
        setUnlocked(true);
        setUL(true);
      } else {
        setError("PIN incorrecto");
        setPin("");
      }
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-border" style={{ background: "linear-gradient(135deg, var(--gold), var(--gold-soft))" }}>
            <span className="text-2xl font-bold" style={{ color: "var(--gold-foreground)" }}>M</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Malitos Premium Check</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {isFirstTime ? "Crea tu PIN para proteger tus datos" : "Introduce tu PIN"}
          </p>
        </div>
        <form onSubmit={submit} className="space-y-3">
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
          {isFirstTime && (
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="Confirma PIN"
              value={pin2}
              onChange={(e) => setPin2(e.target.value.replace(/[^0-9]/g, ""))}
              className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-center text-lg tabular tracking-widest outline-none focus:border-gold"
            />
          )}
          {error && <p className="text-center text-sm text-destructive">{error}</p>}
          <button
            type="submit"
            className="w-full rounded-xl py-3 font-medium transition hover:opacity-90 gold-gradient"
            style={{ color: "var(--gold-foreground)" }}
          >
            {isFirstTime ? "Crear PIN y entrar" : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
