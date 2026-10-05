import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import type { Movement } from "./types";

let cachedCustomMovements: Movement[] = [];
let cacheVersion = 0;

function mapRow(row: Record<string, unknown>): Movement {
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    nameEs: String(row.name_es ?? ""),
    aliases: Array.isArray(row.aliases) ? row.aliases.map(String) : [],
    category: String(row.category ?? "Personalizado"),
    equipment: Array.isArray(row.equipment) ? row.equipment.map(String) : [],
    level: row.level === "Beginner" || row.level === "Advanced" ? row.level : "Intermediate",
    rm: row.rm === true,
    description: String(row.description ?? ""),
    technique: Array.isArray(row.technique) ? row.technique.map(String) : [],
    commonMistakes: Array.isArray(row.common_mistakes) ? row.common_mistakes.map(String) : [],
    progressions: Array.isArray(row.progressions) ? row.progressions.map(String) : [],
    regressions: Array.isArray(row.regressions) ? row.regressions.map(String) : [],
    muscles: Array.isArray(row.muscles) ? row.muscles.map(String) : [],
    videoUrl: String(row.video_url ?? ""),
  };
}

export async function fetchCustomMovements(): Promise<Movement[]> {
  const { data, error } = await (supabase as any)
    .from("custom_movements")
    .select("*")
    .order("name");
  if (error) throw error;
  const movements = (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
  setCustomMovements(movements);
  return movements;
}

export function getCustomMovements(): Movement[] {
  return cachedCustomMovements;
}

export function setCustomMovements(value: Movement[]) {
  cachedCustomMovements = value;
  cacheVersion += 1;
}

export function getCustomMovementCacheVersion() {
  return cacheVersion;
}


export function useCustomMovements() {
  return useQuery({
    queryKey: ["custom-movements"],
    queryFn: fetchCustomMovements,
    staleTime: 5 * 60_000,
  });
}
