import { type PersonalRecord } from "@/lib/store";
import { useState, useEffect } from "react";
import { formatKg } from "@/lib/rm-matcher";
import { resolveMovement, resolveMovements } from "@/lib/dictionary/resolve";

export type ProgressionRecommendation = {
  exercise: string;
  text: string;
  tone: "neutral" | "up" | "attention";
  avgRpe: number | null;
  latest: import("@/lib/store").WorkoutResult;
  gapPct: number;
};

/**
 * Cálculo pesado: se ejecuta diferido (requestIdleCallback) para no bloquear
 * el primer render de la lista de RM. Los resultados se indexan una sola vez
 * por bloque y el diccionario se resuelve una sola vez por bloque.
 */
export function computeProgressionRecommendations(
  records: PersonalRecord[],
  planning: import("@/lib/excel-parser").Planning | undefined,
  results: import("@/lib/store").WorkoutResult[],
): ProgressionRecommendation[] {
  if (!planning) return [];

  // Índice de resultados por bloque: "month|week|day|block" → resultados completados.
  const resultsByBlock = new Map<string, import("@/lib/store").WorkoutResult[]>();
  for (const r of results) {
    if (r.status !== "completed") continue;
    const key = `${r.month_key}|${r.week}|${r.day_key}|${r.block_key}`;
    const list = resultsByBlock.get(key);
    if (list) list.push(r);
    else resultsByBlock.set(key, [r]);
  }

  // Diccionario resuelto una sola vez por bloque.
  type IndexedBlock = { resultKey: string; movementIds: Set<string> };
  const blocks: IndexedBlock[] = [];
  for (const month of planning.months)
    for (const week of month.weeks)
      for (const day of week.days)
        for (const block of day.blocks) {
          blocks.push({
            resultKey: `${month.key}|${week.index}|${day.key}|${block.key}`,
            movementIds: new Set(resolveMovements(block.content).map((m) => m.movementId)),
          });
        }

  const oneRms = records.filter((r) => (r.rep_max ?? 1) === 1).slice(0, 8);
  return oneRms.map((record) => {
    const movement = resolveMovement(record.exercise);
    const relevant: import("@/lib/store").WorkoutResult[] = [];
    if (movement) {
      for (const block of blocks) {
        if (!block.movementIds.has(movement.movementId)) continue;
        const blockResults = resultsByBlock.get(block.resultKey);
        if (blockResults) relevant.push(...blockResults);
      }
    }
    const recent = [...new Map(relevant.map((r) => [r.id, r])).values()]
      .filter((r) => r.weight != null && r.reps != null && r.weight! > 0 && r.reps! > 0)
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, 4);
    if (!recent.length) return null;
    const rpes = recent.map((r) => r.rpe).filter((x): x is number => x != null);
    const avgRpe = rpes.length ? rpes.reduce((a, b) => a + b, 0) / rpes.length : null;
    const latest = recent[0];
    const estimated = latest.weight! * (1 + Math.min(latest.reps!, 10) / 30);
    const gapPct = ((estimated - Number(record.weight)) / Number(record.weight)) * 100;

    let text = "Mantén la carga y consolida la técnica.";
    let tone: "neutral" | "up" | "attention" = "neutral";
    if (avgRpe != null && avgRpe <= 7.5) {
      text = "Hay margen según el RPE reciente. Valora subir 2,5 kg.";
      tone = "up";
    } else if (avgRpe != null && avgRpe >= 9) {
      text = "La carga reciente ha sido exigente. Mantén la carga antes de subir.";
      tone = "attention";
    } else if (gapPct >= 2.5) {
      text = "Tu 1RM estimado reciente supera tu RM confirmado.";
      tone = "up";
    }
    return { exercise: record.exercise, text, tone, avgRpe, latest, gapPct };
  }).filter((x): x is NonNullable<typeof x> => x !== null).slice(0, 3);
}

export function ProgressionRecommendations({
  records,
  planning,
  results,
}: {
  records: PersonalRecord[];
  planning: import("@/lib/excel-parser").Planning | undefined;
  results: import("@/lib/store").WorkoutResult[];
}) {
  const [recommendations, setRecommendations] = useState<ProgressionRecommendation[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    const compute = () => {
      if (cancelled) return;
      setRecommendations(computeProgressionRecommendations(records, planning, results));
    };
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(compute, { timeout: 1500 });
      return () => {
        cancelled = true;
        w.cancelIdleCallback?.(id);
      };
    }
    const id = window.setTimeout(compute, 50);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [planning, records, results]);

  if (!recommendations?.length) return null;

  return (
    <section className="rise rise-2 glass-panel glass-refraction mb-5 rounded-[28px] p-5">
      <p className="cinematic-label">LOAD STRATEGY</p>
      <h2 className="mt-2 text-xl font-semibold tracking-tight">Sugerencias según tu historial</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Basadas en las últimas sesiones registradas, RPE y RM confirmado.
      </p>
      <div className="mt-4 space-y-2">
        {recommendations.map((item) => (
          <div key={item.exercise} className="glass-quiet p-3.5">
            <div className="flex items-center justify-between gap-3">
              <span className="min-w-0 truncate text-sm font-semibold">{item.exercise}</span>
              {item.avgRpe != null && (
                <span className="shrink-0 text-[11px] font-semibold text-gold">RPE {item.avgRpe.toFixed(1)}</span>
              )}
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{item.text}</p>
            <p className="mt-2 text-[10px] text-muted-foreground">
              Última sesión: {formatKg(Number(item.latest.weight))} kg × {item.latest.reps} reps
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
