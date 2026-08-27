// Detección e identificación de WODs basados en tiempo / score.

export type WodType =
  | "for_time"
  | "amrap"
  | "emom"
  | "max_reps"
  | "max_distance"
  | "max_calories"
  | "unknown";

export type WodScale = "rx" | "scaled" | "custom";
export type WodStatus = "completed" | "cap";

export type WodInfo = {
  type: WodType;
  name: string;
  slug: string;
  timeCapSeconds: number | null;
  isBenchmark: boolean;
};

export const WOD_TYPE_LABEL: Record<WodType, string> = {
  for_time: "For Time",
  amrap: "AMRAP",
  emom: "EMOM",
  max_reps: "Max Reps",
  max_distance: "Max Distance",
  max_calories: "Max Calories",
  unknown: "Sin definir",
};

export const SCALE_LABEL: Record<WodScale, string> = {
  rx: "RX",
  scaled: "Scaled",
  custom: "Custom",
};

/** Benchmarks conocidos (girls / heroes / open). */
export const BENCHMARKS = [
  "Fran", "Grace", "Helen", "Diane", "Elizabeth", "Isabel", "Jackie", "Karen",
  "Linda", "Nancy", "Annie", "Barbara", "Chelsea", "Cindy", "Mary", "Angie",
  "Nicole", "Kelly", "Eva", "Amanda", "Nasty Girls", "Filthy Fifty", "Fight Gone Bad",
  "DT", "JT", "Murph", "Michael", "Randy", "Josh", "Daniel", "Jerry", "Nate",
  "Griff", "Hansen", "Holleyman", "Ryan", "Bert", "Badger", "Glen", "The Seven",
  "Christine", "Lynne", "Tabata This", "Open 21.1", "Open 22.1",
];

const STOPWORDS =
  /\b(for time|time cap|timecap|amrap|emom|e2mom|every|min|mins|minutos|rounds?|rondas?|wod|metcon|rx|scaled|cap)\b/gi;

export function slugifyWod(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseClock(raw: string): number | null {
  const m = raw.match(/(\d{1,3}):(\d{2})/);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  const n = raw.match(/(\d{1,3})\s*(?:'|min|minutos|minutes)/i);
  if (n) return Number(n[1]) * 60;
  return null;
}

/** Segundos a mm:ss */
export function fmtSeconds(sec?: number | null): string {
  if (sec == null || !Number.isFinite(sec)) return "—";
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/** "9:42" | "942"? -> segundos (solo mm:ss o número de segundos) */
export function parseClockInput(v: string): number | null {
  if (!v.trim()) return null;
  const parts = v.split(":").map((x) => Number(x.trim()));
  if (parts.length === 2 && parts.every((n) => Number.isFinite(n)))
    return parts[0] * 60 + parts[1];
  if (parts.length === 3 && parts.every((n) => Number.isFinite(n)))
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : null;
}

export function detectWodType(content: string): WodType {
  const t = content.toUpperCase();
  if (/\bAMRAP\b|AS MANY (ROUNDS|REPS)/.test(t)) return "amrap";
  if (/\bE(\d+)?MOM\b|EVERY \d+ (MIN|SEC)|CADA \d+ MIN/.test(t)) return "emom";
  if (/MAX (CAL|CALORIES|CALORÍAS|CALORIAS)/.test(t)) return "max_calories";
  if (/MAX (DIST|DISTANCE|METROS|METERS)/.test(t)) return "max_distance";
  if (/MAX (REPS|REPETICIONES)|MAX EFFORT REPS/.test(t)) return "max_reps";
  if (/FOR TIME|TIME CAP|TIME TRIAL|\bPOR TIEMPO\b|\bTIEMPO\b\s*:/.test(t)) return "for_time";
  return "unknown";
}

function detectBenchmark(content: string): string | null {
  const t = content.toLowerCase();
  let best: string | null = null;
  for (const b of BENCHMARKS) {
    const re = new RegExp(`(^|[^a-z0-9])${b.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`);
    if (re.test(t)) {
      if (!best || b.length > best.length) best = b;
    }
  }
  return best;
}

function deriveName(content: string, type: WodType): string {
  const lines = content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  for (const l of lines) {
    const cleaned = l
      .replace(/https?:\/\/\S+/g, "")
      .replace(STOPWORDS, "")
      .replace(/[:\-–—•*]+/g, " ")
      .replace(/\d{1,3}:\d{2}/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (cleaned.length >= 3) return titleCase(cleaned.slice(0, 42));
  }
  return WOD_TYPE_LABEL[type];
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(" ")
    .map((w) => (w.length > 2 ? w[0].toUpperCase() + w.slice(1) : w.toUpperCase()))
    .join(" ");
}

/**
 * Detecta si el contenido de un bloque es un WOD medible.
 * Devuelve null si no hay estructura de score reconocible.
 */
export function detectWod(content: string): WodInfo | null {
  if (!content || content.trim().length < 3) return null;
  const type = detectWodType(content);
  if (type === "unknown") return null;

  const benchmark = detectBenchmark(content);
  const name = benchmark ?? deriveName(content, type);

  const capLine = content
    .split(/\r?\n/)
    .find((l) => /time\s*cap|cap\s*:/i.test(l));
  const timeCapSeconds = capLine ? parseClock(capLine) : null;

  return {
    type,
    name,
    slug: slugifyWod(`${name}-${benchmark ? "bm" : type}`),
    timeCapSeconds,
    isBenchmark: !!benchmark,
  };
}

export type WodScoreLike = {
  wod_type: WodType | string;
  status: string;
  time_seconds: number | null;
  rounds: number | null;
  reps: number | null;
  distance: number | null;
  calories: number | null;
};

/** Valor numérico comparable del resultado; null si no se puede determinar. */
export function scoreValue(r: WodScoreLike): number | null {
  const type = r.wod_type as WodType;
  if (r.status !== "completed") return null;
  switch (type) {
    case "for_time":
      return r.time_seconds ?? null;
    case "amrap":
    case "emom": {
      if (r.rounds == null && r.reps == null) return null;
      return (Number(r.rounds ?? 0) * 1000) + Number(r.reps ?? 0);
    }
    case "max_reps":
      return r.reps ?? null;
    case "max_distance":
      return r.distance ?? null;
    case "max_calories":
      return r.calories ?? null;
    default:
      return null;
  }
}

/** true si menor valor es mejor (for time). */
export function lowerIsBetter(type: WodType | string): boolean {
  return type === "for_time";
}

/** Compara dos resultados: >0 si `a` es mejor que `b`. null si no comparable. */
export function compareScores(
  type: WodType | string,
  a: WodScoreLike,
  b: WodScoreLike,
): number | null {
  const va = scoreValue(a);
  const vb = scoreValue(b);
  if (va == null || vb == null) return null;
  return lowerIsBetter(type) ? vb - va : va - vb;
}

/** Texto del score, ej "09:42", "8 rondas + 12 reps", "312 cal". */
export function formatScore(r: WodScoreLike): string {
  const type = r.wod_type as WodType;
  if (r.status === "cap") {
    const partial =
      r.rounds != null || r.reps != null
        ? `${r.rounds ?? 0} rondas${r.reps ? ` + ${r.reps} reps` : ""}`
        : r.time_seconds != null
          ? fmtSeconds(r.time_seconds)
          : "";
    return partial ? `CAP · ${partial}` : "CAP";
  }
  switch (type) {
    case "for_time":
      return fmtSeconds(r.time_seconds);
    case "amrap":
    case "emom":
      return `${r.rounds ?? 0} rondas${r.reps ? ` + ${r.reps} reps` : ""}`;
    case "max_reps":
      return `${r.reps ?? 0} reps`;
    case "max_distance":
      return `${r.distance ?? 0} m`;
    case "max_calories":
      return `${r.calories ?? 0} cal`;
    default:
      return "—";
  }
}

/** Diferencia legible entre nuevo y anterior mejor. */
export function formatDelta(
  type: WodType | string,
  current: WodScoreLike,
  previous: WodScoreLike,
): string | null {
  const va = scoreValue(current);
  const vb = scoreValue(previous);
  if (va == null || vb == null) return null;
  if (lowerIsBetter(type)) {
    const d = Math.round(vb - va);
    if (d === 0) return null;
    return `${d > 0 ? "-" : "+"}${Math.abs(d) >= 60 ? fmtSeconds(Math.abs(d)) : `${Math.abs(d)} seg`}`;
  }
  const isRounds = type === "amrap" || type === "emom";
  const d = va - vb;
  if (d === 0) return null;
  if (isRounds) {
    const rounds = Math.trunc(Math.abs(d) / 1000);
    const reps = Math.abs(d) % 1000;
    const parts = [rounds ? `${rounds} rondas` : "", reps ? `${reps} reps` : ""].filter(Boolean);
    return `${d > 0 ? "+" : "-"}${parts.join(" + ")}`;
  }
  return `${d > 0 ? "+" : ""}${Math.round(d * 100) / 100}`;
}
