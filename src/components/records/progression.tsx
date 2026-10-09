import { type PersonalRecord } from "@/lib/store";
import { useState, useEffect } from "react";
import { formatKg } from "@/lib/rm-matcher";
import { ChevronDown, TrendingUp } from "lucide-react";
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
  const [open, setOpen] = useState(false);

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
  const readyToClimb = recommendations.filter((r) => r.tone === "up").length;
  const summary = readyToClimb > 0
    ? `${readyToClimb} ${readyToClimb === 1 ? "ejercicio listo" : "ejercicios listos"} para subir`
    : `Sugerencias de carga · ${recommendations.length}`;

  return (
    <section className="rise rise-2 mb-3 overflow-hidden rounded-[16px] border border-[color:var(--gold)]/30 bg-[color:var(--gold)]/[0.09]">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-14 w-full items-center gap-3 px-4 text-left"
      >
        <TrendingUp className="h-[18px] w-[18px] shrink-0 text-gold" />
        <span className="flex-1 text-[15px]">{summary}</span>
        <ChevronDown className={`h-[18px] w-[18px] shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="space-y-2 px-4 pb-4">
          <p className="text-[13px] text-muted-foreground">Según tus últimas sesiones, el RPE y tu RM confirmado.</p>
          {recommendations.map((item) => (
            <div key={item.exercise} className="rounded-[14px] bg-black/25 p-3.5">
              <div className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate text-[15px] font-semibold">{item.exercise}</span>
                {item.avgRpe != null && (
                  <span className="shrink-0 text-[13px] font-semibold text-gold">RPE {item.avgRpe.toFixed(1)}</span>
                )}
              </div>
              <p className="mt-1.5 text-sm leading-relaxed text-foreground/85">{item.text}</p>
              <p className="mt-1.5 text-[13px] text-muted-foreground">
                Última sesión: {formatKg(Number(item.latest.weight))} kg × {item.latest.reps} reps
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
