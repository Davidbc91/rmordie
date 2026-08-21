export type ActiveWorkout = {
  month: string;
  week: number;
  day: string;
  label: string;
  ts: number;
};

const KEY = "rmordie:active-workout";
const MAX_AGE = 1000 * 60 * 60 * 12; // 12h

export function setActiveWorkout(w: Omit<ActiveWorkout, "ts">) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...w, ts: Date.now() }));
    window.dispatchEvent(new Event("rmordie:active-workout"));
  } catch { /* ignore */ }
}

export function getActiveWorkout(): ActiveWorkout | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const w = JSON.parse(raw) as ActiveWorkout;
    if (!w?.month || !w?.day || Date.now() - (w.ts ?? 0) > MAX_AGE) return null;
    return w;
  } catch {
    return null;
  }
}

export function clearActiveWorkout() {
  try {
    localStorage.removeItem(KEY);
    window.dispatchEvent(new Event("rmordie:active-workout"));
  } catch { /* ignore */ }
}

// --- Borradores de bloques (valores no guardados) ---
const draftKey = (m: string, w: number, d: string, block: string) =>
  `rmordie:draft:${m}:${w}:${d}:${block}`;

export function loadDraft<T>(m: string, w: number, d: string, block: string): T | null {
  try {
    const raw = localStorage.getItem(draftKey(m, w, d, block));
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function saveDraft(m: string, w: number, d: string, block: string, value: unknown) {
  try {
    localStorage.setItem(draftKey(m, w, d, block), JSON.stringify(value));
  } catch { /* ignore */ }
}

export function clearDraft(m: string, w: number, d: string, block: string) {
  try {
    localStorage.removeItem(draftKey(m, w, d, block));
  } catch { /* ignore */ }
}
