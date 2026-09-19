import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { setUnlocked, setCurrentUserId, getCurrentUserId } from "@/lib/pin-gate";
import { useProfiles, claimProfile, createLinkedProfile, fetchMyProfileId } from "@/lib/store";

import { UserPlus, ChevronLeft, User, Mail } from "lucide-react";

type Stage = "loading" | "auth" | "claim" | "ready";
type ClaimMode = "pick" | "pin" | "create";

const inputCls =
  "w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm outline-none focus:border-gold";
const pinCls =
  "w-full rounded-xl border border-border bg-surface px-4 py-3 text-center text-lg tabular tracking-widest outline-none focus:border-gold";
const goldBtn = "tap w-full rounded-xl gold-gradient py-3 font-medium disabled:opacity-60";

export function PinGate({ children }: { children: React.ReactNode }) {
  const [stage, setStage] = useState<Stage>("loading");
  const [session, setSession] = useState<Session | null>(null);

  // ---- account form ----
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ---- profile claim ----
  const { data: profiles = [], isLoading: loadingProfiles, refetch } = useProfiles();
  const [mode, setMode] = useState<ClaimMode>("pick");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [name, setName] = useState("");

  useEffect(() => {
    let alive = true;
    const resolve = async (s: Session | null) => {
      if (!alive) return;
      setSession(s);
      if (!s) {
        setCurrentUserId(null);
        setUnlocked(false);
        setStage("auth");
        return;
      }
      try {
        const id = await fetchMyProfileId();
        if (!alive) return;
        if (id) {
          setCurrentUserId(id);
          setUnlocked(true);
          setStage("ready");
        } else {
          setStage("claim");
        }
      } catch {
        if (alive) setStage("claim");
      }
    };

    supabase.auth.getSession().then(({ data }) => resolve(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        void resolve(s);
      }
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function submitAuth(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    const mail = email.trim().toLowerCase();
    if (!mail.includes("@")) return setError("Introduce un email válido");
    if (password.length < 6) return setError("La contraseña necesita al menos 6 caracteres");
    setBusy(true);
    try {
      if (authMode === "signup") {
        const { data, error: err } = await supabase.auth.signUp({
          email: mail,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (err) throw err;
        if (!data.session) {
          setInfo("Te hemos enviado un email para confirmar tu cuenta. Ábrelo y vuelve aquí.");
        }
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email: mail, password });
        if (err) throw err;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "No se pudo completar el acceso";
      setError(
        /invalid login/i.test(msg)
          ? "Email o contraseña incorrectos"
          : /already registered|user already/i.test(msg)
            ? "Ese email ya tiene cuenta. Entra con tu contraseña."
            : /not confirmed/i.test(msg)
              ? "Confirma tu email antes de entrar"
              : msg,
      );
    } finally {
      setBusy(false);
    }
  }

  async function submitClaim(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!selectedId) return;
    setBusy(true);
    try {
      const ok = await claimProfile(selectedId, pin);
      if (ok) {
        setCurrentUserId(selectedId);
        setUnlocked(true);
        setStage("ready");
      } else {
        setError("PIN incorrecto o ficha ya enlazada a otra cuenta");
        setPin("");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo enlazar la ficha");
    } finally {
      setBusy(false);
    }
  }

  async function submitCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const n = name.trim();
    if (n.length < 2) return setError("El nombre es demasiado corto");
    if (pin.length < 4) return setError("PIN mínimo 4 dígitos");
    if (pin !== pin2) return setError("Los PIN no coinciden");
    setBusy(true);
    try {
      const id = await createLinkedProfile(n, pin);
      await refetch();
      setCurrentUserId(id);
      setUnlocked(true);
      setStage("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la ficha");
    } finally {
      setBusy(false);
    }
  }

  async function backToAuth() {
    setCurrentUserId(null);
    setUnlocked(false);
    await supabase.auth.signOut();
    setStage("auth");
  }

  if (stage === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground text-sm">Cargando…</div>
      </div>
    );
  }

  if (stage === "ready" && getCurrentUserId()) return <>{children}</>;

  const selected = profiles.find((p) => p.id === selectedId);
  const subtitle =
    stage === "auth"
      ? authMode === "signin"
        ? "Entra con tu cuenta"
        : "Crea tu cuenta"
      : mode === "pick"
        ? "Elige tu ficha de atleta"
        : mode === "pin"
          ? `Confirma con el PIN de ${selected?.name ?? ""}`
          : "Crea tu ficha de atleta";

  return (
    <div className="grain relative flex min-h-screen items-center justify-center px-6 py-12">
      <div aria-hidden className="aura pointer-events-none absolute inset-x-0 top-0 h-[380px]" />
      <div
        aria-hidden
        className="dotgrid pointer-events-none absolute inset-0 opacity-[0.3]"
        style={{
          maskImage: "radial-gradient(70% 50% at 50% 20%, #000, transparent)",
          WebkitMaskImage: "radial-gradient(70% 50% at 50% 20%, #000, transparent)",
        }}
      />
      <div className="relative w-full max-w-sm">
        <div className="rise rise-1 mb-10 flex flex-col items-center text-center">
          <div
            className="font-bold leading-none tracking-tight"
            style={{ fontSize: "60px", letterSpacing: "-0.06em", color: "var(--foreground)" }}
          >
            RM
          </div>
          <div className="mt-2 text-[10px] uppercase text-white/70" style={{ letterSpacing: "0.42em" }}>
            OR DIE
          </div>
          <div className="rule-fade mt-6 w-24" />
          <p className="mt-6 text-sm text-muted-foreground">{subtitle}</p>
        </div>

        {stage === "auth" && (
          <form onSubmit={submitAuth} className="rise rise-2 space-y-3">
            <div className="relative">
              <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                autoFocus
                type="email"
                autoComplete="email"
                inputMode="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputCls + " pl-11"}
              />
            </div>
            <input
              type="password"
              autoComplete={authMode === "signup" ? "new-password" : "current-password"}
              placeholder="Contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputCls}
            />
            {error && <p className="text-center text-sm text-destructive">{error}</p>}
            {info && <p className="text-center text-sm text-muted-foreground">{info}</p>}
            <button type="submit" disabled={busy} className={goldBtn} style={{ color: "var(--gold-foreground)" }}>
              {busy ? "Un momento…" : authMode === "signin" ? "Entrar" : "Crear cuenta"}
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode(authMode === "signin" ? "signup" : "signin");
                setError(null);
                setInfo(null);
              }}
              className="tap w-full rounded-xl border border-border py-2.5 text-sm text-muted-foreground"
            >
              {authMode === "signin" ? "No tengo cuenta todavía" : "Ya tengo cuenta"}
            </button>
          </form>
        )}

        {stage === "claim" && mode === "pick" && (
          <div className="rise rise-2 space-y-2">
            <p className="mb-3 text-center text-xs text-muted-foreground">
              Enlaza tu cuenta con tu ficha para recuperar tus entrenos y récords.
            </p>
            {loadingProfiles && <p className="text-center text-sm text-muted-foreground">Cargando fichas…</p>}
            {profiles.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  setSelectedId(p.id);
                  setPin("");
                  setError(null);
                  setMode("pin");
                }}
                className="pressable tap group flex w-full items-center gap-3 rounded-[20px] border border-border bg-surface px-4 py-3.5 text-left hover:border-white/35"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-surface-2 text-foreground">
                  <User className="h-4 w-4" />
                </div>
                <div className="flex-1 text-sm font-medium">{p.name}</div>
                <ChevronLeft className="h-4 w-4 rotate-180 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </button>
            ))}
            <button
              onClick={() => {
                setMode("create");
                setName("");
                setPin("");
                setPin2("");
                setError(null);
              }}
              className="pressable tap flex w-full items-center gap-3 rounded-[20px] border border-dashed border-border px-4 py-3.5 text-left text-sm text-muted-foreground hover:border-white/35 hover:text-foreground"
            >
              <div
                className="flex h-10 w-10 items-center justify-center rounded-[14px]"
                style={{ background: "linear-gradient(140deg,#EBD6A6,#D8B46B)" }}
              >
                <UserPlus className="h-4 w-4" style={{ color: "var(--gold-foreground)" }} />
              </div>
              Soy nuevo, crear mi ficha
            </button>
            <button
              type="button"
              onClick={backToAuth}
              className="tap flex w-full items-center justify-center gap-1 rounded-xl border border-border py-2.5 text-sm text-muted-foreground"
            >
              <ChevronLeft className="h-4 w-4" /> Cambiar de cuenta
            </button>
          </div>
        )}

        {stage === "claim" && mode === "pin" && (
          <form onSubmit={submitClaim} className="space-y-3">
            <input
              autoFocus
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, ""))}
              className={pinCls}
            />
            {error && <p className="text-center text-sm text-destructive">{error}</p>}
            <button type="submit" disabled={busy} className={goldBtn} style={{ color: "var(--gold-foreground)" }}>
              {busy ? "Enlazando…" : "Enlazar ficha"}
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("pick");
                setPin("");
                setError(null);
              }}
              className="tap flex w-full items-center justify-center gap-1 rounded-xl border border-border py-2.5 text-sm text-muted-foreground"
            >
              <ChevronLeft className="h-4 w-4" /> Elegir otra ficha
            </button>
          </form>
        )}

        {stage === "claim" && mode === "create" && (
          <form onSubmit={submitCreate} className="space-y-3">
            <input
              autoFocus
              type="text"
              placeholder="Tu nombre"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputCls + " text-center"}
            />
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="PIN (mínimo 4 dígitos)"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, ""))}
              className={pinCls}
            />
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="Confirma PIN"
              value={pin2}
              onChange={(e) => setPin2(e.target.value.replace(/[^0-9]/g, ""))}
              className={pinCls}
            />
            {error && <p className="text-center text-sm text-destructive">{error}</p>}
            <button type="submit" disabled={busy} className={goldBtn} style={{ color: "var(--gold-foreground)" }}>
              {busy ? "Creando…" : "Crear ficha y entrar"}
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("pick");
                setError(null);
              }}
              className="tap flex w-full items-center justify-center gap-1 rounded-xl border border-border py-2.5 text-sm text-muted-foreground"
            >
              <ChevronLeft className="h-4 w-4" /> Volver a las fichas
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
