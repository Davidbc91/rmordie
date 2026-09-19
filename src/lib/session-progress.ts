import type { WorkoutResult } from "./store";
import type { Planning, Day } from "./excel-parser";

/**
 * Single source of truth for "is a session done?".
 * A session (a planning day) counts as completed ONLY when every one of its
 * blocks has a completed result. Partial sessions are "in progress".
 */

export const dayId = (monthKey: string, week: number, dayKey: string) =>
  `${monthKey}|${week}|${dayKey}`;

export type BlockMap = Map<string, Set<string>>;

/** day id -> set of completed block keys */
export function completedBlockMap(results: WorkoutResult[]): BlockMap {
  const m: BlockMap = new Map();
  for (const r of results) {
    if (r.status !== "completed") continue;
    const id = dayId(r.month_key, r.week, r.day_key);
    let s = m.get(id);
    if (!s) m.set(id, (s = new Set()));
    s.add(r.block_key);
  }
  return m;
}

export type SessionState = "pending" | "in_progress" | "completed";

export type SessionProgress = {
  done: number;
  total: number;
  pct: number;
  state: SessionState;
};

export function sessionProgress(
  day: Day,
  monthKey: string,
  week: number,
  map: BlockMap,
): SessionProgress {
  const total = day.blocks.length;
  const logged = map.get(dayId(monthKey, week, day.key));
  let done = 0;
  if (logged) for (const b of day.blocks) if (logged.has(b.key)) done++;
  const complete = total > 0 && done >= total;
  return {
    done,
    total,
    pct: total ? Math.round((done / total) * 100) : 0,
    state: complete ? "completed" : done > 0 ? "in_progress" : "pending",
  };
}

export function isSessionCompleted(
  day: Day,
  monthKey: string,
  week: number,
  map: BlockMap,
): boolean {
  return sessionProgress(day, monthKey, week, map).state === "completed";
}

/** Set of day ids whose every block is completed, across the whole planning. */
export function completedSessionIds(
  planning: Planning | null | undefined,
  results: WorkoutResult[],
): Set<string> {
  const map = completedBlockMap(results);
  const out = new Set<string>();
  if (!planning) return out;
  for (const m of planning.months)
    for (const w of m.weeks)
      for (const d of w.days) {
        if (d.isRest) continue;
        if (isSessionCompleted(d, m.key, w.index, map)) out.add(dayId(m.key, w.index, d.key));
      }
  return out;
}

export function planningCompletion(
  planning: Planning | null | undefined,
  results: WorkoutResult[],
): { completed: number; total: number; pct: number } {
  const done = completedSessionIds(planning, results).size;
  let total = 0;
  if (planning)
    for (const m of planning.months)
      for (const w of m.weeks)
        for (const d of w.days) if (!d.isRest) total++;
  return { completed: done, total, pct: total ? Math.min(100, Math.round((done / total) * 100)) : 0 };
}
