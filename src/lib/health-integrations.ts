import { supabase } from "@/lib/supabase";
import { getCurrentUserId } from "@/lib/pin-gate";
import { verifyProfilePin } from "@/lib/store";

async function hashPin(pin: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(pin));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

const FUNCTION = "huawei-health";

async function invoke(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke(FUNCTION, { body });
  if (error) throw new Error(error.message || "No se ha podido conectar con Huawei Health.");
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function startHuaweiHealthAuthorization(pin: string) {
  const profileId = getCurrentUserId();
  if (!profileId) throw new Error("No hay un perfil activo.");
  const valid = await verifyProfilePin(profileId, pin);
  if (!valid) throw new Error("PIN incorrecto.");
  const pinHash = await hashPin(pin);
  return invoke({ action: "authorize", profileId, pinHash });
}

export async function getHuaweiHealthStatus(pin: string) {
  const profileId = getCurrentUserId();
  if (!profileId) throw new Error("No hay un perfil activo.");
  const valid = await verifyProfilePin(profileId, pin);
  if (!valid) throw new Error("PIN incorrecto.");
  const pinHash = await hashPin(pin);
  return invoke({ action: "status", profileId, pinHash });
}
