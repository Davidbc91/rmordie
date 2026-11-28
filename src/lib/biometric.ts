/**
 * Desbloqueo con Face ID / huella (WebAuthn, autenticador del propio móvil).
 *
 * Sustituye al PIN como candado local: la sesión de la cuenta sigue siendo la
 * de Supabase. La cara o la huella nunca salen del teléfono; el sistema solo
 * confirma que es la persona dueña del móvil. Se guarda por perfil y dispositivo.
 */

const KEY = "rmordie_bio_v1";

function storage(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

function toB64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function fromB64(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

function randomBytes(n = 32): Uint8Array {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return b;
}

/** ¿El móvil tiene Face ID / huella disponible para la app? */
export async function isBiometricAvailable(): Promise<boolean> {
  try {
    if (typeof window === "undefined" || !window.PublicKeyCredential || !window.isSecureContext) return false;
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

/** Nombre para mostrar según el móvil. */
export function biometricLabel(): string {
  if (typeof navigator === "undefined") return "Face ID";
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return "Face ID";
  if (/Macintosh/i.test(ua)) return "Touch ID";
  return "huella o cara";
}

export function isBiometricEnabled(profileId: string | null): boolean {
  if (!profileId) return false;
  return !!storage()?.getItem(`${KEY}:${profileId}`);
}

/** Activa el desbloqueo: el móvil pide la cara/huella para crear la llave. */
export async function enableBiometric(profileId: string, displayName: string): Promise<void> {
  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge: randomBytes(),
      rp: { name: "RM OR DIE" },
      user: { id: new TextEncoder().encode(profileId).slice(0, 64), name: displayName || "RM OR DIE", displayName: displayName || "RM OR DIE" },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },
        { type: "public-key", alg: -257 },
      ],
      authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "preferred" },
      timeout: 60_000,
      attestation: "none",
    },
  })) as PublicKeyCredential | null;
  if (!cred) throw new Error("No se pudo activar.");
  storage()?.setItem(`${KEY}:${profileId}`, toB64(cred.rawId));
}

export function disableBiometric(profileId: string | null) {
  if (profileId) storage()?.removeItem(`${KEY}:${profileId}`);
}

/** Borra todas las llaves de desbloqueo de este dispositivo (al cerrar sesión). */
export function clearAllBiometric() {
  const s = storage();
  if (!s) return;
  for (let i = s.length - 1; i >= 0; i--) {
    const k = s.key(i);
    if (k?.startsWith(`${KEY}:`)) s.removeItem(k);
  }
}

export type BiometricResult = "ok" | "cancelled" | "failed";

/** Pide la cara/huella. "cancelled" = el usuario lo cerró o el sistema no dejó lanzarlo. */
export async function unlockWithBiometric(profileId: string): Promise<BiometricResult> {
  const id = storage()?.getItem(`${KEY}:${profileId}`);
  if (!id) return "failed";
  try {
    const cred = (await navigator.credentials.get({
      publicKey: {
        challenge: randomBytes(),
        allowCredentials: [{ type: "public-key", id: fromB64(id), transports: ["internal"] }],
        userVerification: "required",
        timeout: 60_000,
      },
    })) as PublicKeyCredential | null;
    if (!cred) return "failed";
    const data = new Uint8Array((cred.response as AuthenticatorAssertionResponse).authenticatorData);
    // Bit UV (usuario verificado con cara/huella), byte de flags 32.
    return data.length > 32 && (data[32] & 0x04) !== 0 ? "ok" : "failed";
  } catch (e) {
    const name = (e as { name?: string })?.name;
    if (name === "NotAllowedError" || name === "AbortError") return "cancelled";
    if (name === "InvalidStateError" || name === "NotFoundError") {
      // La llave ya no existe en el móvil (se borró): desactivamos.
      disableBiometric(profileId);
    }
    return "failed";
  }
}
