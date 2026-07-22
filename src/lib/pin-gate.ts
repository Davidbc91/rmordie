// Client-side soft PIN gate. Not real security — matches the "PIN sencillo" scope.
const KEY = "malitos_unlocked_v1";

export async function sha256(s: string): Promise<string> {
  const buf = new TextEncoder().encode(s);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function isUnlocked(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(KEY) === "1";
}

export function setUnlocked(v: boolean) {
  if (typeof window === "undefined") return;
  if (v) localStorage.setItem(KEY, "1");
  else localStorage.removeItem(KEY);
}
