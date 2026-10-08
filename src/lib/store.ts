import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentUserId, sha256 } from "./pin-gate";
import type { Planning, Month, Day } from "./excel-parser";
import { cacheGet, cacheSet, isOnline, offlineRead } from "./offline/cache";
import { enqueueOp } from "./offline/queue";
import { processQueue } from "./offline/sync";
import { sameExercise } from "./rm-matcher";

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


/**
 * Cambia el PIN comprobando antes el PIN actual en la base de datos
 * (con límite de intentos). Ya no se puede escribir el PIN directamente.
 */
export function useUpdateProfilePin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, currentPin, pin }: { id: string; currentPin: string; pin: string }) => {
      const [current, next] = await Promise.all([sha256(currentPin), sha256(pin)]);
      const { data, error } = await supabase.rpc("change_profile_pin", {
        _profile_id: id,
        _current_pin_hash: current,
        _new_pin_hash: next,
      });
      if (error) throw error;
      if (data !== true) throw new Error("El PIN actual no es correcto.");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profiles"] }),
  });
}

/** Elimina el propio perfil y sus registros. Exige el PIN; el administrador no se puede eliminar. */
export function useDeleteProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, pin }: { id: string; pin: string }) => {
      const { data, error } = await supabase.rpc("delete_own_profile", {
        _profile_id: id,
        _pin_hash: await sha256(pin),
      });
      if (error) throw error;
      if (data !== true) throw new Error("El PIN no es correcto.");
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

export function usePlanningVersions() {
  const uid = getCurrentUserId();
  return useQuery({
    queryKey: ["planning_versions", uid],
    enabled: !!uid,
    queryFn: async (): Promise<PlanningRow[]> =>
      offlineRead(cacheKeys.planningVersions(uid!), async () => {
        const { data, error } = await supabase
          .from("planning")
          .select("*")
          .eq("user_id", uid!)
          .order("imported_at", { ascending: false });
        if (error) throw error;
        return (data ?? []) as unknown as PlanningRow[];
      }),
  });
}

export function useReorderPlanningMonths() {
  const qc = useQueryClient();
  const uid = getCurrentUserId();
  return useMutation({
    mutationFn: async ({ planningId, monthKeys }: { planningId: string; monthKeys: string[] }) => {
      if (!uid) throw new Error("No hay perfil activo");
      const { data: row, error: readError } = await supabase
        .from("planning")
        .select("data")
        .eq("id", planningId)
        .eq("user_id", uid)
        .maybeSingle();
      if (readError) throw readError;

      if (!row) throw new Error("No se encontró esta planificación para tu perfil.");
      const current = row.data as Planning;
      const months = current?.months ?? [];
      const byKey = new Map(months.map((month) => [month.key, month]));
      if (monthKeys.length !== months.length || monthKeys.some((key) => !byKey.has(key))) {
        throw new Error("El orden recibido no coincide con los meses de la planificación.");
      }

      const nextMonths = monthKeys.map((key, index) => ({
        ...byKey.get(key)!,
        order: index + 1,
      }));
      const nextPlanning: Planning = {
        ...current,
        months: nextMonths,
        importedAt: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("planning")
        .update({ data: nextPlanning as unknown as never })
        .eq("id", planningId)
        .eq("user_id", uid);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["planning", uid] });
      qc.invalidateQueries({ queryKey: ["planning_versions", uid] });
    },
  });
}

export function useDeletePlanningMonth() {
  const qc = useQueryClient();
  const uid = getCurrentUserId();
  return useMutation({
    mutationFn: async ({ planningId, monthKey }: { planningId: string; monthKey: string }) => {
      if (!uid) throw new Error("No hay perfil activo");
      const { data: row, error: readError } = await supabase
        .from("planning")
        .select("data")
        .eq("id", planningId)
        .eq("user_id", uid)
        .single();
      if (readError) throw readError;

      const current = row?.data as Planning;
      const months = current?.months ?? [];
      if (months.length <= 1) {
        throw new Error("No puedes eliminar el único mes de una planificación. Elimina la planificación completa.");
      }
      const nextMonths = months.filter((m) => m.key !== monthKey);
      if (nextMonths.length === months.length) throw new Error("El mes ya no existe.");
      const nextPlanning: Planning = { ...current, months: nextMonths };
      const { error } = await supabase
        .from("planning")
        .update({ data: nextPlanning as unknown as never })
        .eq("id", planningId)
        .eq("user_id", uid);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["planning", uid] });
      qc.invalidateQueries({ queryKey: ["planning_versions", uid] });
    },
  });
}

export function useDeletePlanningVersion() {
  const qc = useQueryClient();
  const uid = getCurrentUserId();
  return useMutation({
    mutationFn: async (planningId: string) => {
      if (!uid) throw new Error("No hay perfil activo");
      const { data: row, error: readError } = await supabase
        .from("planning")
        .select("is_active")
        .eq("id", planningId)
        .eq("user_id", uid)
        .single();
      if (readError) throw readError;

      const { error } = await supabase
        .from("planning")
        .delete()
        .eq("id", planningId)
        .eq("user_id", uid);
      if (error) throw error;

      if (row?.is_active) {
        const { data: fallback } = await supabase
          .from("planning")
          .select("id")
          .eq("user_id", uid)
          .order("imported_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (fallback?.id) {
          await supabase.from("planning").update({ is_active: true }).eq("id", fallback.id).eq("user_id", uid);
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["planning", uid] });
      qc.invalidateQueries({ queryKey: ["planning_versions", uid] });
    },
  });
}

export function useClearAllPlanning() {
  const qc = useQueryClient();
  const uid = getCurrentUserId();

  return useMutation({
    mutationFn: async () => {
      if (!uid) throw new Error("No hay perfil activo");

      // Vacía únicamente la planificación del atleta. Resultados, PRs,
      // historial, notas, métricas y cualquier otro dato permanecen intactos.
      const { data: ownRows, error: readError } = await supabase
        .from("planning")
        .select("id,version,imported_at,is_active")
        .eq("user_id", uid)
        .order("imported_at", { ascending: false });

      if (readError) throw readError;

      const rows = (ownRows ?? []) as Array<{
        id: string;
        version: number;
        imported_at: string;
        is_active: boolean;
      }>;

      const keep =
        rows.find((row) => row.is_active) ??
        rows[0] ??
        null;

      if (keep) {
        const nextPlanning: Planning = {
          months: [],
          importedAt: new Date().toISOString(),
        };

        const { error: updateError } = await supabase
          .from("planning")
          .update({
            data: nextPlanning as unknown as never,
            source_filename: "Sin planificación",
            is_active: true,
          })
          .eq("id", keep.id)
          .eq("user_id", uid);

        if (updateError) throw updateError;

        const otherIds = rows.filter((row) => row.id !== keep.id).map((row) => row.id);
        if (otherIds.length) {
          const { error: deleteError } = await supabase
            .from("planning")
            .delete()
            .eq("user_id", uid)
            .in("id", otherIds);
          if (deleteError) throw deleteError;
        }
      } else {
        const { data: latest } = await supabase
          .from("planning")
          .select("version")
          .order("version", { ascending: false })
          .limit(1)
          .maybeSingle();

        const nextVersion = ((latest?.version as number | undefined) ?? 0) + 1;
        const { error: insertError } = await supabase.from("planning").insert({
          user_id: uid,
          version: nextVersion,
          source_filename: "Sin planificación",
          data: { months: [], importedAt: new Date().toISOString() } as never,
          is_active: true,
        });

        if (insertError) throw insertError;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["planning", uid] });
      qc.invalidateQueries({ queryKey: ["planning_versions", uid] });
    },
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
      const { data: inserted, error } = await supabase
        .from("planning")
        .insert({
          user_id: uid,
          version: nextVersion,
          source_filename: input.filename ?? null,
          data: input.planning as unknown as never,
          is_active: true,
        })
        .select("*")
        .single();
      if (error) throw error;
      if (inserted) {
        await cacheSet(cacheKeys.planning(uid), inserted as unknown as PlanningRow);
      }
      return inserted as unknown as PlanningRow;
    },
    onSuccess: (saved) => {
      if (saved) {
        qc.setQueryData(["planning", getCurrentUserId()], saved);
      }
      qc.invalidateQueries({ queryKey: ["planning"] });
      qc.invalidateQueries({ queryKey: ["planning_versions"] });
    },
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

export function useDeleteWorkoutResults() {
  const qc = useQueryClient();
  const uid = getCurrentUserId();
  return useMutation({
    mutationFn: async (input: { month_key: string; week: number; day_key: string }) => {
      if (!uid) throw new Error("No hay perfil activo");
      if (!isOnline()) throw new Error("Necesitas conexión para desmarcar el entreno.");
      const { error } = await supabase
        .from("workout_results")
        .delete()
        .eq("user_id", uid)
        .eq("month_key", input.month_key)
        .eq("week", input.week)
        .eq("day_key", input.day_key);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["results", uid, vars.month_key, vars.week, vars.day_key] });
      qc.invalidateQueries({ queryKey: ["results", uid, "all"] });
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
      // Internal identity is the normalized name: if the exercise already
      // exists with different casing/spacing, reuse the stored (visible) name
      // so we never create a duplicate row for the same exercise.
      const repMax = r.rep_max ?? 1;
      const existing = (qc.getQueryData<PersonalRecord[]>(["personal_records", uid]) ?? []).find(
        (x) => (x.rep_max ?? 1) === repMax && sameExercise(x.exercise, r.exercise),
      );
      const row = {
        exercise: existing ? existing.exercise : r.exercise.trim(),
        weight: r.weight,
        rep_max: repMax,
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
  planningVersions: (uid: string) => `planning:versions:${uid}`,
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
