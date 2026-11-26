import { useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAllResults, usePersonalRecords, usePlanning } from "./store";
import { useAllPrHistory, useAthleteProfile, useMilestones, useBodyMetrics } from "./profile-store";
import { plannedPerWeek } from "./analytics";
import { evaluateMedals, MEDALS, type MedalState } from "./medals";
import { getCurrentUserId } from "./pin-gate";

/** Todas las medallas con su estado, a partir de lo que ya hay en caché. */
export function useMedals() {
  const results = useAllResults();
  const history = useAllPrHistory();
  const records = usePersonalRecords();
  const profile = useAthleteProfile();
  const metrics = useBodyMetrics();
  const saved = useMilestones();
  const { data: planning } = usePlanning();

  const ready = results.isSuccess && history.isSuccess && records.isSuccess && saved.isSuccess;

  const list: MedalState[] = useMemo(() => {
    const ms = metrics.data ?? [];
    const lastWeight = [...ms].reverse().find((m) => m.weight_kg != null)?.weight_kg ?? null;
    return evaluateMedals({
      results: results.data ?? [],
      history: history.data ?? [],
      records: records.data ?? [],
      bodyWeight: profile.data?.current_weight_kg ?? lastWeight,
      weeklyTarget: profile.data?.weekly_target ?? plannedPerWeek(planning?.data) ?? 4,
      savedCodes: new Set((saved.data ?? []).map((s) => s.code)),
    });
  }, [results.data, history.data, records.data, profile.data, metrics.data, saved.data, planning?.data]);

  const savedAt = useMemo(() => new Map((saved.data ?? []).map((s) => [s.code, s.achieved_at])), [saved.data]);

  return { list, ready, savedAt, saved: saved.data ?? [] };
}

/** Guarda medallas en la tabla de logros (sin pisar las que ya estaban). */
export function useStoreMedals() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rows: { code: string; achieved_at?: string | null }[]) => {
      const uid = getCurrentUserId();
      if (!uid || rows.length === 0) return;
      const payload = rows.map((r) => {
        const def = MEDALS.find((m) => m.code === r.code);
        return {
          user_id: uid,
          code: r.code,
          label: def?.name ?? r.code,
          detail: def?.how ?? null,
          ...(r.achieved_at ? { achieved_at: r.achieved_at.length === 10 ? `${r.achieved_at}T12:00:00` : r.achieved_at } : {}),
        };
      });
      const { error } = await (supabase as any)
        .from("milestones")
        .upsert(payload, { onConflict: "user_id,code", ignoreDuplicates: true });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["milestones"] }),
  });
}

/** Para las medallas que se ganan con una acción (compartir, sacar el informe). */
export function useAwardMedal() {
  const store = useStoreMedals();
  return (code: "coach_report" | "shared_workout") => store.mutate([{ code }]);
}
