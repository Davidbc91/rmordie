import { supabase } from "@/integrations/supabase/client";
import { getCurrentUserId, sha256 } from "@/lib/pin-gate";

export const MOVEMENT_VIDEO_BUCKET = "movement-videos";

export type MovementVideo = {
  id: string;
  movement_id: string;
  source_type: "youtube" | "upload";
  youtube_url: string | null;
  storage_path: string | null;
  title: string;
  created_at: string;
  updated_at: string;
};

type AdminResponse = Record<string, unknown> & { error?: string };

async function invoke(body: Record<string, unknown>): Promise<AdminResponse> {
  const { data, error } = await supabase.functions.invoke("admin-video", { body });
  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
  return (data ?? {}) as AdminResponse;
}

export async function isVideoAdmin(): Promise<boolean> {
  const profileId = getCurrentUserId();
  if (!profileId) return false;
  const data = await invoke({ action: "check", profile_id: profileId });
  return data.isAdmin === true;
}

export async function verifyVideoAdminPin(pin: string): Promise<string> {
  const profileId = getCurrentUserId();
  if (!profileId) throw new Error("No hay perfil activo");
  const pinHash = await sha256(pin);
  await invoke({ action: "verify", profile_id: profileId, pin_hash: pinHash });
  return pinHash;
}

export async function createMovementVideoUpload(
  pinHash: string,
  movementId: string,
  extension: string,
) {
  const profileId = getCurrentUserId();
  if (!profileId) throw new Error("No hay perfil activo");
  return invoke({
    action: "create_upload",
    profile_id: profileId,
    pin_hash: pinHash,
    movement_id: movementId,
    extension,
  }) as Promise<{ path: string; token: string }>;
}

export async function saveMovementUpload(
  pinHash: string,
  movementId: string,
  title: string,
  storagePath: string,
) {
  const profileId = getCurrentUserId();
  if (!profileId) throw new Error("No hay perfil activo");
  return invoke({
    action: "save_upload",
    profile_id: profileId,
    pin_hash: pinHash,
    movement_id: movementId,
    title,
    storage_path: storagePath,
  });
}

export async function saveMovementYoutube(
  pinHash: string,
  movementId: string,
  title: string,
  youtubeUrl: string,
) {
  const profileId = getCurrentUserId();
  if (!profileId) throw new Error("No hay perfil activo");
  return invoke({
    action: "save_youtube",
    profile_id: profileId,
    pin_hash: pinHash,
    movement_id: movementId,
    title,
    youtube_url: youtubeUrl,
  });
}

export async function deleteMovementVideo(pinHash: string, movementId: string) {
  const profileId = getCurrentUserId();
  if (!profileId) throw new Error("No hay perfil activo");
  return invoke({
    action: "delete",
    profile_id: profileId,
    pin_hash: pinHash,
    movement_id: movementId,
  });
}
