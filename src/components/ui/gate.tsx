import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { ChevronLeft, Mail, User, UserPlus } from "lucide-react";
import { authErrorMessage, sendLoginEmail, useSession, verifyLoginCode } from "@/lib/auth";
import {
  getCurrentUserId,
  isUnlocked,
  matchesLocalPin,
  rememberPinLocally,
  setCurrentUserId,
  setUnlocked,
  signOut,
} from "@/lib/pin-gate";
import {
  createMyProfile,
  fetchMyProfile,
  fetchUnlinkedProfiles,
  linkMyProfile,
  verifyProfilePin,
  type Profile,
} from "@/lib/store";

/** Cuenta de Supabase a la que pertenece el perfil guardado en este dispositivo. */
const PROFILE_OWNER_KEY = "malitos_profile_owner_v1";
const PROFILE_NAME_KEY = "malitos_profile_name_v1";

function readLocal(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeLocal(key: string, value: string | null) {
  try {
    if (value) window.localStorage.setItem(key, value);
    else window.localStorage.removeItem(key);
  } catch {
    /* almacenamiento no disponible */
  }
}

function rememberProfile(authUserId: string, profile: { id: string; name: string }) {
  setCurrentUserId(profile.id);
  writeLocal(PROFILE_OWNER_KEY, authUserId);
  writeLocal(PROFILE_NAME_KEY, profile.name);
}

const errorText = (e: unknown, fallback: string) => (e as { message?: string })?.message || fallback;

const inputCls =
  "w-full rounded-xl border border-border bg-surface px-4 py-3 text-center outline-none focus:border-gold";
const pinCls = `${inputCls} text-lg tabular tracking-widest`;
const primaryCls = "w-full rounded-xl gold-gradient py-3 font-medium disabled:opacity-60";
const secondaryCls =
  "flex w-full items-center justify-center gap-1 rounded-xl border border-border py-2.5 text-sm text-muted-foreground";

type ProfileState =
  | { status: "checking" }
  | { status: "linked"; profileId: string; name: string }
  | { status: "unlinked" }
  | { status: "error"; message: string };

/**
 * Entrada a la app:
 * 1. Sin sesión → correo (enlace o código de 6 dígitos).
 * 2. Con sesión pero sin perfil → vincular el perfil antiguo con su PIN, o crear uno.
 * 3. Con perfil → PIN como candado cada vez que se abre la app.
 */
export function PinGate({ children }: { children: ReactNode }) {
  const { session, loading } = useSession();
  const [unlocked, setUL] = useState(false);
  const [profile, setProfile] = useState<ProfileState>({ status: "checking" });

  useEffect(() => {
    setUL(isUnlocked());
  }, []);

  const authUserId = session?.user.id ?? null;

  const resolveProfile = useCallback(async (userId: string) => {
    // Perfil ya conocido en este dispositivo para esta cuenta: no hace falta red.
    const cachedId = getCurrentUserId();
    if (cachedId && readLocal(PROFILE_OWNER_KEY) === userId) {
      setProfile({ status: "linked", profileId: cachedId, name: readLocal(PROFILE_NAME_KEY) ?? "" });
      return;
    }
    setProfile({ status: "checking" });
    try {
      const mine = await fetchMyProfile(userId);
      if (mine) {
        rememberProfile(userId, mine);
        setProfile({ status: "linked", profileId: mine.id, name: mine.name });
      } else {
        setCurrentUserId(null);
        setProfile({ status: "unlinked" });
      }
    } catch (e) {
      setProfile({ status: "error", message: errorText(e, "No se pudo cargar tu perfil.") });
    }
  }, []);

  useEffect(() => {
    if (authUserId) void resolveProfile(authUserId);
  }, [authUserId, resolveProfile]);

  if (!loading && session && profile.status === "linked" && unlocked) return <>{children}</>;

  let body: ReactNode;
  let subtitle = "";
  if (loading || (session && profile.status === "checking")) {
    body = <div className="text-center text-sm text-muted-foreground">Cargando…</div>;
  } else if (!session) {
    subtitle = "Entra con tu correo";
    body = <EmailStep />;
  } else if (profile.status === "error") {
    subtitle = "Algo ha fallado";
    body = (
      <div className="space-y-3 text-center">
        <p className="text-sm text-destructive">{profile.message}</p>
        <button type="button" className={primaryCls} style={{ color: "var(--gold-foreground)" }} onClick={() => authUserId && resolveProfile(authUserId)}>
          Reintentar
        </button>
      </div>
    );
  } else if (profile.status === "unlinked") {
    subtitle = "Vincula tu perfil";
    body = (
      <LinkStep
        email={session.user.email ?? ""}
        onLinked={(p, pin) => {
          rememberProfile(session.user.id, p);
          void rememberPinLocally(p.id, pin);
          setUnlocked(true);
          setUL(true);
          setProfile({ status: "linked", profileId: p.id, name: p.name });
        }}
      />
    );
  } else if (profile.status === "linked") {
    subtitle = profile.name ? `Hola, ${profile.name}` : "Introduce tu PIN";
    body = (
      <PinLock
        profileId={profile.profileId}
        onUnlocked={() => {
          setUnlocked(true);
          setUL(true);
        }}
      />
    );
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
          <div className="mt-2 text-xs uppercase text-white/70" style={{ letterSpacing: "0.42em" }}>OR DIE</div>
          <div className="rule-fade mt-6 w-24" />
          {subtitle && <p className="mt-6 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        <div className="rise rise-2">{body}</div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 1. Correo
// ---------------------------------------------------------------------------

function EmailStep() {
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function send(target: string) {
    setError(null);
    setBusy(true);
    try {
      await sendLoginEmail(target);
      setSentTo(target);
      setCooldown(60);
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function onSubmitEmail(e: FormEvent) {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError("Escribe un correo válido.");
    await send(email.trim());
  }

  async function onSubmitCode(e: FormEvent) {
    e.preventDefault();
    if (!sentTo) return;
    if (code.trim().length < 6) return setError("El código tiene 6 dígitos.");
    setError(null);
    setBusy(true);
    try {
      await verifyLoginCode(sentTo, code);
      // La sesión llega por onAuthStateChange y la pantalla avanza sola.
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (!sentTo) {
    return (
      <form onSubmit={onSubmitEmail} className="space-y-3">
        <input
          autoFocus
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="tu@correo.com"
          aria-label="Correo electrónico"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputCls}
        />
        {error && <p role="alert" className="text-center text-sm text-destructive">{error}</p>}
        <button type="submit" disabled={busy} className={primaryCls} style={{ color: "var(--gold-foreground)" }}>
          {busy ? "Enviando…" : "Enviarme el acceso"}
        </button>
        <p className="text-center text-xs text-muted-foreground">Sin contraseñas: te llega un correo para entrar.</p>
      </form>
    );
  }

  return (
    <form onSubmit={onSubmitCode} className="space-y-3">
      <div className="flex items-start gap-3 rounded-2xl border border-border bg-surface p-4 text-sm">
        <Mail className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
        <p className="text-muted-foreground">
          Correo enviado a <span className="text-foreground">{sentTo}</span>. Pulsa el enlace o escribe aquí el código de 6 dígitos.
          En iPhone con la app instalada, usa el código.
        </p>
      </div>
      <input
        autoFocus
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        maxLength={6}
        placeholder="Código"
        aria-label="Código de acceso"
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ""))}
        className={pinCls}
      />
      {error && <p role="alert" className="text-center text-sm text-destructive">{error}</p>}
      <button type="submit" disabled={busy} className={primaryCls} style={{ color: "var(--gold-foreground)" }}>
        {busy ? "Comprobando…" : "Entrar"}
      </button>
      <button type="button" disabled={busy || cooldown > 0} onClick={() => send(sentTo)} className={`${secondaryCls} disabled:opacity-50`}>
        {cooldown > 0 ? `Reenviar en ${cooldown} s` : "Reenviar correo"}
      </button>
      <button type="button" onClick={() => { setSentTo(null); setCode(""); setError(null); }} className={secondaryCls}>
        <ChevronLeft className="h-4 w-4" /> Usar otro correo
      </button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// 2. Vincular o crear perfil (solo la primera vez con cada cuenta)
// ---------------------------------------------------------------------------

function LinkStep({ email, onLinked }: { email: string; onLinked: (profile: Profile, pin: string) => void }) {
  const [profiles, setProfiles] = useState<Profile[] | null>(null);
  const [mode, setMode] = useState<"pick" | "pin" | "create">("pick");
  const [selected, setSelected] = useState<Profile | null>(null);
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchUnlinkedProfiles()
      .then((list) => {
        setProfiles(list);
        if (list.length === 0) setMode("create");
      })
      .catch((e) => setError(errorText(e, "No se pudieron cargar los perfiles.")));
  }, []);

  async function submitLink(e: FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setError(null);
    setBusy(true);
    try {
      const ok = await linkMyProfile(selected.id, pin);
      if (ok) onLinked(selected, pin);
      else {
        setError("PIN incorrecto");
        setPin("");
      }
    } catch (err) {
      setError(errorText(err, "No se pudo vincular el perfil."));
    } finally {
      setBusy(false);
    }
  }

  async function submitCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const n = name.trim();
    if (n.length < 2) return setError("El nombre es demasiado corto");
    if (pin.length < 4) return setError("PIN mínimo 4 dígitos");
    if (pin !== pin2) return setError("Los PIN no coinciden");
    setBusy(true);
    try {
      const id = await createMyProfile(n, pin);
      onLinked({ id, name: n, created_at: new Date().toISOString() }, pin);
    } catch (err) {
      setError(errorText(err, "No se pudo crear el perfil."));
    } finally {
      setBusy(false);
    }
  }

  const signOutButton = (
    <button type="button" onClick={async () => { await signOut(); window.location.reload(); }} className={secondaryCls}>
      Salir y usar otro correo
    </button>
  );

  if (profiles === null && !error) {
    return <div className="text-center text-sm text-muted-foreground">Cargando perfiles…</div>;
  }

  if (mode === "pick") {
    return (
      <div className="space-y-2">
        <p className="mb-3 text-center text-xs text-muted-foreground">
          Has entrado como <span className="text-foreground">{email}</span>. Elige tu perfil de siempre para conservar tus datos.
        </p>
        {(profiles ?? []).map((p) => (
          <button
            key={p.id}
            onClick={() => { setSelected(p); setPin(""); setError(null); setMode("pin"); }}
            className="pressable group flex w-full items-center gap-3 rounded-[20px] border border-border bg-surface px-4 py-3.5 text-left hover:border-white/35"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-surface-2 text-foreground">
              <User className="h-4 w-4" />
            </div>
            <div className="flex-1 text-sm font-medium">{p.name}</div>
            <ChevronLeft className="h-4 w-4 rotate-180 text-muted-foreground" />
          </button>
        ))}
        <button
          onClick={() => { setMode("create"); setName(""); setPin(""); setPin2(""); setError(null); }}
          className="pressable flex w-full items-center gap-3 rounded-[20px] border border-dashed border-border px-4 py-3.5 text-left text-sm text-muted-foreground hover:border-white/35 hover:text-foreground"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-[14px] gold-gradient">
            <UserPlus className="h-4 w-4" style={{ color: "var(--gold-foreground)" }} />
          </div>
          Soy nuevo: crear perfil
        </button>
        {error && <p role="alert" className="text-center text-sm text-destructive">{error}</p>}
        <div className="pt-2">{signOutButton}</div>
      </div>
    );
  }

  if (mode === "pin" && selected) {
    return (
      <form onSubmit={submitLink} className="space-y-3">
        <p className="text-center text-sm text-muted-foreground">
          Escribe el PIN de <span className="text-foreground">{selected.name}</span> para vincularlo a tu correo. Solo se hace una vez.
        </p>
        <input
          autoFocus
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          placeholder="PIN"
          aria-label="PIN"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, ""))}
          className={pinCls}
        />
        {error && <p role="alert" className="text-center text-sm text-destructive">{error}</p>}
        <button type="submit" disabled={busy || pin.length < 4} className={primaryCls} style={{ color: "var(--gold-foreground)" }}>
          {busy ? "Vinculando…" : "Vincular y entrar"}
        </button>
        <button type="button" onClick={() => { setMode("pick"); setError(null); }} className={secondaryCls}>
          <ChevronLeft className="h-4 w-4" /> Elegir otro perfil
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={submitCreate} className="space-y-3">
      <input autoFocus type="text" placeholder="Tu nombre" aria-label="Tu nombre" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
      <input type="password" inputMode="numeric" pattern="[0-9]*" placeholder="PIN (mínimo 4 dígitos)" aria-label="PIN" value={pin} onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, ""))} className={pinCls} />
      <input type="password" inputMode="numeric" pattern="[0-9]*" placeholder="Confirma PIN" aria-label="Confirma el PIN" value={pin2} onChange={(e) => setPin2(e.target.value.replace(/[^0-9]/g, ""))} className={pinCls} />
      {error && <p role="alert" className="text-center text-sm text-destructive">{error}</p>}
      <button type="submit" disabled={busy} className={primaryCls} style={{ color: "var(--gold-foreground)" }}>
        {busy ? "Creando…" : "Crear perfil y entrar"}
      </button>
      {(profiles ?? []).length > 0 ? (
        <button type="button" onClick={() => { setMode("pick"); setError(null); }} className={secondaryCls}>
          <ChevronLeft className="h-4 w-4" /> Ya tengo perfil
        </button>
      ) : (
        signOutButton
      )}
    </form>
  );
}

// ---------------------------------------------------------------------------
// 3. PIN como candado
// ---------------------------------------------------------------------------

function PinLock({ profileId, onUnlocked }: { profileId: string; onUnlocked: () => void }) {
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      let ok: boolean;
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        ok = await matchesLocalPin(profileId, pin);
      } else {
        try {
          ok = await verifyProfilePin(profileId, pin);
          if (ok) await rememberPinLocally(profileId, pin);
        } catch (err) {
          // Sin red de verdad: comprobamos contra la huella guardada en el dispositivo.
          const message = errorText(err, "");
          if (/fetch|network|failed to/i.test(message)) ok = await matchesLocalPin(profileId, pin);
          else throw err;
        }
      }
      if (ok) onUnlocked();
      else {
        setError("PIN incorrecto");
        setPin("");
      }
    } catch (err) {
      setError(errorText(err, "No se pudo verificar el PIN"));
      setPin("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <input
        autoFocus
        type="password"
        inputMode="numeric"
        pattern="[0-9]*"
        placeholder="PIN"
        aria-label="PIN"
        value={pin}
        onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, ""))}
        className={pinCls}
      />
      {error && <p role="alert" className="text-center text-sm text-destructive">{error}</p>}
      <button type="submit" disabled={busy || pin.length < 4} className={primaryCls} style={{ color: "var(--gold-foreground)" }}>
        {busy ? "Comprobando…" : "Entrar"}
      </button>
      <button type="button" onClick={async () => { await signOut(); window.location.reload(); }} className={secondaryCls}>
        Cerrar sesión
      </button>
    </form>
  );
}
