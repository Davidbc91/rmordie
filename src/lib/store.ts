import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentUserId, sha256 } from "./pin-gate";
import type { Planning, Month, Day } from "./excel-parser";
import { cacheGet, cacheSet, isOnline, offlineRead } from "./offline/cache";
import { enqueueOp } from "./offline/queue";
import { processQueue } from "./offline/sync";

// -------- Profiles --------
export type Profile = {
  id: string;
  name: string;
  created_at: string;
};

export function useProfiles() {
  return useQuery({
    queryKey: ["profiles"],
    queryFn: (): Promise<Profile[]> =>
      offlineRead("profiles", async () => {
        const { data, error } = await supabase
          .from("profiles")
          .select("id,name,created_at")
          .order("created_at", { ascending: true });
        if (error) throw error;
        return (data ?? []) as unknown as Profile[];
      }),
  });
}

/** PIN check happens inside the database; the hash is never sent to the client. */
export async function verifyProfilePin(profileId: string, pin: string): Promise<boolean> {
  const pin_hash = await sha256(pin);
  const { data, error } = await supabase.rpc("verify_profile_pin", {
    _profile_id: profileId,
    _pin_hash: pin_hash,
  });
  if (error) throw error;
  return data === true;
}

export function useCreateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ name, pin }: { name: string; pin: string }) => {
      const pin_hash = await sha256(pin);
      const { data, error } = await supabase
        .from("profiles")
        .insert({ name: name.trim(), pin_hash })
        .select("id,name,created_at")
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

// -------- Planning (shared rows are read-only; new imports belong to the athlete) --------
export type PlanningRow = {
  id: string;
  user_id: string | null;
  version: number;
  source_filename: string | null;
  data: Planning;
  is_active: boolean;
  imported_at: string;
};

export function usePlanning() {
  const uid = getCurrentUserId();
  return useQuery({
    queryKey: ["planning", uid],
    queryFn: async (): Promise<PlanningRow | null> =>
      offlineRead(cacheKeys.planning(uid), async () => {
        const { data, error } = await supabase
          .from("planning")
          .select("*")
          .eq("is_active", true)
          .order("imported_at", { ascending: false });
        if (error) throw error;
        const rows = (data ?? []) as unknown as PlanningRow[];
        // prefer the athlete's own active planning, fall back to the shared one
        return rows.find((r) => uid && r.user_id === uid) ?? rows.find((r) => r.user_id === null) ?? rows[0] ?? null;
      }),
  });
}

export function useSavePlanning() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { planning: Planning; filename?: string }) => {
      const uid = getCurrentUserId();
      if (!uid) throw new Error("No hay perfil activo");
      // only the athlete's own planning rows can be deactivated; shared ones are read-only
      await supabase.from("planning").update({ is_active: false }).eq("user_id", uid).eq("is_active", true);
      const { data: latest } = await supabase
        .from("planning")
        .select("version")
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();
      const nextVersion = ((latest?.version as number | undefined) ?? 0) + 1;
      const { error } = await supabase.from("planning").insert({
        user_id: uid,
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
    queryFn: async () =>
      offlineRead(cacheKeys.resultsDay(uid!, monthKey, week, dayKey), async () => {
        const { data, error } = await supabase
          .from("workout_results")
          .select("*")
          .eq("user_id", uid!)
          .eq("month_key", monthKey)
          .eq("week", week)
          .eq("day_key", dayKey);
        if (error) throw error;
        return (data ?? []) as unknown as WorkoutResult[];
      }),
  });
}

export function useAllResults() {
  const uid = getCurrentUserId();
  return useQuery({
    queryKey: ["results", uid, "all"],
    enabled: !!uid,
    queryFn: async () =>
      offlineRead(cacheKeys.resultsAll(uid!), async () => {
        const { data, error } = await supabase
          .from("workout_results")
          .select("*")
          .eq("user_id", uid!)
          .order("updated_at", { ascending: false });
        if (error) throw error;
        return (data ?? []) as unknown as WorkoutResult[];
      }),
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
      if (!isOnline()) {
        await queueResultLocally(uid, r);
        return;
      }
      try {
        const { error } = await supabase.from("workout_results").upsert(
          { ...r, user_id: uid, updated_at: new Date().toISOString() } as never,
          { onConflict: "user_id,month_key,week,day_key,block_key" }
        );
        if (error) throw error;
      } catch (error) {
        if (!isNetworkError(error)) throw error;
        await queueResultLocally(uid, r);
        void processQueue();
      }
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
    queryFn: async (): Promise<AppSettings> =>
      offlineRead(cacheKeys.settings(uid!), async () => {
        const { data, error } = await supabase
          .from("app_settings").select("*").eq("user_id", uid!).maybeSingle();
        if (error) throw error;
        if (data) return data as unknown as AppSettings;
        return { id: "", user_id: uid!, ...DEFAULT_SETTINGS };
      }),
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

// -------- Personal Records (per exercise + rep max, per-user) --------
export type PersonalRecord = {
  id: string;
  user_id: string;
  exercise: string;
  weight: number;
  rep_max: number;
  notes: string | null;
  updated_at: string;
  created_at: string;
};

export function usePersonalRecords() {
  const uid = getCurrentUserId();
  return useQuery({
    queryKey: ["personal_records", uid],
    enabled: !!uid,
    queryFn: async (): Promise<PersonalRecord[]> =>
      offlineRead(cacheKeys.records(uid!), async () => {
        const { data, error } = await (supabase as any)
          .from("personal_records")
          .select("*")
          .eq("user_id", uid!)
          .order("exercise", { ascending: true });
        if (error) throw error;
        return (data ?? []) as PersonalRecord[];
      }),
  });
}

export function useUpsertPersonalRecord() {
  const qc = useQueryClient();
  const uid = getCurrentUserId();
  return useMutation({
    mutationFn: async (r: {
      exercise: string;
      weight: number;
      rep_max?: number;
      notes?: string | null;
    }) => {
      if (!uid) throw new Error("No hay perfil activo");
      const row = {
        exercise: r.exercise.trim(),
        weight: r.weight,
        rep_max: r.rep_max ?? 1,
        notes: r.notes ?? null,
      };
      if (!isOnline()) {
        await queueRecordLocally(uid, row);
        return;
      }
      try {
        const { error } = await (supabase as any).from("personal_records").upsert(
          { user_id: uid, ...row, updated_at: new Date().toISOString() },
          { onConflict: "user_id,exercise,rep_max" }
        );
        if (error) throw error;
      } catch (error) {
        if (!isNetworkError(error)) throw error;
        await queueRecordLocally(uid, row);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["personal_records", uid] });
      qc.invalidateQueries({ queryKey: ["personal_record_history", uid] });
    },
  });
}

export function useUpdatePersonalRecord() {
  const qc = useQueryClient();
  const uid = getCurrentUserId();
  return useMutation({
    mutationFn: async (r: { id: string; exercise: string; weight: number; notes?: string | null }) => {
      const { error } = await (supabase as any)
        .from("personal_records")
        .update({
          exercise: r.exercise.trim(),
          weight: r.weight,
          notes: r.notes ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", r.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["personal_records", uid] });
      qc.invalidateQueries({ queryKey: ["personal_record_history", uid] });
    },
  });
}

export function useDeletePersonalRecord() {
  const qc = useQueryClient();
  const uid = getCurrentUserId();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("personal_records").delete().eq("id", id).eq("user_id", uid!);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["personal_records", uid] }),
  });
}

// -------- Personal Record History --------
export type PersonalRecordHistory = {
  id: string;
  user_id: string;
  exercise: string;
  rep_max: number;
  previous_weight: number | null;
  new_weight: number;
  changed_at: string;
};

export function usePersonalRecordHistory(exercise: string | null, repMax?: number) {
  const uid = getCurrentUserId();
  return useQuery({
    queryKey: ["personal_record_history", uid, exercise, repMax ?? null],
    enabled: !!uid && !!exercise,
    queryFn: async (): Promise<PersonalRecordHistory[]> =>
      offlineRead(cacheKeys.recordHistory(uid!, exercise!, repMax ?? null), async () => {
        let q = (supabase as any)
          .from("personal_record_history")
          .select("*")
          .eq("user_id", uid!)
          .eq("exercise", exercise!);
        if (repMax != null) q = q.eq("rep_max", repMax);
        const { data, error } = await q.order("changed_at", { ascending: false });
        if (error) throw error;
        return (data ?? []) as PersonalRecordHistory[];
      }),
  });
}




// -------- Helpers --------
export function findDay(p: Planning, monthKey: string, week: number, dayKey: string): { month?: Month; day?: Day } {
  const month = p.months.find((m) => m.key === monthKey);
  const w = month?.weeks.find((x) => x.index === week);
  const day = w?.days.find((d) => d.key === dayKey);
  return { month, day };
}

// -------- Offline cache keys + write helpers --------
export const cacheKeys = {
  planning: (uid: string | null) => `planning:${uid ?? "shared"}`,
  resultsAll: (uid: string) => `results:all:${uid}`,
  resultsDay: (uid: string, m: string, w: number, d: string) => `results:day:${uid}:${m}:${w}:${d}`,
  settings: (uid: string) => `settings:${uid}`,
  records: (uid: string) => `records:${uid}`,
  recordHistory: (uid: string, ex: string, rm: number | null) => `record_history:${uid}:${ex}:${rm ?? "all"}`,
};

type ResultInput = Partial<WorkoutResult> & {
  month_key: string;
  week: number;
  day_key: string;
  block_key: string;
};

/** Store a workout result locally (IndexedDB) and queue it for Supabase. */
async function queueResultLocally(uid: string, r: ResultInput) {
  const all = (await cacheGet<WorkoutResult[]>(cacheKeys.resultsAll(uid))) ?? [];
  const idx = all.findIndex(
    (x) =>
      x.month_key === r.month_key &&
      x.week === r.week &&
      x.day_key === r.day_key &&
      x.block_key === r.block_key,
  );
  const existing = idx >= 0 ? all[idx] : null;
  const local: WorkoutResult = {
    id: existing?.id ?? `local_${r.month_key}_${r.week}_${r.day_key}_${r.block_key}`,
    user_id: uid,
    status: "completed",
    weight: null,
    sets: null,
    reps: null,
    time_seconds: null,
    rpe: null,
    scale: null,
    notes: null,
    ...(existing ?? {}),
    ...r,
    updated_at: new Date().toISOString(),
  } as WorkoutResult;

  const next = idx >= 0 ? all.map((x, i) => (i === idx ? local : x)) : [local, ...all];
  await cacheSet(cacheKeys.resultsAll(uid), next);
  await cacheSet(
    cacheKeys.resultsDay(uid, r.month_key, r.week, r.day_key),
    next.filter((x) => x.month_key === r.month_key && x.week === r.week && x.day_key === r.day_key),
  );

  await enqueueOp({
    kind: "workout_result",
    dedupe_key: `wr:${uid}:${r.month_key}|${r.week}|${r.day_key}|${r.block_key}`,
    user_id: uid,
    payload: { ...r },
    base_updated_at: existing && !existing.id.startsWith("local_") ? existing.updated_at : null,
  });
}

/** Store a personal record locally (IndexedDB) and queue it for Supabase. */
async function queueRecordLocally(
  uid: string,
  r: { exercise: string; weight: number; rep_max: number; notes: string | null },
) {
  const all = (await cacheGet<PersonalRecord[]>(cacheKeys.records(uid))) ?? [];
  const idx = all.findIndex((x) => x.exercise === r.exercise && x.rep_max === r.rep_max);
  const existing = idx >= 0 ? all[idx] : null;
  const now = new Date().toISOString();
  const local: PersonalRecord = {
    id: existing?.id ?? `local_${r.exercise}_${r.rep_max}`,
    user_id: uid,
    created_at: existing?.created_at ?? now,
    ...r,
    updated_at: now,
  };
  const next = idx >= 0 ? all.map((x, i) => (i === idx ? local : x)) : [...all, local];
  await cacheSet(cacheKeys.records(uid), next);

  await enqueueOp({
    kind: "personal_record",
    dedupe_key: `pr:${uid}:${r.exercise}|${r.rep_max}`,
    user_id: uid,
    payload: { ...r },
    base_updated_at: existing && !existing.id.startsWith("local_") ? existing.updated_at : null,
  });
}

function isNetworkError(error: unknown): boolean {
  if (!isOnline()) return true;
  const msg = error instanceof Error ? error.message : String(error);
  return /failed to fetch|network|load failed|timeout|offline/i.test(msg);
}
