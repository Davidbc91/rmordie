import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentUserId } from "./pin-gate";
import { cloneBlocks, pid, type PBlock, type PlanState } from "./plan-builder";

export type LibCategory = "mine" | "benchmarks" | "warmups" | "accessories";
export type LibItem = { id: string; cat: LibCategory; title: string; subtitle: string; block: PBlock };

const wod = (title: string, format: "AMRAP" | "EMOM" | "FOR TIME" | "TABATA", minutes: string, text: string): LibItem => ({
  id: `b-${title}`, cat: "benchmarks", title,
  subtitle: `${format === "FOR TIME" ? "For time" : format}${minutes && format !== "FOR TIME" ? ` ${minutes}'` : ""} · ${text.split("\n").join(", ")}`,
  block: { id: "", kind: "wod", format, minutes, text: `${title}\n${text}` },
});
const txt = (cat: LibCategory, title: string, text: string): LibItem => ({
  id: `${cat}-${title}`, cat, title, subtitle: text.split("\n").slice(0, 3).join(" · "),
  block: { id: "", kind: "texto", title, text },
});

export const BUILTIN: LibItem[] = [
  wod("Fran", "FOR TIME", "", "21-15-9\nThrusters 43/30 kg\nPull-ups"),
  wod("Grace", "FOR TIME", "", "30 Clean & Jerk 61/43 kg"),
  wod("Isabel", "FOR TIME", "", "30 Snatch 61/43 kg"),
  wod("Diane", "FOR TIME", "", "21-15-9\nDeadlift 102/70 kg\nHandstand push-ups"),
  wod("Elizabeth", "FOR TIME", "", "21-15-9\nSquat clean 61/43 kg\nRing dips"),
  wod("Helen", "FOR TIME", "", "3 rondas\n400 m run\n21 KB swings 24/16 kg\n12 Pull-ups"),
  wod("Karen", "FOR TIME", "", "150 Wall balls 9/6 kg"),
  wod("Cindy", "AMRAP", "20", "5 Pull-ups\n10 Push-ups\n15 Air squats"),
  wod("Mary", "AMRAP", "20", "5 Handstand push-ups\n10 Pistols\n15 Pull-ups"),
  wod("Annie", "FOR TIME", "", "50-40-30-20-10\nDouble unders\nSit-ups"),
  wod("Jackie", "FOR TIME", "", "1000 m row\n50 Thrusters 20/15 kg\n30 Pull-ups"),
  wod("Murph", "FOR TIME", "", "1 mile run\n100 Pull-ups\n200 Push-ups\n300 Air squats\n1 mile run\n(con chaleco 9/6 kg)"),
  wod("DT", "FOR TIME", "", "5 rondas\n12 Deadlift 70/47 kg\n9 Hang power clean\n6 Push jerk"),
  wod("Fight Gone Bad", "FOR TIME", "", "3 rondas, 1' por estación\nWall balls · SDHP · Box jump · Push press · Row\n1' descanso"),
  txt("warmups", "Calentamiento general", "3 rondas\n200 m row\n10 Air squats\n10 Push-ups\n10 Ring rows"),
  txt("warmups", "Calentamiento de halterofilia", "Barra vacía\n5 Muscle clean\n5 Front squat\n5 Push press\n5 Hang power clean"),
  txt("warmups", "Movilidad de cadera y tobillo", "2 rondas\n30\" Couch stretch por lado\n10 Cossack squats\n10 Tobillo a la pared por lado"),
  txt("warmups", "Calentamiento de hombro", "2 rondas\n15 Band pull-aparts\n10 PVC pass-through\n10 Scap pull-ups"),
  txt("accessories", "Core", "3 rondas\n30\" Hollow hold\n15 Russian twist\n10 Toes to bar"),
  txt("accessories", "Posterior", "3×10 Romanian deadlift\n3×12 Hip thrust\n3×15 Good morning"),
  txt("accessories", "Tirón", "4×8 Strict pull-ups\n3×12 Ring rows\n3×15 Band face pulls"),
  txt("accessories", "Unilateral", "3×10 Bulgarian split squat por pierna\n3×12 Step-ups\n3×20 Walking lunges"),
];

/** Copia del bloque con ids nuevos, lista para añadirse a un día. */
export function instantiate(item: LibItem): PBlock {
  return cloneBlocks([{ ...item.block, id: pid() } as PBlock])[0];
}

/* ---------- Biblioteca propia y plantillas (base de datos) ---------- */

const sb = supabase as any;
export type SavedItem = { id: string; kind: "block" | "plan"; title: string; payload: any; created_at: string };

export function useMyLibrary() {
  const uid = getCurrentUserId();
  return useQuery({
    queryKey: ["builder-library", uid],
    enabled: !!uid,
    retry: false,
    staleTime: 60_000,
    queryFn: async (): Promise<SavedItem[]> => {
      const { data, error } = await sb.from("builder_library").select("*").eq("owner_id", uid).order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useSaveToLibrary() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (item: { kind: "block" | "plan"; title: string; payload: PBlock | PlanState }) => {
      const uid = getCurrentUserId();
      const { error } = await sb.from("builder_library").insert({ owner_id: uid, kind: item.kind, title: item.title.slice(0, 80), payload: item.payload });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["builder-library"] }),
  });
}

export function useDeleteFromLibrary() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("builder_library").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["builder-library"] }),
  });
}

/** RM de un atleta (solo si te deja ver sus entrenos), para «Ver como». */
export function useAthleteRms(athlete: string | null) {
  return useQuery({
    queryKey: ["coach-athlete-rms", athlete],
    enabled: !!athlete,
    retry: false,
    queryFn: async (): Promise<{ exercise: string; weight: number; rep_max: number | null }[]> => {
      const { data, error } = await sb.rpc("coach_athlete_records", { p_athlete: athlete });
      if (error) throw error;
      return (data ?? []).map((r: any) => ({ ...r, weight: Number(r.weight) }));
    },
  });
}
