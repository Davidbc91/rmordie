import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentUserId } from "./pin-gate";

export type NotificationPreferences = {
  user_id: string;
  daily_enabled: boolean;
  daily_time: string;
  weekly_enabled: boolean;
  timezone: string;
};

export const DEFAULT_NOTIFICATION_PREFERENCES = {
  daily_enabled: false,
  daily_time: "08:00",
  weekly_enabled: false,
};

// La tabla es nueva y aún no está en los tipos generados de Supabase.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Madrid";
  } catch {
    return "Europe/Madrid";
  }
}

export function useNotificationPreferences() {
  const uid = getCurrentUserId();
  return useQuery({
    queryKey: ["notification_preferences", uid],
    enabled: !!uid,
    queryFn: async (): Promise<NotificationPreferences | null> => {
      const { data, error } = await sb
        .from("notification_preferences")
        .select("user_id, daily_enabled, daily_time, weekly_enabled, timezone")
        .eq("user_id", uid)
        .maybeSingle();
      if (error) throw error;
      return (data as NotificationPreferences | null) ?? null;
    },
  });
}

export function useSaveNotificationPreferences() {
  const qc = useQueryClient();
  const uid = getCurrentUserId();
  return useMutation({
    mutationFn: async (input: Pick<NotificationPreferences, "daily_enabled" | "daily_time" | "weekly_enabled">) => {
      if (!uid) throw new Error("No hay perfil activo");
      const { error } = await sb.from("notification_preferences").upsert(
        {
          user_id: uid,
          ...input,
          // La hora del aviso se interpreta en la zona horaria de este dispositivo.
          timezone: deviceTimeZone(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notification_preferences", uid] }),
  });
}
