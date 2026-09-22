import type { PersonalRecord } from "./store";

/**
 * Automatic load calculation from existing personal records.
 * Pure read-only helpers: they never write data.
 */

// Normalize for robust matching: case, extra spaces and punctuation insensitive.
export function normalizeExerciseName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Detect which recorded exercise a planning block refers to.
 * Matches the block text against the exercise names that exist in
 * personal_records; the longest matching name wins ("Squat Clean" beats "Clean").
 */
export function detectExercise(content: string, records: PersonalRecord[]): PersonalRecord | null {
  const text = ` ${normalizeExerciseName(content)} `;
  const sorted = [...records].sort(
    (a, b) => normalizeExerciseName(b.exercise).length - normalizeExerciseName(a.exercise).length,
  );
  for (const r of sorted) {
    const name = normalizeExerciseName(r.exercise);
    if (!name) continue;
    if (text.includes(` ${name} `) || text.includes(` ${name}`)) return r;
  }
  return null;
}

// Round to a sensible loadable increment: 2.5 kg steps, half rounds up.
export function roundToIncrement(target: number, step = 2.5): number {
  if (!Number.isFinite(target) || target <= 0) return 0;
  return Math.round(target / step) * step;
}

export type LoadSuggestion = {
  pct: number;
  exact: number;
  suggested: number;
};

export function loadsForPercentages(rm: number, percentages: number[]): LoadSuggestion[] {
  return percentages.map((pct) => {
    const exact = (rm * pct) / 100;
    return { pct, exact, suggested: roundToIncrement(exact) };
  });
}

export function formatKg(n: number): string {
  return n % 1 === 0 ? String(n) : n.toFixed(1);
}
