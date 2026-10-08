import {
  usePersonalRecordHistory,
  usePlanning,
  useAllResults,
  type PersonalRecord,
} from "@/lib/store";
import { X, ArrowRight } from "lucide-react";
import { useMemo } from "react";
import { mentionsExercise, formatKg } from "@/lib/rm-matcher";
import { MovementDictionaryLink } from "@/components/MovementDictionaryLink";
import { EvolutionChart } from "./charts";

export function HistoryModal({ record, onClose }: { record: PersonalRecord; onClose: () => void }) {
  const repMax = record.rep_max ?? 1;
  const { data: history = [], isLoading } = usePersonalRecordHistory(record.exercise, repMax);
  const { data: planning } = usePlanning();
  const { data: results = [] } = useAllResults();

  // Loads actually performed for this exercise: workout results whose planning
  // block mentions the exercise (normalized comparison, casing/spacing safe).
  const performed = useMemo(() => {
    if (!planning) return [] as typeof results;
    const keys = new Set<string>();
    for (const m of planning.data.months)
      for (const w of m.weeks)
        for (const d of w.days)
          for (const b of d.blocks)
            if (mentionsExercise(b.content, record.exercise))
              keys.add(`${m.key}|${w.index}|${d.key}|${b.key}`);
    return results.filter((r) =>
      keys.has(`${r.month_key}|${r.week}|${r.day_key}|${r.block_key}`),
    );
  }, [planning, results, record.exercise]);

  const lastLoad = useMemo(() => {
    const withWeight = performed.filter((r) => r.weight != null && Number(r.weight) > 0);
    withWeight.sort(
      (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
    );
    return withWeight[0] ?? null;
  }, [performed]);

  const estimatedHistory = useMemo(() => performed
    .filter((r) => r.weight != null && r.reps != null && Number(r.weight) > 0 && Number(r.reps) >= 2 && Number(r.reps) <= 10)
    .map((r) => ({
      changed_at: r.updated_at,
      weight: Math.round((Number(r.weight) * (1 + Number(r.reps) / 30)) * 2) / 2,
      reps: Number(r.reps),
      sourceWeight: Number(r.weight),
    }))
    .sort((a, b) => new Date(a.changed_at).getTime() - new Date(b.changed_at).getTime()),
  [performed]);

  const bestEstimated = useMemo(() =>
    estimatedHistory.length ? Math.max(...estimatedHistory.map((p) => p.weight)) : null,
  [estimatedHistory]);

  const bestEver = useMemo(() => {
    const weights = [Number(record.weight), ...history.map((h) => Number(h.new_weight))];
    return Math.max(...weights);
  }, [record.weight, history]);

  const trend = useMemo(() => {
    const points = estimatedHistory.length
      ? estimatedHistory.map((p) => ({ date: p.changed_at, value: p.weight }))
      : history.map((h) => ({ date: h.changed_at, value: Number(h.new_weight) }));
    if (points.length < 2) return { kind: "unknown" as const, text: "Aún faltan datos para detectar una tendencia." };
    const recent = points.slice(-4);
    const first = recent[0].value;
    const last = recent[recent.length - 1].value;
    const pct = first > 0 ? ((last - first) / first) * 100 : 0;
    if (pct >= 2.5) return { kind: "up" as const, text: "Progresión reciente sostenida." };
    if (pct <= -2.5) return { kind: "down" as const, text: "Descenso reciente del rendimiento." };
    return { kind: "stable" as const, text: "Rendimiento estable en las últimas sesiones." };
  }, [estimatedHistory, history]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/85 pb-[calc(72px+env(safe-area-inset-bottom))] backdrop-blur-sm sm:items-center sm:pb-0"
      onClick={onClose}
    >
      <div
        className="glass-panel glass-refraction animate-fade max-h-[calc(100dvh-72px-env(safe-area-inset-bottom)-16px)] w-full max-w-md overflow-x-hidden overflow-y-auto overscroll-contain rounded-b-none p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] [-webkit-overflow-scrolling:touch] sm:max-h-[88dvh] sm:rounded-b-3xl sm:pb-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="cinematic-label">{repMax}RM · EVOLUTION</p>
            <h2 className="cinematic-title mt-3 truncate text-[2.25rem]">
              <MovementDictionaryLink exerciseName={record.exercise}>
                {record.exercise}
              </MovementDictionaryLink>
            </h2>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-full border border-border p-2 text-muted-foreground"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>

        <div className="glass-quiet mb-4 rounded-[20px] border-white/[.11] bg-white/[.045] p-4">
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Tendencia</p>
          <p className="mt-1.5 text-sm font-semibold">{trend.text}</p>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-2.5">
          <div className="glass-quiet rounded-[20px] border-white/[.10] bg-white/[.04] p-4">
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">RM actual</p>
            <p className="mt-1.5 text-3xl font-semibold tracking-tight tabular text-[var(--gold)]">
              {formatKg(Number(record.weight))} kg
            </p>
          </div>
          <div className="glass-quiet rounded-[20px] p-4">
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Mejor marca</p>
            <p className="mt-1.5 text-2xl font-semibold tracking-tight tabular">{formatKg(bestEver)} kg</p>
          </div>
          <div className="rounded-2xl border border-border p-3.5">
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">1RM estimado máx.</p>
            <p className="mt-1.5 text-2xl font-semibold tracking-tight tabular">{bestEstimated != null ? `${formatKg(bestEstimated)} kg` : "—"}</p>
          </div>
          <div className="rounded-2xl border border-border p-3.5">
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Última carga</p>
            <p className="mt-1.5 text-2xl font-semibold tracking-tight tabular">
              {lastLoad ? `${formatKg(Number(lastLoad.weight))} kg` : "—"}
            </p>
          </div>
          <div className="rounded-2xl border border-border p-3.5">
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Veces realizado</p>
            <p className="mt-1.5 text-2xl font-semibold tracking-tight tabular">{performed.length}</p>
          </div>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : history.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin cambios registrados todavía.</p>
        ) : (
          <>
            {history.length >= 2 || estimatedHistory.length >= 2 ? (
              <EvolutionChart history={history} estimated={estimatedHistory} />
            ) : null}
            <ul className="space-y-2">
              {history.map((h) => {
                const date = new Date(h.changed_at);
                const dateStr = date.toLocaleDateString(undefined, {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                });
                const timeStr = date.toLocaleTimeString(undefined, {
                  hour: "2-digit",
                  minute: "2-digit",
                });
                const diff = h.previous_weight != null ? h.new_weight - h.previous_weight : null;
                return (
                  <li key={h.id} className="rounded-2xl border border-border p-3.5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-[11px] text-muted-foreground">
                        {dateStr} · {timeStr}
                      </div>
                      {diff != null && diff !== 0 && (
                        <span className="text-xs font-medium tabular">
                          {diff > 0 ? "+" : ""}
                          {diff} kg
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-sm tabular">
                      {h.previous_weight != null ? (
                        <>
                          <span className="text-muted-foreground line-through">
                            {h.previous_weight} kg
                          </span>
                          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="font-semibold">{h.new_weight} kg</span>
                        </>
                      ) : (
                        <>
                          <span className="text-muted-foreground">Creación</span>
                          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="font-semibold">{h.new_weight} kg</span>
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
