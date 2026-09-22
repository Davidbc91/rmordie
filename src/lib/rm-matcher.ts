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
 * Internal identity for exercises: two names are the same exercise when their
 * normalized forms match ("Back Squat" == "BACK SQUAT" == " back squat ").
 * Use ONLY for comparing/identifying exercises — never for display.
 */
export function sameExercise(a: string, b: string): boolean {
  const na = normalizeExerciseName(a);
  const nb = normalizeExerciseName(b);
  return na !== "" && na === nb;
}

/**
 * Detect which recorded exercise a planning block refers to.
 * Matches the block text against the exercise names that exist in
 * personal_records; the longest matching name wins ("Squat Clean" beats "Clean").
 */
export function detectExercise(content: string, records: PersonalRecord[]): PersonalRecord | null {
  const norm = normalizeExerciseName(content);
  const text = ` ${norm} `;
  const compact = norm.replace(/\s+/g, "");
  const sorted = [...records].sort(
    (a, b) => normalizeExerciseName(b.exercise).length - normalizeExerciseName(a.exercise).length,
  );
  for (const r of sorted) {
    const name = normalizeExerciseName(r.exercise);
    if (!name) continue;
    // Word-boundary match, and a space-insensitive match ("Dead Lift" == "Deadlift").
    if (text.includes(` ${name} `) || compact.includes(name.replace(/\s+/g, ""))) return r;
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

export type LoadStatus = "met" | "above" | "below";

/**
 * Compare the load the athlete actually used against the calculated target.
 * Pure read-only: it never writes data and never recomputes the RM.
 */
export function compareLoads(actual: number, target: number): { status: LoadStatus; diff: number } | null {
  if (!Number.isFinite(actual) || !Number.isFinite(target) || actual <= 0 || target <= 0) return null;
  const diff = actual - target;
  const status: LoadStatus = Math.abs(diff) < 0.01 ? "met" : diff > 0 ? "above" : "below";
  return { status, diff };
}

export const LOAD_STATUS_LABEL: Record<LoadStatus, string> = {
  met: "CUMPLIDO ✓",
  above: "POR ENCIMA ↑",
  below: "POR DEBAJO ↓",
};

