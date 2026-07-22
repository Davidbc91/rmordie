import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Planning, Month, Day } from "./excel-parser";

// -------- Planning --------
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
      // Deactivate previous
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

// -------- Results --------
export type WorkoutResult = {
  id: string;
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
  return useQuery({
    queryKey: ["results", monthKey, week, dayKey],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workout_results")
        .select("*")
        .eq("month_key", monthKey)
        .eq("week", week)
        .eq("day_key", dayKey);
      if (error) throw error;
      return (data ?? []) as unknown as WorkoutResult[];
    },
  });
}

export function useAllResults() {
  return useQuery({
    queryKey: ["results", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workout_results")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as WorkoutResult[];
    },
  });
}

export function useSaveResult() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (r: Partial<WorkoutResult> & {
      month_key: string; week: number; day_key: string; block_key: string;
    }) => {
      const { error } = await supabase.from("workout_results").upsert(
        { ...r, updated_at: new Date().toISOString() } as never,
        { onConflict: "month_key,week,day_key,block_key" }
      );
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["results", vars.month_key, vars.week, vars.day_key] });
      qc.invalidateQueries({ queryKey: ["results", "all"] });
    },
  });
}

// -------- Settings --------
export type AppSettings = {
  id: number;
  pin_hash: string | null;
  bar_weights: number[];
  plate_weights: number[];
};

export function useSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: async (): Promise<AppSettings> => {
      const { data, error } = await supabase.from("app_settings").select("*").eq("id", 1).maybeSingle();
      if (error) throw error;
      return (data as unknown as AppSettings) ?? {
        id: 1, pin_hash: null, bar_weights: [10, 15, 20], plate_weights: [20, 15, 10, 5, 2.5, 1.25],
      };
    },
  });
}

export function useSaveSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (s: Partial<AppSettings>) => {
      const { error } = await supabase.from("app_settings").upsert(
        { id: 1, ...s, updated_at: new Date().toISOString() } as never,
        { onConflict: "id" }
      );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["settings"] }),
  });
}

// -------- Helpers --------
export function findDay(p: Planning, monthKey: string, week: number, dayKey: string): { month?: Month; day?: Day } {
  const month = p.months.find((m) => m.key === monthKey);
  const w = month?.weeks.find((x) => x.index === week);
  const day = w?.days.find((d) => d.key === dayKey);
  return { month, day };
}
