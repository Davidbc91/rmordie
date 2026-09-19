/**
 * Notificaciones push (cliente).
 * Registra el service worker de avisos, pide permiso y guarda el dispositivo
 * en `push_subscriptions`. Preparado para cualquier tipo de aviso de RM OR DIE.
 */
import { supabase } from "@/integrations/supabase/client";

// Clave pública VAPID: es pública por diseño (el secreto es la privada, en servidor).
export const VAPID_PUBLIC_KEY =
  "BF2E0_zeT-VRUlU2PHAKvUGmlsMzTn5KK6eYkbstsKZuiY45_lvmUmxXqZiuo8Ah2IUlUgPYtQwBGIu1T1M4WY0";

// In production the offline worker (/sw.js) also imports the push handlers, so a
// single registration serves both. In dev/preview only the push worker exists.
const SW_URL = import.meta.env.PROD ? "/sw.js" : "/push-sw.js";

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/** iOS/iPadOS exige que la app esté añadida a la pantalla de inicio. */
export function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && "ontouchend" in document);
}

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function iosNeedsInstall(): boolean {
  return isIos() && !isStandalone();
}

export function permissionState(): NotificationPermission | "unsupported" {
  if (!pushSupported()) return "unsupported";
  return Notification.permission;
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

async function getRegistration(): Promise<ServiceWorkerRegistration> {
  const reg = await navigator.serviceWorker.register(SW_URL, { scope: "/" });
  await navigator.serviceWorker.ready;
  return reg;
}

export type EnableResult =
  | { ok: true }
  | { ok: false; reason: "unsupported" | "ios-install" | "denied" | "error"; message: string };

/** Pide permiso y registra este dispositivo para el perfil indicado. */
export async function enablePush(userId: string): Promise<EnableResult> {
  if (!pushSupported()) {
    if (iosNeedsInstall()) {
      return {
        ok: false,
        reason: "ios-install",
        message:
          "En iPhone añade primero RM OR DIE a la pantalla de inicio (Compartir → Añadir a inicio) y vuelve a intentarlo.",
      };
    }
    return {
      ok: false,
      reason: "unsupported",
      message: "Este navegador no admite notificaciones.",
    };
  }
  if (iosNeedsInstall()) {
    return {
      ok: false,
      reason: "ios-install",
      message:
        "En iPhone añade primero RM OR DIE a la pantalla de inicio (Compartir → Añadir a inicio) y vuelve a intentarlo.",
    };
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      return {
        ok: false,
        reason: "denied",
        message: "No has dado permiso para recibir notificaciones.",
      };
    }

    const reg = await getRegistration();
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }

    const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
      return { ok: false, reason: "error", message: "No pude registrar el dispositivo." };
    }

    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        user_id: userId,
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
        user_agent: navigator.userAgent.slice(0, 300),
      },
      { onConflict: "endpoint" },
    );
    if (error) return { ok: false, reason: "error", message: error.message };

    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      reason: "error",
      message: err instanceof Error ? err.message : "Error al activar notificaciones.",
    };
  }
}

/** Da de baja este dispositivo. */
export async function disablePush(): Promise<void> {
  if (!pushSupported()) return;
  const reg = await navigator.serviceWorker.getRegistration(SW_URL);
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
    await sub.unsubscribe();
  }
}

/** ¿Está este dispositivo registrado ahora mismo? */
export async function isPushActive(): Promise<boolean> {
  if (!pushSupported() || Notification.permission !== "granted") return false;
  const reg = await navigator.serviceWorker.getRegistration(SW_URL);
  const sub = await reg?.pushManager.getSubscription();
  return Boolean(sub);
}
