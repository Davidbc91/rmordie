// Client-side soft PIN gate + per-device current profile.
const UNLOCK_KEY = "malitos_unlocked_v2";
const USER_KEY = "malitos_current_user_v1";

export async function sha256(s: string): Promise<string> {
  const buf = new TextEncoder().encode(s);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function isUnlocked(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(UNLOCK_KEY) === "1" && !!getCurrentUserId();
}
export function setUnlocked(v: boolean) {
  if (typeof window === "undefined") return;
  if (v) localStorage.setItem(UNLOCK_KEY, "1");
  else localStorage.removeItem(UNLOCK_KEY);
}

export function getCurrentUserId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(USER_KEY);
}
export function setCurrentUserId(id: string | null) {
  if (typeof window === "undefined") return;
  if (id) localStorage.setItem(USER_KEY, id);
  else localStorage.removeItem(USER_KEY);
}

export function signOut() {
  setUnlocked(false);
  setCurrentUserId(null);
}
