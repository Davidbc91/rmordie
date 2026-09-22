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
  const re = /(\d{2,3}(?:\.\d+)?)\s*%/g;
  let m;
  while ((m = re.exec(content))) {
    const p = Number(m[1]);
    if (p >= 30 && p <= 110) out.push(p);
  }
  return Array.from(new Set(out));
}
