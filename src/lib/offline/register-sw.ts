/**
 * Guarded service worker registration.
 * The generated worker (/sw.js) caches the app shell for offline use AND imports
 * the push handlers (public/push-sw.js), so there is a single registration at "/".
 * Never registers in dev, Lovable preview, or inside an iframe.
 */
export const APP_SW_URL = "/sw.js";

export function swAllowed(): boolean {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return false;
  if (!import.meta.env.PROD) return false;
  if (window.self !== window.top) return false;
  const host = window.location.hostname;
  if (host.startsWith("id-preview--") || host.startsWith("preview--")) return false;
  if (host === "lovableproject.com" || host.endsWith(".lovableproject.com")) return false;
  if (host === "lovableproject-dev.com" || host.endsWith(".lovableproject-dev.com")) return false;
  if (host === "beta.lovable.dev" || host.endsWith(".beta.lovable.dev")) return false;
  if (new URL(window.location.href).searchParams.get("sw") === "off") return false;
  return true;
}

async function unregisterAppSw() {
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.allSettled(
      regs
        .filter((r) => (r.active ?? r.installing ?? r.waiting)?.scriptURL.endsWith(APP_SW_URL))
        .map((r) => r.unregister()),
    );
  } catch {
    /* ignore */
  }
}

export async function registerAppSw(): Promise<void> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  if (!swAllowed()) {
    await unregisterAppSw();
    return;
  }
  try {
    await navigator.serviceWorker.register(APP_SW_URL, { scope: "/" });
  } catch {
    /* offline support simply stays off */
  }
}
