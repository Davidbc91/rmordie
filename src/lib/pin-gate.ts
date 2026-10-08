// Perfil vinculado a la sesión en este dispositivo + PIN como candado.
//
// - El perfil lo decide la cuenta con la que se inicia sesión (se guarda aquí
//   para que la app abra sin conexión).
// - El candado del PIN dura mientras la app está abierta (sessionStorage): al
//   volver a abrirla se pide de nuevo.
// - Tras comprobar el PIN con conexión se guarda una huella local para poder
//   desbloquear también sin conexión.
import { supabase } from "@/integrations/supabase/client";

const UNLOCK_KEY = "malitos_unlocked_v3";
const USER_KEY = "malitos_current_user_v1";
const LOCAL_PIN_KEY = "malitos_pin_local_v1";

export async function sha256(s: string): Promise<string> {
  const buf = new TextEncoder().encode(s);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function safeStorage(kind: "local" | "session"): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return kind === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

export function isUnlocked(): boolean {
  return safeStorage("session")?.getItem(UNLOCK_KEY) === "1" && !!getCurrentUserId();
}
export function setUnlocked(v: boolean) {
  const store = safeStorage("session");
  if (!store) return;
  if (v) store.setItem(UNLOCK_KEY, "1");
  else store.removeItem(UNLOCK_KEY);
}

export function getCurrentUserId(): string | null {
  return safeStorage("local")?.getItem(USER_KEY) ?? null;
}
export function setCurrentUserId(id: string | null) {
  const store = safeStorage("local");
  if (!store) return;
  if (id) store.setItem(USER_KEY, id);
  else store.removeItem(USER_KEY);
}

/** Huella del PIN ligada al perfil y al dispositivo, para desbloquear sin conexión. */
async function localPinFingerprint(profileId: string, pin: string) {
  return sha256(`rmordie-local:${profileId}:${pin}`);
}
export async function rememberPinLocally(profileId: string, pin: string) {
  safeStorage("local")?.setItem(LOCAL_PIN_KEY, await localPinFingerprint(profileId, pin));
}
export async function matchesLocalPin(profileId: string, pin: string): Promise<boolean> {
  const stored = safeStorage("local")?.getItem(LOCAL_PIN_KEY);
  return !!stored && stored === (await localPinFingerprint(profileId, pin));
}

/** Cierra la sesión en este dispositivo y olvida el perfil y el candado. */
export async function signOut() {
  setUnlocked(false);
  setCurrentUserId(null);
  safeStorage("local")?.removeItem(LOCAL_PIN_KEY);
  try {
    await supabase.auth.signOut({ scope: "local" });
  } catch {
    /* sin conexión: la sesión local ya se ha borrado */
  }
}
