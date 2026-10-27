// Round a target weight to what is actually loadable given bar + plate inventory.
// Plates are added in pairs (one per side). Returns the closest achievable weight.

export type PlateConfig = {
  bars: number[];    // available bar weights (kg)
  plates: number[];  // available plate weights per side (kg), each usable in pairs
};

const DEFAULT: PlateConfig = {
  bars: [10, 15, 20],
  plates: [20, 15, 10, 5, 2.5, 1.25],
};

export function roundToPlates(target: number, cfg: PlateConfig = DEFAULT): number {
  if (!Number.isFinite(target) || target <= 0) return 0;
  const bars = [...cfg.bars].sort((a, b) => b - a);
  const plates = [...cfg.plates].sort((a, b) => b - a);

  let best = 0;
  let bestDiff = Infinity;

  for (const bar of bars) {
    if (bar > target + 0.01) continue;
    // Greedy: add pairs while below target
    let w = bar;
    // Try both "greedy under" and "greedy over" candidates
    for (const plate of plates) {
      while (w + plate * 2 <= target + 0.001) {
        w += plate * 2;
      }
    }
    // candidate 1: greedy under
    const under = w;
    // candidate 2: try one extra smallest pair to go slightly over
    const smallest = plates[plates.length - 1] ?? 0;
    const over = under + (smallest ? smallest * 2 : 0);

    for (const c of [under, over]) {
      const d = Math.abs(c - target);
      if (d < bestDiff - 0.0001) {
        bestDiff = d;
        best = c;
      }
    }
    // Also consider bare bar
    const d = Math.abs(bar - target);
    if (d < bestDiff - 0.0001) { bestDiff = d; best = bar; }
  }
  return Math.round(best * 100) / 100;
}

// Extract percentages from a workout content string, e.g. "5x5 @ 75%" -> [75]
// Supports decimals like "82.5%".
export function extractPercentages(content: string): number[] {
  const out: number[] = [];
  const add = (raw: string | undefined) => {
    if (!raw) return;
    const p = Number(raw.replace(",", "."));
    if (p >= 30 && p <= 110) out.push(p);
  };
  // «70%», «72,5 %»
  const pct = /(\d{2,3}(?:[.,]\d+)?)\s*%/g;
  let m: RegExpExecArray | null;
  while ((m = pct.exec(content))) add(m[1]);
  // En la planificación «@» también es porcentaje del RM: «5x3 @75», «@ 70-75».
  // No cuenta si es una carga («@60kg») ni un RPE/RIR («@RPE8»).
  const at = /@\s*(\d{2,3}(?:[.,]\d+)?)(?:\s*(?:-|–|\/|a)\s*(\d{2,3}(?:[.,]\d+)?))?(?!\s*(?:[.,]\d)?\s*(?:kg|kgs|lb|lbs|k\b))/gi;
  while ((m = at.exec(content))) {
    add(m[1]);
    add(m[2]);
  }
  return Array.from(new Set(out));
}

/**
 * Qué discos poner en cada lado para llegar a un peso total.
 * Usa la barra de 20 si la tienes y cabe; si no, la mayor que quepa.
 * `rest` es lo que falta para llegar (0 si cuadra justo).
 */
export function platesPerSide(total: number, cfg: PlateConfig = DEFAULT): { bar: number; plates: number[]; rest: number } | null {
  if (!Number.isFinite(total) || total <= 0) return null;
  const bars = [...cfg.bars].sort((a, b) => b - a);
  const bar = bars.includes(20) && total >= 20 ? 20 : bars.find((b) => b <= total + 0.001);
  if (bar == null) return null;
  const plates = [...cfg.plates].sort((a, b) => b - a);
  let side = (total - bar) / 2;
  const used: number[] = [];
  for (const p of plates) {
    while (side + 0.001 >= p) {
      used.push(p);
      side -= p;
    }
  }
  return { bar, plates: used, rest: Math.round(side * 2 * 100) / 100 };
}

/** Series × reps del texto del plan («5x3», «5 × 3»). */
export function extractSetsReps(content: string): { sets: number; reps: number } | null {
  const m = content.match(/(?:^|[^\w])(\d{1,2})\s*[x×]\s*(\d{1,2})(?![\d%])/i);
  if (!m) return null;
  const sets = Number(m[1]);
  const reps = Number(m[2]);
  return sets > 0 && reps > 0 ? { sets, reps } : null;
}

/** Descanso del plan en segundos («Descanso 2:00», «rest 90"», «descansa 2'»). */
export function extractRestSeconds(content: string): number | null {
  const m = content.match(/(?:descanso|descansa|descansar|rest|recuperaci[oó]n)[^\n\d]{0,15}(\d{1,3})(?::(\d{2}))?\s*('{2}|"|''|'|min\b|m\b|seg\b|s\b)?/i);
  if (!m) return null;
  const n = Number(m[1]);
  if (m[2] != null) return n * 60 + Number(m[2]);
  const unit = (m[3] ?? "").toLowerCase();
  if (unit === '"' || unit === "''" || unit === "seg" || unit === "s") return n;
  if (unit === "'" || unit === "min" || unit === "m") return n * 60;
  return n <= 10 ? n * 60 : n;
}
