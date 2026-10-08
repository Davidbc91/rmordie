

export function suggestNextLoad(weight: number, rpe: number): { weight: number; reason: string } | null {
  if (!Number.isFinite(weight) || weight <= 0 || !Number.isFinite(rpe) || rpe < 1 || rpe > 10) return null;
  const step = rpe <= 7 ? 2.5 : rpe === 8 ? 1.25 : rpe === 9 ? 0 : -2.5;
  return { weight: Math.max(0, Math.round((weight + step) * 2) / 2), reason: rpe <= 7 ? "RPE bajo" : rpe === 8 ? "RPE controlado" : rpe === 9 ? "RPE alto" : "RPE máximo" };
}

export function estimateOneRm(weight: number, reps: number): number | null {
  if (!Number.isFinite(weight) || weight <= 0 || !Number.isInteger(reps) || reps < 2 || reps > 10) return null;
  // Epley: useful as an estimate, never treated as a confirmed 1RM.
  return Math.round((weight * (1 + reps / 30)) * 2) / 2;
}

export function parseTime(v: string): number | null {
  if (!v) return null;
  const parts = v.split(":").map((x) => Number(x));
  if (parts.length === 2 && parts.every((n) => !isNaN(n))) return parts[0] * 60 + parts[1];
  const n = Number(v);
  return isNaN(n) ? null : n;
}

export function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
