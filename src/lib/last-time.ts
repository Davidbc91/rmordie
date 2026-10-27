// «Igual que la última vez»: busca el último registro con carga del mismo
// ejercicio en otro día del plan.
import type { Month } from "./excel-parser";
import type { WorkoutResult } from "./store";
import { resolveMovementId, resolveMovements } from "./dictionary/resolve";

export type LastTime = {
  result: WorkoutResult;
  movementId: string;
};

/** Ejercicio principal de un bloque: el del RM detectado o el primero del texto. */
export function mainMovementId(content: string, detectedExercise?: string | null): string | null {
  if (detectedExercise) {
    const id = resolveMovementId(detectedExercise);
    if (id) return id;
  }
  return resolveMovements(content)[0]?.movementId ?? null;
}

/** Índice «mes|semana|día|bloque» → ids de movimientos del bloque. */
export function buildBlockMovementIndex(months: Month[]): Map<string, Set<string>> {
  const index = new Map<string, Set<string>>();
  for (const m of months) {
    for (const w of m.weeks) {
      for (const d of w.days) {
        for (const b of d.blocks) {
          const ids = new Set(resolveMovements(b.content).map((x) => x.movementId));
          if (ids.size) index.set(`${m.key}|${w.index}|${d.key}|${b.key}`, ids);
        }
      }
    }
  }
  return index;
}

export function findLastTime(
  movementId: string | null,
  results: WorkoutResult[],
  blockIndex: Map<string, Set<string>>,
  current: { month_key: string; week: number; day_key: string },
): LastTime | null {
  if (!movementId) return null;
  let best: WorkoutResult | null = null;
  for (const r of results) {
    if (r.weight == null || Number(r.weight) <= 0) continue;
    if (r.month_key === current.month_key && r.week === current.week && r.day_key === current.day_key) continue;
    const ids = blockIndex.get(`${r.month_key}|${r.week}|${r.day_key}|${r.block_key}`);
    if (!ids?.has(movementId)) continue;
    if (!best || String(r.updated_at) > String(best.updated_at)) best = r;
  }
  return best ? { result: best, movementId } : null;
}
