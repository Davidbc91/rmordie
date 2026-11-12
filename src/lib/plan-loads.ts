/**
 * Lee TODAS las «@» de un bloque del plan, línea a línea:
 *  - porcentajes («@75%», «@ 70-75», «@80% 3RM», «@85% del RM de Front Squat»)
 *  - cargas fijas («@60kg»)
 *  - esfuerzo («@RPE 8», «@ RIR 2»)
 * y calcula el peso de cada una con el RM que toca (1RM, 3RM, 5RM…) del
 * ejercicio de esa línea. Si no tienes ese RM, lo estima a partir de otro.
 */
import { detectExercise, roundToIncrement } from "./rm-matcher";
import { resolveMovement } from "./dictionary/resolve";
import type { PersonalRecord } from "./store";

export type PlanLoad = {
  /** Texto de la línea del plan */
  line: string;
  /** Ejercicio al que se refiere (tu récord), si se reconoce */
  exercise: string | null;
  /** Qué RM pide el plan (1 por defecto) */
  repMax: number;
  /** Peso de ese RM (real o estimado) */
  rmWeight: number | null;
  /** true si el RM pedido no lo tienes y se ha estimado con otro */
  estimated: boolean;
  /** De qué RM se ha estimado */
  estimatedFrom: number | null;
  pcts: { pct: number; kg: number | null }[];
  fixedKg: number[];
  rpe: number[];
  rir: number[];
  sets: number | null;
  reps: number | null;
};

const NUM = String.raw`(\d{1,3}(?:[.,]\d+)?)`;

function num(raw: string | undefined): number | null {
  if (raw == null) return null;
  const n = Number(raw.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function sameMovement(a: string, b: string) {
  const ma = resolveMovement(a);
  const mb = resolveMovement(b);
  if (ma && mb) return ma.movementId === mb.movementId;
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  return norm(a) === norm(b);
}

/** Epley: nRM ↔ 1RM */
const toOneRm = (w: number, n: number) => (n <= 1 ? w : w * (1 + n / 30));
const fromOneRm = (oneRm: number, n: number) => (n <= 1 ? oneRm : oneRm / (1 + n / 30));

/** El RM n del ejercicio: el tuyo si existe; si no, estimado desde el más cercano. */
export function rmFor(
  exercise: string,
  n: number,
  records: PersonalRecord[],
): { weight: number; estimated: boolean; from: number | null } | null {
  const same = records.filter((r) => sameMovement(r.exercise, exercise) && Number(r.weight) > 0);
  if (!same.length) return null;
  const exact = same.find((r) => (r.rep_max ?? 1) === n);
  if (exact) return { weight: Number(exact.weight), estimated: false, from: null };
  // El más cercano en repeticiones (preferimos 1RM)
  const base = [...same].sort((a, b) => Math.abs((a.rep_max ?? 1) - n) - Math.abs((b.rep_max ?? 1) - n) || (a.rep_max ?? 1) - (b.rep_max ?? 1))[0];
  const one = toOneRm(Number(base.weight), base.rep_max ?? 1);
  return { weight: Math.round(fromOneRm(one, n) * 2) / 2, estimated: true, from: base.rep_max ?? 1 };
}

/** Qué RM nombra un trozo de texto: «3RM», «RM de 3», «3 RM», «1-RM». */
function repMaxIn(text: string): number | null {
  const m = text.match(/\b(\d{1,2})\s*-?\s*rm\b/i) ?? text.match(/\brm\s*(?:de\s*)?(\d{1,2})\b/i);
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 1 && n <= 20 ? n : null;
}

/** Ejercicio nombrado tras «del RM de …», «de tu … », «% de …» */
function referencedExercise(text: string, records: PersonalRecord[]): PersonalRecord | null {
  const m = text.match(/(?:\d\s*-?\s*rm|rm|%)\s*(?:del?|de tu|de la)\s+(?:rm\s+de\s+)?([a-záéíóúñ][a-záéíóúñ\s-]{2,40})/i);
  return m ? detectExercise(m[1], records) : null;
}

function splitLines(content: string): string[] {
  return content
    .split(/\n|;|\s\/\s|\s\+\s/)
    .map((l) => l.trim())
    .filter(Boolean);
}

export function parsePlanLoads(content: string, records: PersonalRecord[], fallback?: PersonalRecord | null): PlanLoad[] {
  const out: PlanLoad[] = [];
  let carry: PersonalRecord | null = fallback ?? null;
  let carryRm: number | null = null;

  for (const line of splitLines(content)) {
    const pcts: number[] = [];
    const fixedKg: number[] = [];
    const rpe: number[] = [];
    const rir: number[] = [];

    // RPE / RIR («@RPE8», «@ 8 RPE», «RIR 2»)
    for (const m of line.matchAll(/@?\s*rpe\s*(\d{1,2}(?:[.,]5)?)|@\s*(\d{1,2}(?:[.,]5)?)\s*rpe/gi)) {
      const v = num(m[1] ?? m[2]);
      if (v != null && v <= 10) rpe.push(v);
    }
    for (const m of line.matchAll(/@?\s*rir\s*(\d)|@\s*(\d)\s*rir/gi)) {
      const v = num(m[1] ?? m[2]);
      if (v != null) rir.push(v);
    }
    // Cargas fijas («@60kg», «@ 60 kg»)
    for (const m of line.matchAll(new RegExp(String.raw`@\s*${NUM}\s*(?:kg|kgs|k)\b`, "gi"))) {
      const v = num(m[1]);
      if (v != null) fixedKg.push(v);
    }
    // Porcentajes con «%» («75%», «70-75 %», «72,5%»)
    for (const m of line.matchAll(new RegExp(String.raw`${NUM}(?:\s*(?:-|–|a)\s*${NUM})?\s*%`, "g"))) {
      for (const v of [num(m[1]), num(m[2])]) if (v != null && v >= 30 && v <= 110) pcts.push(v);
    }
    // «@75», «@ 70-75», «@80/85» sin «%» (que no sea kg ni RPE)
    for (const m of line.matchAll(new RegExp(String.raw`@\s*${NUM}(?:\s*(?:-|–|\/|a)\s*${NUM})?(?!\s*(?:[.,]\d)?\s*(?:%|kg|kgs|lb|lbs|k\b|rpe|rir))`, "gi"))) {
      for (const v of [num(m[1]), num(m[2])]) if (v != null && v >= 30 && v <= 110) pcts.push(v);
    }
    // Varias «@» separadas por comas en la misma línea: «@70, 75, 80%»
    for (const m of line.matchAll(/@\s*((?:\d{2,3}(?:[.,]5)?\s*,\s*)+\d{2,3}(?:[.,]5)?)\s*%?/g)) {
      for (const part of m[1].split(",")) {
        const v = num(part.trim());
        if (v != null && v >= 30 && v <= 110) pcts.push(v);
      }
    }

    const lineExercise = referencedExercise(line, records) ?? detectExercise(line, records);
    if (lineExercise) carry = lineExercise;
    const lineRm = repMaxIn(line);
    if (lineExercise) carryRm = null;
    if (lineRm != null) carryRm = lineRm;

    const uniq = [...new Set(pcts)].sort((a, b) => a - b);
    if (!uniq.length && !fixedKg.length && !rpe.length && !rir.length) continue;

    const exercise = carry?.exercise ?? null;
    const repMax = lineRm ?? carryRm ?? 1;
    const rm = exercise ? rmFor(exercise, repMax, records) : null;
    const sr = line.match(/(?:^|[^\w])(\d{1,2})\s*[x×]\s*(\d{1,2})(?![\d%])/i);

    out.push({
      line,
      exercise,
      repMax,
      rmWeight: rm?.weight ?? null,
      estimated: !!rm?.estimated,
      estimatedFrom: rm?.from ?? null,
      pcts: uniq.map((pct) => ({ pct, kg: rm ? roundToIncrement((rm.weight * pct) / 100) : null })),
      fixedKg: [...new Set(fixedKg)],
      rpe: [...new Set(rpe)],
      rir: [...new Set(rir)],
      sets: sr ? Number(sr[1]) : null,
      reps: sr ? Number(sr[2]) : null,
    });
  }
  return out;
}
