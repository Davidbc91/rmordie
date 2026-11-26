import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentUserId } from "./pin-gate";
import { localDay } from "./analytics";

const sb = supabase as any;

export type ChallengeMetric = "days" | "volume" | "prs" | "weeks";
export type Challenge = {
  id: string;
  owner_id: string;
  title: string;
  metric: ChallengeMetric;
  goal: number | null;
  starts_on: string;
  ends_on: string;
  open: boolean;
  created_at: string;
  participants: string[];
};
export type LeaderRow = { profile_id: string; name: string; score: number };

export const METRICS: Record<ChallengeMetric, { label: string; hint: string; unit: (n: number) => string; icon: string }> = {
  days: { label: "Días entrenados", hint: "Un día cuenta si completas un entreno", unit: (n) => (n === 1 ? "día" : "días"), icon: "días" },
  volume: { label: "Kilos movidos", hint: "Peso × series × reps", unit: () => "kg", icon: "kg" },
  prs: { label: "Récords batidos", hint: "Cualquier RM nuevo", unit: (n) => (n === 1 ? "récord" : "récords"), icon: "RM" },
  weeks: { label: "Semanas cumplidas", hint: "Llegar al objetivo de días", unit: (n) => (n === 1 ? "semana" : "semanas"), icon: "sem" },
};

export const fmtScore = (metric: ChallengeMetric, n: number) =>
  metric === "volume" ? (n >= 10000 ? `${(Math.round(n / 100) / 10).toString().replace(".", ",")} t` : Math.round(n).toLocaleString("es-ES")) : String(Math.round(n * 10) / 10).replace(".", ",");

export function challengeState(c: Challenge, today = localDay()): "upcoming" | "active" | "finished" {
  if (today < c.starts_on) return "upcoming";
  if (today > c.ends_on) return "finished";
  return "active";
}
export function daysLeft(c: Challenge, today = localDay()): number {
  const a = new Date(`${today}T12:00:00`).getTime();
  const b = new Date(`${c.ends_on}T12:00:00`).getTime();
  return Math.max(0, Math.round((b - a) / 864e5) + 1);
}

/** Retos que puedes ver, con sus participantes. Si la tabla aún no existe devuelve error (se oculta). */
export function useChallenges() {
  const uid = getCurrentUserId();
  return useQuery({
    queryKey: ["challenges", uid],
    enabled: !!uid,
    retry: false,
    staleTime: 60_000,
    queryFn: async (): Promise<Challenge[]> => {
      const { data, error } = await sb
        .from("challenges")
        .select("*, challenge_participants(profile_id)")
        .order("ends_on", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((c: any) => ({
        ...c,
        goal: c.goal != null ? Number(c.goal) : null,
        participants: (c.challenge_participants ?? []).map((p: any) => p.profile_id),
      }));
    },
  });
}

export function useLeaderboard(id: string | null) {
  return useQuery({
    queryKey: ["challenge-board", id],
    enabled: !!id,
    staleTime: 30_000,
    queryFn: async (): Promise<LeaderRow[]> => {
      const { data, error } = await sb.rpc("challenge_leaderboard", { p_challenge: id });
      if (error) throw error;
      return (data ?? []).map((r: any) => ({ ...r, score: Number(r.score) || 0 }));
    },
  });
}

export function useJoinChallenge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, join }: { id: string; join: boolean }) => {
      const me = getCurrentUserId();
      if (!me) throw new Error("No hay perfil activo");
      const q = join
        ? sb.from("challenge_participants").insert({ challenge_id: id, profile_id: me })
        : sb.from("challenge_participants").delete().eq("challenge_id", id).eq("profile_id", me);
      const { error } = await q;
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["challenges"] });
      qc.invalidateQueries({ queryKey: ["challenge-board"] });
    },
  });
}

export function useCreateChallenge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { title: string; metric: ChallengeMetric; goal: number | null; starts_on: string; ends_on: string; open: boolean; members: string[] }) => {
      const me = getCurrentUserId();
      if (!me) throw new Error("No hay perfil activo");
      const { data, error } = await sb
        .from("challenges")
        .insert({ owner_id: me, title: input.title, metric: input.metric, goal: input.goal, starts_on: input.starts_on, ends_on: input.ends_on, open: input.open })
        .select("id")
        .single();
      if (error) throw error;
      const ids = Array.from(new Set(input.members));
      if (ids.length) {
        const { error: e2 } = await sb.from("challenge_participants").insert(ids.map((pid) => ({ challenge_id: data.id, profile_id: pid })));
        if (e2) throw e2;
      }
      return data.id as string;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["challenges"] }),
  });
}

export function useDeleteChallenge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("challenges").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["challenges"] }),
  });
}
