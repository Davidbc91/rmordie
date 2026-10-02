import { supabase } from "@/lib/supabase";
import { getCurrentUserId } from "@/lib/pin-gate";
import { hashPin, verifyProfilePin } from "@/lib/store";

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
