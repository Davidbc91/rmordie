import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentUserId } from "./pin-gate";
import { offlineRead } from "./offline/cache";

const sb = supabase as any;

// -------- Athlete profile --------
export type AthleteProfile = {
  id: string;
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  birth_date: string | null;
  sex: string | null;
  height_cm: number | null;
  current_weight_kg: number | null;
  target_weight_kg: number | null;
  crossfit_start_date: string | null;
  box_name: string | null;
  level: string | null;
  weekly_target: number | null;
  goals: string[];
  updated_at: string;
};

export function useAthleteProfile() {
  const uid = getCurrentUserId();
  return useQuery({
    queryKey: ["athlete_profile", uid],
    enabled: !!uid,
    queryFn: async (): Promise<AthleteProfile | null> =>
      offlineRead(`athlete_profile:${uid}`, async () => {
        const { data, error } = await sb
          .from("athlete_profile")
          .select("*")
          .eq("user_id", uid!)
          .maybeSingle();
        if (error) throw error;
        return (data as AthleteProfile) ?? null;
      }),
  });
}

export function useSaveAthleteProfile() {
  const qc = useQueryClient();
  const uid = getCurrentUserId();
  return useMutation({
    mutationFn: async (p: Partial<AthleteProfile>) => {
      if (!uid) throw new Error("No hay perfil activo");
      const { error } = await sb
        .from("athlete_profile")
        .upsert({ ...p, user_id: uid, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["athlete_profile", uid] }),
  });
}

// -------- Body metrics --------
export type BodyMetric = {
  id: string;
  user_id: string;
  measured_on: string;
  weight_kg: number | null;
  body_fat_pct: number | null;
  muscle_mass_kg: number | null;
  waist_cm: number | null;
  chest_cm: number | null;
  hip_cm: number | null;
  arm_cm: number | null;
  thigh_cm: number | null;
  notes: string | null;
  created_at: string;
};

export function useBodyMetrics() {
  const uid = getCurrentUserId();
  return useQuery({
    queryKey: ["body_metrics", uid],
    enabled: !!uid,
    queryFn: async (): Promise<BodyMetric[]> =>
      offlineRead(`body_metrics:${uid}`, async () => {
        const { data, error } = await sb
          .from("body_metrics")
          .select("*")
          .eq("user_id", uid!)
          .order("measured_on", { ascending: true });
        if (error) throw error;
        return (data ?? []) as BodyMetric[];
      }),
  });
}

export function useAddBodyMetric() {
  const qc = useQueryClient();
  const uid = getCurrentUserId();
  return useMutation({
    mutationFn: async (m: Partial<BodyMetric>) => {
      if (!uid) throw new Error("No hay perfil activo");
      const { error } = await sb.from("body_metrics").insert({ ...m, user_id: uid });
      if (error) throw error;
      if (m.weight_kg != null) {
        await sb
          .from("athlete_profile")
          .upsert(
            { user_id: uid, current_weight_kg: m.weight_kg, updated_at: new Date().toISOString() },
            { onConflict: "user_id" },
          );
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["body_metrics", uid] });
      qc.invalidateQueries({ queryKey: ["athlete_profile", uid] });
    },
  });
}

export function useDeleteBodyMetric() {
  const qc = useQueryClient();
  const uid = getCurrentUserId();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("body_metrics").delete().eq("id", id).eq("user_id", uid!);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["body_metrics", uid] }),
  });
}

// -------- Wellness / recovery --------
export type WellnessLog = {
  id: string;
  user_id: string;
  logged_on: string;
  sleep_hours: number | null;
  energy: number | null;
  fatigue: number | null;
  soreness: number | null;
  mood: number | null;
  notes: string | null;
};

export function useWellnessLogs() {
  const uid = getCurrentUserId();
  return useQuery({
    queryKey: ["wellness_logs", uid],
    enabled: !!uid,
    queryFn: async (): Promise<WellnessLog[]> =>
      offlineRead(`wellness_logs:${uid}`, async () => {
        const { data, error } = await sb
          .from("wellness_logs")
          .select("*")
          .eq("user_id", uid!)
          .order("logged_on", { ascending: true });
        if (error) throw error;
        return (data ?? []) as WellnessLog[];
      }),
  });
}

export function useSaveWellness() {
  const qc = useQueryClient();
  const uid = getCurrentUserId();
  return useMutation({
    mutationFn: async (w: Partial<WellnessLog>) => {
      if (!uid) throw new Error("No hay perfil activo");
      const { error } = await sb
        .from("wellness_logs")
        .upsert({ ...w, user_id: uid }, { onConflict: "user_id,logged_on" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wellness_logs", uid] }),
  });
}

export function useDeleteWellness() {
  const qc = useQueryClient();
  const uid = getCurrentUserId();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("wellness_logs").delete().eq("id", id).eq("user_id", uid!);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wellness_logs", uid] }),
  });
}

// -------- Goals --------
export type AthleteGoal = {
  id: string;
  user_id: string;
  title: string;
  goal_type: string;
  exercise: string | null;
  start_value: number | null;
  current_value: number | null;
  target_value: number;
  unit: string | null;
  target_date: string | null;
  status: string;
  created_at: string;
};

export function useGoals() {
  const uid = getCurrentUserId();
  return useQuery({
    queryKey: ["athlete_goals", uid],
    enabled: !!uid,
    queryFn: async (): Promise<AthleteGoal[]> =>
      offlineRead(`athlete_goals:${uid}`, async () => {
        const { data, error } = await sb
          .from("athlete_goals")
          .select("*")
          .eq("user_id", uid!)
          .order("created_at", { ascending: false });
        if (error) throw error;
        return (data ?? []) as AthleteGoal[];
      }),
  });
}

export function useSaveGoal() {
  const qc = useQueryClient();
  const uid = getCurrentUserId();
  return useMutation({
    mutationFn: async (g: Partial<AthleteGoal> & { target_value: number; title: string }) => {
      if (!uid) throw new Error("No hay perfil activo");
      if (g.id) {
        const { error } = await sb.from("athlete_goals").update({ ...g, user_id: uid }).eq("id", g.id).eq("user_id", uid);
        if (error) throw error;
      } else {
        const { error } = await sb.from("athlete_goals").insert({ ...g, user_id: uid });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["athlete_goals", uid] }),
  });
}

export function useDeleteGoal() {
  const qc = useQueryClient();
  const uid = getCurrentUserId();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("athlete_goals").delete().eq("id", id).eq("user_id", uid!);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["athlete_goals", uid] }),
  });
}

// -------- Milestones --------
export type Milestone = {
  id: string;
  user_id: string;
  code: string;
  label: string;
  detail: string | null;
  achieved_at: string;
};

export function useMilestones() {
  const uid = getCurrentUserId();
  return useQuery({
    queryKey: ["milestones", uid],
    enabled: !!uid,
    queryFn: async (): Promise<Milestone[]> =>
      offlineRead(`milestones:${uid}`, async () => {
        const { data, error } = await sb
          .from("milestones")
          .select("*")
          .eq("user_id", uid!)
          .order("achieved_at", { ascending: false });
        if (error) throw error;
        return (data ?? []) as Milestone[];
      }),
  });
}

export function useSyncMilestones() {
  const qc = useQueryClient();
  const uid = getCurrentUserId();
  return useMutation({
    mutationFn: async (rows: { code: string; label: string; detail?: string | null }[]) => {
      if (!uid || rows.length === 0) return;
      const { error } = await sb
        .from("milestones")
        .upsert(rows.map((r) => ({ ...r, user_id: uid })), { onConflict: "user_id,code", ignoreDuplicates: true });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["milestones", uid] }),
  });
}

// -------- All PR history (for analytics) --------
export type PrHistoryRow = {
  id: string;
  user_id: string;
  exercise: string;
  rep_max: number;
  previous_weight: number | null;
  new_weight: number;
  changed_at: string;
};

export function useAllPrHistory() {
  const uid = getCurrentUserId();
  return useQuery({
    queryKey: ["personal_record_history", uid, "all"],
    enabled: !!uid,
    queryFn: async (): Promise<PrHistoryRow[]> =>
      offlineRead(`pr_history_all:${uid}`, async () => {
        const { data, error } = await sb
          .from("personal_record_history")
          .select("*")
          .eq("user_id", uid!)
          .order("changed_at", { ascending: true });
        if (error) throw error;
        return (data ?? []) as PrHistoryRow[];
      }),
  });
}

// -------- Privacy: export / wipe --------
export async function exportAllData() {
  const uid = getCurrentUserId();
  if (!uid) throw new Error("No hay perfil activo");
  const tables = [
    "athlete_profile",
    "body_metrics",
    "wellness_logs",
    "athlete_goals",
    "milestones",
    "personal_records",
    "personal_record_history",
    "workout_results",
    "exercise_log",
    "app_settings",
  ];
  const out: Record<string, unknown> = { exported_at: new Date().toISOString(), user_id: uid };
  for (const t of tables) {
    const col = t === "athlete_profile" ? "user_id" : "user_id";
    const { data } = await sb.from(t).select("*").eq(col, uid);
    out[t] = data ?? [];
  }
  return out;
}

export async function wipeAllHistory() {
  const uid = getCurrentUserId();
  if (!uid) throw new Error("No hay perfil activo");
  const tables = [
    "body_metrics",
    "wellness_logs",
    "athlete_goals",
    "milestones",
    "personal_record_history",
    "personal_records",
    "workout_results",
    "exercise_log",
  ];
  for (const t of tables) {
    await sb.from(t).delete().eq("user_id", uid);
  }
}
