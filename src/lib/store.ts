import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentUserId, sha256 } from "./pin-gate";
import type { Planning, Month, Day } from "./excel-parser";

// -------- Profiles --------
export type Profile = {
  id: string;
  name: string;
  pin_hash: string;
  created_at: string;
};

export function useProfiles() {
  return useQuery({
    queryKey: ["profiles"],
    queryFn: async (): Promise<Profile[]> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as Profile[];
    },
  });
}

export function useCreateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ name, pin }: { name: string; pin: string }) => {
      const pin_hash = await sha256(pin);
      const { data, error } = await supabase
        .from("profiles")
        .insert({ name: name.trim(), pin_hash })
        .select()
        .single();
      if (error) throw error;
      return data as unknown as Profile;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profiles"] }),
  });
}

export function useUpdateProfilePin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, pin }: { id: string; pin: string }) => {
      const pin_hash = await sha256(pin);
      const { error } = await supabase.from("profiles").update({ pin_hash }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profiles"] }),
  });
}

export function useDeleteProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("workout_results").delete().eq("user_id", id);
      await supabase.from("exercise_log").delete().eq("user_id", id);
      await supabase.from("app_settings").delete().eq("user_id", id);
      const { error } = await supabase.from("profiles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profiles"] });
    },
  });
}

// -------- Planning (shared) --------
export type PlanningRow = {
  id: string;
  version: number;
  source_filename: string | null;
  data: Planning;
  is_active: boolean;
  imported_at: string;
};

export function usePlanning() {
  return useQuery({
    queryKey: ["planning"],
    queryFn: async (): Promise<PlanningRow | null> => {
      const { data, error } = await supabase
        .from("planning")
        .select("*")
        .eq("is_active", true)
        .order("imported_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as PlanningRow) ?? null;
    },
  });
}

export function useSavePlanning() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { planning: Planning; filename?: string }) => {
      await supabase.from("planning").update({ is_active: false }).eq("is_active", true);
      const { data: latest } = await supabase
        .from("planning").select("version").order("version", { ascending: false }).limit(1).maybeSingle();
      const nextVersion = ((latest?.version as number | undefined) ?? 0) + 1;
      const { error } = await supabase.from("planning").insert({
        version: nextVersion,
        source_filename: input.filename ?? null,
        data: input.planning as unknown as never,
        is_active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["planning"] }),
  });
}

// -------- Results (per-user) --------
export type WorkoutResult = {
  id: string;
  user_id: string | null;
  month_key: string;
  week: number;
  day_key: string;
  block_key: string;
  status: "completed" | "not_done" | "modified";
  weight: number | null;
  sets: number | null;
  reps: number | null;
  time_seconds: number | null;
  rpe: number | null;
  scale: string | null;
  notes: string | null;
  updated_at: string;
};

export function useDayResults(monthKey: string, week: number, dayKey: string) {
  const uid = getCurrentUserId();
  return useQuery({
    queryKey: ["results", uid, monthKey, week, dayKey],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workout_results")
        .select("*")
        .eq("user_id", uid!)
        .eq("month_key", monthKey)
        .eq("week", week)
        .eq("day_key", dayKey);
      if (error) throw error;
      return (data ?? []) as unknown as WorkoutResult[];
    },
  });
}

export function useAllResults() {
  const uid = getCurrentUserId();
  return useQuery({
    queryKey: ["results", uid, "all"],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workout_results")
        .select("*")
        .eq("user_id", uid!)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as WorkoutResult[];
    },
  });
}

export function useSaveResult() {
  const qc = useQueryClient();
  const uid = getCurrentUserId();
  return useMutation({
    mutationFn: async (r: Partial<WorkoutResult> & {
      month_key: string; week: number; day_key: string; block_key: string;
    }) => {
      if (!uid) throw new Error("No hay perfil activo");
      const { error } = await supabase.from("workout_results").upsert(
        { ...r, user_id: uid, updated_at: new Date().toISOString() } as never,
        { onConflict: "user_id,month_key,week,day_key,block_key" }
      );
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["results", uid, vars.month_key, vars.week, vars.day_key] });
      qc.invalidateQueries({ queryKey: ["results", uid, "all"] });
    },
  });
}

// -------- Settings (per-user) --------
export type AppSettings = {
  id: string;
  user_id: string;
  bar_weights: number[];
  plate_weights: number[];
};

const DEFAULT_SETTINGS = {
  bar_weights: [10, 15, 20],
  plate_weights: [20, 15, 10, 5, 2.5, 1.25],
};

export function useSettings() {
  const uid = getCurrentUserId();
  return useQuery({
    queryKey: ["settings", uid],
    enabled: !!uid,
    queryFn: async (): Promise<AppSettings> => {
      const { data, error } = await supabase
        .from("app_settings").select("*").eq("user_id", uid!).maybeSingle();
      if (error) throw error;
      if (data) return data as unknown as AppSettings;
      return { id: "", user_id: uid!, ...DEFAULT_SETTINGS };
    },
  });
}

export function useSaveSettings() {
  const qc = useQueryClient();
  const uid = getCurrentUserId();
  return useMutation({
    mutationFn: async (s: { bar_weights?: number[]; plate_weights?: number[] }) => {
      if (!uid) throw new Error("No hay perfil activo");
      const { error } = await supabase.from("app_settings").upsert(
        { user_id: uid, ...s, updated_at: new Date().toISOString() } as never,
        { onConflict: "user_id" }
      );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["settings", uid] }),
  });
}

// -------- Helpers --------
export function findDay(p: Planning, monthKey: string, week: number, dayKey: string): { month?: Month; day?: Day } {
  const month = p.months.find((m) => m.key === monthKey);
  const w = month?.weeks.find((x) => x.index === week);
  const day = w?.days.find((d) => d.key === dayKey);
  return { month, day };
}
