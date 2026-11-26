import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentUserId } from "./pin-gate";
import { localDay } from "./analytics";

const sb = supabase as any;

export type Zone = "cuello" | "hombro" | "codo" | "muneca" | "lumbar" | "cadera" | "rodilla" | "tobillo";
export type Side = "left" | "right" | "both" | "none";
export const ZONES: { key: Zone; label: string; sided: boolean }[] = [
  { key: "cuello", label: "Cuello", sided: false },
  { key: "hombro", label: "Hombro", sided: true },
  { key: "codo", label: "Codo", sided: true },
  { key: "muneca", label: "Muñeca", sided: true },
  { key: "lumbar", label: "Lumbar", sided: false },
  { key: "cadera", label: "Cadera", sided: true },
  { key: "rodilla", label: "Rodilla", sided: true },
  { key: "tobillo", label: "Tobillo", sided: true },
];
export const LEVEL_HINT = ["", "Apenas se nota", "Molesta un poco al entrenar", "Molesta al cargar, no en el día a día", "Duele al entrenar", "Duele también fuera del box"];

export function zoneLabel(zone: Zone, side: Side, short = false) {
  const z = ZONES.find((x) => x.key === zone)?.label ?? zone;
  if (side === "none") return z;
  const s = side === "both" ? (short ? "ambos" : "los dos") : side === "right" ? (short ? "dcho" : "derecho") : (short ? "izdo" : "izquierdo");
  const fem = zone === "muneca" || zone === "cadera" || zone === "rodilla";
  const adj = side === "both" ? s : fem ? s.replace(/o$/, "a").replace("dcho", "dcha").replace("izdo", "izda") : s;
  return `${z} ${adj}`;
}

/* ---------- Movimientos que cargan cada zona y sus alternativas ---------- */

type Mov = { re: RegExp; name: string; zones: Zone[]; alts: { name: string; why: string }[] };
const M = (re: RegExp, name: string, zones: Zone[], alts: [string, string][]): Mov => ({ re, name, zones, alts: alts.map(([n, w]) => ({ name: n, why: w })) });

export const MOVEMENTS: Mov[] = [
  M(/\b(hspu|handstand push|handstand walk|wall walk|pino)/i, "Handstand", ["hombro", "cuello", "muneca"], [["Pike push-up en cajón", "Menos peso sobre el hombro"], ["Press con mancuerna, agarre neutro", "Sin carga sobre el cuello"]]),
  M(/(?<!push |bench |floor |leg |landmine |dumbbell |db )\b(strict press|shoulder press|press militar|press estricto|military press|press)\b(?! banca)/i, "Strict press", ["hombro", "codo"], [["Landmine press", "Menos rango por encima de la cabeza"], ["Press con mancuerna, agarre neutro", "Más cómodo para el hombro"]]),
  M(/\b(push press|push jerk|split jerk|jerk)\b/i, "Push press / jerk", ["hombro", "muneca", "codo"], [["Landmine push press", "Trayectoria más amable"], ["Push press con mancuerna a una mano", "Menos carga y agarre libre"]]),
  M(/\b(overhead squat|ohs|snatch|arrancada)\b/i, "Snatch / OHS", ["hombro", "muneca", "lumbar"], [["Clean o front squat", "Sin la barra por encima de la cabeza"], ["Snatch con mancuerna", "Menos carga y agarre libre"]]),
  M(/\bthrusters?\b/i, "Thruster", ["hombro", "muneca", "rodilla"], [["Front squat", "Sin la parte de press"], ["Thruster con mancuernas", "Agarre neutro, menos carga"]]),
  M(/\b(bench press|press banca|push[- ]?ups?|flexiones|ring dips?|dips?|fondos)\b/i, "Empuje horizontal", ["hombro", "codo", "muneca"], [["Floor press", "Menos rango para el hombro"], ["Flexiones inclinadas", "Menos carga"]]),
  M(/\b(muscle[- ]?ups?|bar muscle|ring muscle|mu)\b/i, "Muscle-up", ["hombro", "codo", "muneca"], [["Pull-ups estrictos + dips con banda", "Sin la transición"], ["Ring rows", "Mucha menos carga"]]),
  M(/\b(pull[- ]?ups?|chest[- ]to[- ]bar|c2b|dominadas|kipping)\b/i, "Pull-ups", ["hombro", "codo"], [["Ring rows", "Ángulo y carga regulables"], ["Jumping pull-ups", "Menos tensión en el hombro"]]),
  M(/\b(toes[- ]to[- ]bar|t2b|knees[- ]to[- ]elbows?|k2e)\b/i, "Toes to bar", ["hombro", "lumbar"], [["Hollow rocks", "Mismo core, sin colgarte"], ["V-ups", "Sin barra"]]),
  M(/\b(deadlift|peso muerto|rdl|good mornings?|sumo)\b/i, "Peso muerto", ["lumbar", "cadera"], [["Peso muerto con trap bar", "Espalda más vertical"], ["Hip thrust", "Cadera sin cargar la lumbar"]]),
  M(/\b(kb swings?|kettlebell swings?|swings?|american swing)\b/i, "KB swing", ["lumbar", "hombro"], [["Russian swing ligero", "Menos rango y carga"], ["Hip thrust con banda", "Mismo patrón de cadera"]]),
  M(/\b(power clean|squat clean|hang clean|clean|cargada)\b/i, "Clean", ["muneca", "lumbar", "codo"], [["Clean con mancuerna", "Agarre libre"], ["Clean high pull", "Sin recepción en front rack"]]),
  M(/\b(front squat|sentadilla frontal|front rack)\b/i, "Front squat", ["muneca", "rodilla"], [["Front squat con agarre cruzado o straps", "Menos tensión en la muñeca"], ["Goblet squat", "Sin barra"]]),
  M(/\b(back squat|sentadilla trasera)\b/i, "Back squat", ["rodilla", "cadera", "lumbar"], [["Box squat", "Controlas la profundidad"], ["Spanish squat", "Amable para la rodilla"]]),
  M(/\b(wall ?balls?)\b/i, "Wall ball", ["rodilla", "hombro"], [["Goblet squat + lanzamiento ligero", "Menos impacto"], ["Air squats", "Sin lanzamiento"]]),
  M(/\b(pistols?|lunges?|zancadas?|walking lunge|step[- ]?ups?|air squats?|sentadillas?)\b/i, "Sentadilla / zancada", ["rodilla", "cadera"], [["Sentadilla a cajón", "Controlas la profundidad"], ["Bici", "Sin carga en la rodilla"]]),
  M(/\b(box jumps?|box jump overs?|bjo|saltos? al cajón|broad jumps?)\b/i, "Saltos al cajón", ["rodilla", "tobillo"], [["Step-ups al cajón", "Sin impacto"], ["Bici", "Mismo pulso, sin saltos"]]),
  M(/\b(double unders?|dus?|single unders?|comba|saltos? de comba)\b/i, "Comba", ["tobillo", "rodilla"], [["Bici o remo por tiempo", "Sin impacto"], ["Single unders suaves", "Menos impacto"]]),
  M(/\b(run|running|correr|carrera|\d+ ?m run)\b/i, "Carrera", ["rodilla", "tobillo", "cadera"], [["Bici (calorías equivalentes)", "Sin impacto"], ["Remo", "Sin impacto en piernas"]]),
  M(/\b(burpees?)\b/i, "Burpees", ["hombro", "muneca", "rodilla"], [["Burpee sin flexión", "Menos carga en hombro y muñeca"], ["Step-back burpee", "Sin salto"]]),
  M(/\b(row|remo|rowing)\b/i, "Remo", ["lumbar"], [["Bici", "Espalda apoyada"], ["SkiErg suave", "Menos flexión lumbar"]]),
  M(/\b(sit[- ]?ups?|abmat|ghd)\b/i, "Sit-ups", ["lumbar", "cuello"], [["Dead bugs", "Core sin flexión de espalda"], ["Plancha", "Sin cargar el cuello"]]),
  M(/\b(farmers?|carry|paseo del granjero)\b/i, "Farmer carry", ["muneca", "lumbar"], [["Carry con straps", "Menos agarre"], ["Sled push", "Sin carga en las manos"]]),
];

/** Movimientos del texto que cargan alguna de las zonas indicadas (sin repetir). */
export function flagMovements(content: string, zones: Set<Zone>) {
  const out: { mov: Mov; zones: Zone[] }[] = [];
  const seen = new Set<string>();
  for (const m of MOVEMENTS) {
    if (!m.re.test(content) || seen.has(m.name)) continue;
    const hit = m.zones.filter((z) => zones.has(z));
    if (!hit.length) continue;
    seen.add(m.name);
    out.push({ mov: m, zones: hit });
  }
  return out;
}

/* ---------- Datos ---------- */

export type Injury = { id: string; user_id: string; zone: Zone; side: Side; level: number; started_on: string; note: string | null; status: "active" | "healed"; healed_on: string | null; created_at: string; updated_at: string };
export type Checkin = { injury_id: string; day: string; level: number };
export type Swap = { id: string; month_key: string; week: number; day_key: string; block_key: string; original: string; replacement: string; created_at: string };

export function useInjuries() {
  const uid = getCurrentUserId();
  return useQuery({
    queryKey: ["injuries", uid],
    enabled: !!uid,
    retry: false,
    staleTime: 60_000,
    queryFn: async (): Promise<{ injuries: Injury[]; checkins: Checkin[] }> => {
      const { data, error } = await sb.from("injuries").select("*").eq("user_id", uid).order("created_at", { ascending: false });
      if (error) throw error;
      const ids = (data ?? []).map((i: Injury) => i.id);
      let checkins: Checkin[] = [];
      if (ids.length) {
        const { data: c } = await sb.from("injury_checkins").select("injury_id, day, level").in("injury_id", ids).gte("day", localDay(new Date(Date.now() - 30 * 864e5))).order("day");
        checkins = c ?? [];
      }
      return { injuries: data ?? [], checkins };
    },
  });
}

export function useSaveInjury() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (i: Partial<Injury> & { zone: Zone; side: Side; level: number }) => {
      const uid = getCurrentUserId();
      const row = { ...i, user_id: uid, updated_at: new Date().toISOString() };
      const q = i.id ? sb.from("injuries").update(row).eq("id", i.id).select("id").single() : sb.from("injuries").insert(row).select("id").single();
      const { data, error } = await q;
      if (error) throw error;
      // El primer día del seguimiento es el nivel con el que se apunta
      await sb.from("injury_checkins").upsert({ injury_id: data.id, day: localDay(), level: i.level }, { onConflict: "injury_id,day" });
      return data.id as string;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["injuries"] }),
  });
}

export function useCheckin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ injury, level }: { injury: Injury; level: number }) => {
      const { error } = await sb.from("injury_checkins").upsert({ injury_id: injury.id, day: localDay(), level }, { onConflict: "injury_id,day" });
      if (error) throw error;
      await sb.from("injuries").update({ level, updated_at: new Date().toISOString() }).eq("id", injury.id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["injuries"] }),
  });
}

export function useHealInjury() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, healed }: { id: string; healed: boolean }) => {
      const { error } = await sb.from("injuries").update({ status: healed ? "healed" : "active", healed_on: healed ? localDay() : null, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["injuries"] }),
  });
}

export function useDeleteInjury() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("injuries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["injuries"] }),
  });
}

export function useDaySwaps(month: string, week: number, day: string) {
  const uid = getCurrentUserId();
  return useQuery({
    queryKey: ["injury-swaps", uid, month, week, day],
    enabled: !!uid,
    retry: false,
    queryFn: async (): Promise<Swap[]> => {
      const { data, error } = await sb.from("injury_swaps").select("*").eq("user_id", uid).eq("month_key", month).eq("week", week).eq("day_key", day);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useSaveSwap() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (s: { month_key: string; week: number; day_key: string; block_key: string; original: string; replacement: string | null }) => {
      const uid = getCurrentUserId();
      if (s.replacement == null) {
        const { error } = await sb.from("injury_swaps").delete().eq("user_id", uid).eq("month_key", s.month_key).eq("week", s.week).eq("day_key", s.day_key).eq("block_key", s.block_key).eq("original", s.original);
        if (error) throw error;
        return;
      }
      const { error } = await sb.from("injury_swaps").upsert({ ...s, user_id: uid }, { onConflict: "user_id,month_key,week,day_key,block_key,original" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["injury-swaps"] }),
  });
}

export type CoachInjuries = { injuries: (Pick<Injury, "id" | "zone" | "side" | "level" | "started_on" | "status" | "healed_on"> & { checkins: { day: string; level: number }[] })[]; swaps: { original: string; replacement: string; created_at: string }[] };
export function useCoachAthleteInjuries(athlete: string | null) {
  return useQuery({
    queryKey: ["coach-athlete-injuries", athlete],
    enabled: !!athlete,
    retry: false,
    queryFn: async (): Promise<CoachInjuries> => {
      const { data, error } = await sb.rpc("coach_athlete_injuries", { p_athlete: athlete });
      if (error) throw error;
      return data ?? { injuries: [], swaps: [] };
    },
  });
}
