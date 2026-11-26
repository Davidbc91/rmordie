import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentUserId } from "./pin-gate";
import type { Planning } from "./excel-parser";

const sb = supabase as any;

export type CoachAthlete = {
  athlete_id: string;
  name: string;
  allowed: boolean;
  decided: boolean;
  plan_keys: string[];
  trained_days: string[] | null;
  avg_rpe: number | null;
  prs: number | null;
  last_trained: string | null;
};
export type CoachResult = {
  month_key: string; week: number; day_key: string; block_key: string; status: string;
  weight: number | null; sets: number | null; reps: number | null; time_seconds: number | null; rpe: number | null;
  notes: string | null; trained_on: string; updated_at: string;
};
export type CoachPr = { exercise: string; rep_max: number | null; previous_weight: number | null; new_weight: number; changed_at: string };
export type WorkoutComment = { id: string; coach_id: string; athlete_id: string; month_key: string; week: number; day_key: string; body: string; created_at: string; read_at: string | null };

export function useCoachAthletes(from: string, to: string, enabled = true) {
  const uid = getCurrentUserId();
  return useQuery({
    queryKey: ["coach-athletes", uid, from, to],
    enabled: !!uid && enabled,
    retry: false,
    staleTime: 60_000,
    queryFn: async (): Promise<CoachAthlete[]> => {
      const { data, error } = await sb.rpc("coach_athletes", { p_from: from, p_to: to });
      if (error) throw error;
      return (data ?? []).map((r: any) => ({ ...r, avg_rpe: r.avg_rpe != null ? Number(r.avg_rpe) : null, plan_keys: r.plan_keys ?? [] }));
    },
  });
}

export function useCoachAthleteResults(athlete: string | null, from: string, to: string) {
  return useQuery({
    queryKey: ["coach-athlete-results", athlete, from, to],
    enabled: !!athlete,
    retry: false,
    queryFn: async (): Promise<CoachResult[]> => {
      const { data, error } = await sb.rpc("coach_athlete_results", { p_athlete: athlete, p_from: from, p_to: to });
      if (error) throw error;
      return (data ?? []).map((r: any) => ({ ...r, weight: r.weight != null ? Number(r.weight) : null, rpe: r.rpe != null ? Number(r.rpe) : null }));
    },
  });
}

export function useCoachAthletePrs(athlete: string | null) {
  return useQuery({
    queryKey: ["coach-athlete-prs", athlete],
    enabled: !!athlete,
    retry: false,
    queryFn: async (): Promise<CoachPr[]> => {
      const { data, error } = await sb.rpc("coach_athlete_prs", { p_athlete: athlete, p_limit: 8 });
      if (error) throw error;
      return (data ?? []).map((r: any) => ({ ...r, new_weight: Number(r.new_weight) }));
    },
  });
}

/** Última versión de cada planificación mía, por plan_key (para saber qué días tocaban). */
export function useMyPlanData(planKeys: string[]) {
  const uid = getCurrentUserId();
  const keys = [...new Set(planKeys)].sort();
  return useQuery({
    queryKey: ["coach-plan-data", uid, keys.join(",")],
    enabled: !!uid && keys.length > 0,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Record<string, Planning>> => {
      const { data, error } = await sb
        .from("planning")
        .select("plan_key, data, imported_at")
        .eq("user_id", uid)
        .in("plan_key", keys)
        .order("imported_at", { ascending: false });
      if (error) throw error;
      const out: Record<string, Planning> = {};
      for (const r of data ?? []) if (!out[r.plan_key]) out[r.plan_key] = r.data;
      return out;
    },
  });
}

/* ---------- Comentarios ---------- */

export function useCommentsForAthlete(athlete: string | null) {
  const uid = getCurrentUserId();
  return useQuery({
    queryKey: ["workout-comments", "coach", uid, athlete],
    enabled: !!uid && !!athlete,
    retry: false,
    queryFn: async (): Promise<WorkoutComment[]> => {
      const { data, error } = await sb.from("workout_comments").select("*").eq("coach_id", uid).eq("athlete_id", athlete).order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Comentarios que me han dejado (como atleta). */
export function useMyComments() {
  const uid = getCurrentUserId();
  return useQuery({
    queryKey: ["workout-comments", "me", uid],
    enabled: !!uid,
    retry: false,
    staleTime: 60_000,
    queryFn: async (): Promise<WorkoutComment[]> => {
      const { data, error } = await sb.from("workout_comments").select("*").eq("athlete_id", uid).order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useSendComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (c: { athlete_id: string; month_key: string; week: number; day_key: string; body: string }) => {
      const me = getCurrentUserId();
      const { error } = await sb.from("workout_comments").insert({ ...c, coach_id: me, body: c.body.trim().slice(0, 500) });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workout-comments"] }),
  });
}

export function useDeleteComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("workout_comments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workout-comments"] }),
  });
}

export function useMarkCommentsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      if (!ids.length) return;
      const { error } = await sb.from("workout_comments").update({ read_at: new Date().toISOString() }).in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workout-comments", "me"] }),
  });
}

/* ---------- Permiso del atleta ---------- */

export type CoachRequest = { coach_id: string; coach_name: string; allowed: boolean | null };

/** Entrenadores que me comparten planificación y qué he decidido con cada uno. */
export function useMyCoaches() {
  const uid = getCurrentUserId();
  return useQuery({
    queryKey: ["my-coaches", uid],
    enabled: !!uid,
    retry: false,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<CoachRequest[]> => {
      const [{ data: shares, error: e1 }, { data: access, error: e2 }] = await Promise.all([
        sb.from("planning_shares").select("owner_id").eq("recipient_id", uid),
        sb.from("coach_access").select("coach_id, allowed").eq("athlete_id", uid),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      const owners = [...new Set((shares ?? []).map((s: any) => s.owner_id as string))].filter((o) => o !== uid);
      if (!owners.length) return [];
      const { data: profs } = await sb.from("profiles").select("id, name").in("id", owners);
      const name = new Map((profs ?? []).map((p: any) => [p.id, p.name]));
      const dec = new Map((access ?? []).map((a: any) => [a.coach_id, a.allowed as boolean]));
      return owners.map((o) => ({ coach_id: o, coach_name: (name.get(o) as string) ?? "Tu entrenador", allowed: dec.has(o) ? (dec.get(o) as boolean) : null }));
    },
  });
}

export function useSetCoachAccess() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ coach_id, allowed }: { coach_id: string; allowed: boolean }) => {
      const me = getCurrentUserId();
      const { error } = await sb.from("coach_access").upsert({ coach_id, athlete_id: me, allowed, decided_at: new Date().toISOString() }, { onConflict: "coach_id,athlete_id" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-coaches"] }),
  });
}
