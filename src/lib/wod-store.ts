import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentUserId } from "./pin-gate";
import {
  compareScores,
  scoreValue,
  type WodScale,
  type WodStatus,
  type WodType,
} from "./wod";

const sb = supabase as any;

export type WodResult = {
  id: string;
  user_id: string;
  wod_slug: string;
  wod_name: string;
  wod_type: WodType;
  scale: WodScale;
  status: WodStatus;
  time_seconds: number | null;
  rounds: number | null;
  reps: number | null;
  weight: number | null;
  distance: number | null;
  calories: number | null;
  rpe: number | null;
  notes: string | null;
  source: "workout" | "manual";
  month_key: string | null;
  week: number | null;
  day_key: string | null;
  block_key: string | null;
  performed_on: string;
  is_pr: boolean;
  created_at: string;
};

export type WodSaveInput = {
  wod_slug: string;
  wod_name: string;
  wod_type: WodType;
  scale: WodScale;
  status: WodStatus;
  time_seconds?: number | null;
  rounds?: number | null;
  reps?: number | null;
  weight?: number | null;
  distance?: number | null;
  calories?: number | null;
  rpe?: number | null;
  notes?: string | null;
  source?: "workout" | "manual";
  month_key?: string | null;
  week?: number | null;
  day_key?: string | null;
  block_key?: string | null;
  performed_on?: string;
};

export type PrOutcome = {
  kind: "pr" | "matched" | "none" | "unranked";
  wod_name: string;
  wod_type: WodType;
  scale: WodScale;
  result: WodResult;
  previousBest: WodResult | null;
};

export function useWodResults() {
  const uid = getCurrentUserId();
  return useQuery({
    queryKey: ["wod_results", uid],
    enabled: !!uid,
    queryFn: async (): Promise<WodResult[]> => {
      const { data, error } = await sb
        .from("wod_results")
        .select("*")
        .eq("user_id", uid!)
        .order("performed_on", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as WodResult[];
    },
  });
}

export function useSaveWodResult() {
  const qc = useQueryClient();
  const uid = getCurrentUserId();
  return useMutation({
    mutationFn: async (input: WodSaveInput): Promise<PrOutcome> => {
      if (!uid) throw new Error("No hay perfil activo");
      const source = input.source ?? "workout";

      // Resultados previos del mismo WOD y misma modalidad (RX/Scaled/Custom)
      const { data: prevRows, error: prevErr } = await sb
        .from("wod_results")
        .select("*")
        .eq("user_id", uid)
        .eq("wod_slug", input.wod_slug)
        .eq("scale", input.scale);
      if (prevErr) throw prevErr;
      const previous = (prevRows ?? []) as WodResult[];

      // ¿Existe ya una fila para este hueco del entrenamiento? -> actualizar
      let existingId: string | null = null;
      if (source === "workout" && input.month_key) {
        existingId =
          previous.find(
            (r) =>
              r.source === "workout" &&
              r.month_key === input.month_key &&
              r.week === input.week &&
              r.day_key === input.day_key &&
              r.block_key === input.block_key,
          )?.id ?? null;
        if (!existingId) {
          const { data: anySlot } = await sb
            .from("wod_results")
            .select("id")
            .eq("user_id", uid)
            .eq("month_key", input.month_key)
            .eq("week", input.week!)
            .eq("day_key", input.day_key!)
            .eq("block_key", input.block_key!)
            .eq("source", "workout")
            .maybeSingle();
          existingId = anySlot?.id ?? null;
        }
      }

      const history = previous.filter((r) => r.id !== existingId);
      const ranked = history
        .map((r) => ({ r, v: scoreValue(r) }))
        .filter((x) => x.v != null) as { r: WodResult; v: number }[];
      const previousBest =
        ranked.length === 0
          ? null
          : ranked.reduce((best, cur) =>
              compareScores(input.wod_type, cur.r, best.r)! > 0 ? cur : best,
            ).r;

      const candidate = {
        wod_type: input.wod_type,
        status: input.status,
        time_seconds: input.time_seconds ?? null,
        rounds: input.rounds ?? null,
        reps: input.reps ?? null,
        distance: input.distance ?? null,
        calories: input.calories ?? null,
      };
      const candidateValue = scoreValue(candidate);

      let kind: PrOutcome["kind"] = "none";
      if (candidateValue == null) {
        kind = "unranked";
      } else if (!previousBest) {
        kind = "pr";
      } else {
        const cmp = compareScores(input.wod_type, candidate, previousBest);
        kind = cmp == null ? "unranked" : cmp > 0 ? "pr" : cmp === 0 ? "matched" : "none";
      }

      const payload = {
        user_id: uid,
        wod_slug: input.wod_slug,
        wod_name: input.wod_name,
        wod_type: input.wod_type,
        scale: input.scale,
        status: input.status,
        time_seconds: input.time_seconds ?? null,
        rounds: input.rounds ?? null,
        reps: input.reps ?? null,
        weight: input.weight ?? null,
        distance: input.distance ?? null,
        calories: input.calories ?? null,
        rpe: input.rpe ?? null,
        notes: input.notes ?? null,
        source,
        month_key: input.month_key ?? null,
        week: input.week ?? null,
        day_key: input.day_key ?? null,
        block_key: input.block_key ?? null,
        performed_on: input.performed_on ?? new Date().toISOString().slice(0, 10),
        is_pr: kind === "pr",
      };

      let row: WodResult;
      if (existingId) {
        const { data, error } = await sb
          .from("wod_results")
          .update(payload)
          .eq("id", existingId)
          .select("*")
          .single();
        if (error) throw error;
        row = data as WodResult;
      } else {
        const { data, error } = await sb
          .from("wod_results")
          .insert(payload)
          .select("*")
          .single();
        if (error) throw error;
        row = data as WodResult;
      }

      return {
        kind,
        wod_name: input.wod_name,
        wod_type: input.wod_type,
        scale: input.scale,
        result: row,
        previousBest,
      };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wod_results", uid] });
    },
  });
}

export function useDeleteWodResult() {
  const qc = useQueryClient();
  const uid = getCurrentUserId();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("wod_results").delete().eq("id", id).eq("user_id", uid!);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wod_results", uid] }),
  });
}

export type WodSummary = {
  slug: string;
  name: string;
  type: WodType;
  attempts: number;
  results: WodResult[];
  first: WodResult | null;
  last: WodResult | null;
  best: WodResult | null;
  bestRx: WodResult | null;
  bestScaled: WodResult | null;
  average: number | null;
  trend: "up" | "down" | "flat";
};

function bestOf(list: WodResult[], type: WodType): WodResult | null {
  const ranked = list.filter((r) => scoreValue(r) != null);
  if (!ranked.length) return null;
  return ranked.reduce((best, cur) => (compareScores(type, cur, best)! > 0 ? cur : best));
}

export function summarizeWods(results: WodResult[]): WodSummary[] {
  const groups = new Map<string, WodResult[]>();
  for (const r of results) {
    const arr = groups.get(r.wod_slug) ?? [];
    arr.push(r);
    groups.set(r.wod_slug, arr);
  }
  const out: WodSummary[] = [];
  for (const [slug, list] of groups) {
    const sorted = [...list].sort(
      (a, b) =>
        new Date(a.performed_on).getTime() - new Date(b.performed_on).getTime() ||
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
    const type = sorted[sorted.length - 1].wod_type;
    const values = sorted.map((r) => scoreValue(r)).filter((v): v is number => v != null);
    const best = bestOf(sorted, type);
    const first = sorted.find((r) => scoreValue(r) != null) ?? sorted[0];
    const last = sorted[sorted.length - 1];
    let trend: WodSummary["trend"] = "flat";
    if (values.length >= 2) {
      const diff = values[values.length - 1] - values[values.length - 2];
      if (diff !== 0) {
        const improving = type === "for_time" ? diff < 0 : diff > 0;
        trend = improving ? "up" : "down";
      }
    }
    out.push({
      slug,
      name: last.wod_name,
      type,
      attempts: sorted.length,
      results: sorted,
      first,
      last,
      best,
      bestRx: bestOf(sorted.filter((r) => r.scale === "rx"), type),
      bestScaled: bestOf(sorted.filter((r) => r.scale === "scaled"), type),
      average: values.length ? values.reduce((a, b) => a + b, 0) / values.length : null,
      trend,
    });
  }
  return out.sort(
    (a, b) =>
      new Date(b.last!.performed_on).getTime() - new Date(a.last!.performed_on).getTime(),
  );
}
