import {
  usePersonalRecords,
  useUpsertPersonalRecord,
  useUpdatePersonalRecord,
  useDeletePersonalRecord,
  usePlanning,
  useAllResults,
  useAllPersonalRecordHistory,
  type PersonalRecord,
} from "@/lib/store";
import { blockContentIndex, historyFor, sessionsFor, trendFor } from "@/lib/progression-chart";
import { ProgressionView, TrendSpark } from "./ProgressionView";
import { Trophy, Search, ChevronRight } from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { toast } from "sonner";
import { PrCelebration, type PrCelebrationData } from "@/components/PrCelebration";
import { formatKg, normalizeExerciseName, sameExercise } from "@/lib/rm-matcher";
import { MovementDictionaryLink } from "@/components/MovementDictionaryLink";
import { resolveMovement, resolveMovementId } from "@/lib/dictionary/resolve";
import { ProgressionRecommendations } from "./progression";
import { PageSkeleton } from "@/components/PageSkeleton";

export const REP_MAXES = [1, 3, 5, 10] as const;

/** Agrupa variantes del mismo movimiento (p. ej. «back squat» y «Back Squat»). */
function groupKey(exercise: string): string {
  return resolveMovementId(exercise) ?? normalizeExerciseName(exercise);
}

export const TABS: { label: string; value: number | "all" }[] = [
  { label: "1RM", value: 1 },
  { label: "3RM", value: 3 },
  { label: "5RM", value: 5 },
  { label: "10RM", value: 10 },
  { label: "MAX", value: "all" },
];

export const SUGGESTED = [
  "Back Squat",
  "Front Squat",
  "Overhead Squat",
  "Box Squat",
  "Deadlift",
  "Sumo Deadlift",
  "Romanian Deadlift",
  "Clean",
  "Power Clean",
  "Hang Clean",
  "Hang Power Clean",
  "Squat Clean",
  "Clean & Jerk",
  "Jerk",
  "Split Jerk",
  "Push Jerk",
  "Snatch",
  "Power Snatch",
  "Hang Snatch",
  "Hang Power Snatch",
  "Squat Snatch",
  "Muscle Snatch",
  "Push Press",
  "Strict Press",
  "Bench Press",
  "Close Grip Bench Press",
  "Thruster",
  "Weighted Pull-up",
  "Weighted Dip",
  "Good Morning",
  "Hip Thrust",
  "Barbell Row",
  "Pendlay Row",
  "Turkish Get-up",
];

export function StrengthRecords({
  focusExercise,
  focusRepMax,
  clearFocus,
  showAdd,
  setShowAdd,
  viewExercise,
  openView,
  closeView,
}: {
  focusExercise?: string;
  focusRepMax?: number;
  clearFocus: () => void;
  viewExercise?: string;
  openView: (exercise: string) => void;
  closeView: () => void;
  showAdd: boolean;
  setShowAdd: (v: boolean | ((prev: boolean) => boolean)) => void;
}) {
  const { data: records = [], isLoading } = usePersonalRecords();
  const { data: planning } = usePlanning();
  const { data: results = [] } = useAllResults();
  const upsert = useUpsertPersonalRecord();
  const update = useUpdatePersonalRecord();
  const del = useDeletePersonalRecord();

  const { data: allHistory = [] } = useAllPersonalRecordHistory();
  const [search, setSearch] = useState("");
  const [newExercise, setNewExercise] = useState("");
  const [newWeight, setNewWeight] = useState("");
  const [newRepMax, setNewRepMax] = useState<number>(1);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [celebrate, setCelebrate] = useState<PrCelebrationData | null>(null);

  useEffect(() => {
    if (!focusExercise || isLoading) return;
    const targetMovementId = resolveMovementId(focusExercise);
    const record = records.find((item) => {
      const matchesMovement = targetMovementId
        ? resolveMovementId(item.exercise) === targetMovementId
        : sameExercise(item.exercise, focusExercise);
      return matchesMovement && (item.rep_max ?? 1) === (focusRepMax ?? 1);
    });
    clearFocus();
    if (record) openView(record.exercise);
  }, [clearFocus, openView, focusExercise, focusRepMax, isLoading, records]);

  // Una fila por ejercicio: el 1RM (o el RM más bajo que haya) y el resto debajo.
  const groups = useMemo(() => {
    const byKey = new Map<string, PersonalRecord[]>();
    for (const r of records) {
      const key = groupKey(r.exercise);
      const list = byKey.get(key);
      if (list) list.push(r);
      else byKey.set(key, [r]);
    }
    const q = normalizeExerciseName(search);
    return [...byKey.entries()]
      .map(([key, list]) => {
        const sorted = [...list].sort((a, b) => (a.rep_max ?? 1) - (b.rep_max ?? 1));
        const primary = sorted[0];
        const latest = [...list].sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0];
        const others = [
          ...sorted.slice(1).map((r) => `${r.rep_max ?? 1}RM ${formatKg(Number(r.weight))}`),
          new Date(latest.updated_at).toLocaleDateString("es-ES", { day: "numeric", month: "short" }),
        ].join(" · ");
        return { key, name: primary.exercise, primary, records: sorted, others, hasDictionary: !!resolveMovement(primary.exercise) };
      })
      .filter((g) => !q || normalizeExerciseName(g.name).includes(q))
      .sort((a, b) => a.name.localeCompare(b.name, "es"));
  }, [records, search]);

  // Entrenos y tendencia de cada ejercicio (últimos 3 meses)
  const blocks = useMemo(() => blockContentIndex(planning?.data.months ?? []), [planning]);
  const progress = useMemo(() => {
    const map = new Map<string, { sessions: ReturnType<typeof sessionsFor>; trend: ReturnType<typeof trendFor>; spark: number[] }>();
    const start = Date.now() - 90 * 86400000;
    for (const g of groups) {
      const rm = g.primary.rep_max ?? 1;
      const sessions = sessionsFor(g.primary.exercise, results, blocks);
      const hist = historyFor(g.primary.exercise, rm, allHistory);
      const trend = trendFor(Number(g.primary.weight), hist, sessions, 90);
      const est = rm === 1 ? sessions.filter((x) => x.est != null && new Date(x.date).getTime() >= start).map((x) => x.est!) : [];
      const spark = est.length >= 2 ? est : hist.map((h) => Number(h.new_weight));
      map.set(g.key, { sessions, trend, spark });
    }
    return map;
  }, [groups, results, blocks, allHistory]);
  const summary = useMemo(() => {
    const start = Date.now() - 90 * 86400000;
    let up = 0, flat = 0;
    for (const v of progress.values()) {
      if (v.trend.kind === "up") up++;
      else if (v.trend.kind === "stable" || v.trend.kind === "down") flat++;
    }
    const prs = allHistory.filter((h) => new Date(h.changed_at).getTime() >= start && (h.previous_weight == null || Number(h.new_weight) > Number(h.previous_weight))).length;
    return { up, flat, prs };
  }, [progress, allHistory]);

  const existingNames = new Set(
    records.filter((r) => (r.rep_max ?? 1) === newRepMax).map((r) => normalizeExerciseName(r.exercise)),
  );
  const query = normalizeExerciseName(newExercise);
  const filteredSuggestions = SUGGESTED.filter((s) => {
    if (existingNames.has(normalizeExerciseName(s))) return false;
    if (!query) return true;
    return normalizeExerciseName(s).includes(query);
  }).slice(0, 8);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const ex = newExercise.trim();
    const w = Number(newWeight);
    if (!ex) return toast.error("Escribe el nombre del ejercicio");
    if (!Number.isFinite(w) || w <= 0) return toast.error("Peso inválido");
    if (ex.length > 60) return toast.error("Nombre demasiado largo");
    try {
      const prevRec = records.find(
        (r) => sameExercise(r.exercise, ex) && (r.rep_max ?? 1) === newRepMax,
      );
      await upsert.mutateAsync({ exercise: ex, weight: w, rep_max: newRepMax });
      if (!prevRec || w > Number(prevRec.weight)) {
        setCelebrate({
          exercise: ex,
          weight: w,
          delta: prevRec ? Math.round((w - Number(prevRec.weight)) * 100) / 100 : null,
          repMax: newRepMax,
        });
      }
      setNewExercise("");
      setNewWeight("");
      setShowAdd(false);
      toast.success(`${newRepMax}RM guardado`);
    } catch (err: any) {
      toast.error(err?.message ?? "Error al guardar");
    }
  }

  async function saveEdit(id: string, exercise: string, w: number): Promise<boolean> {
    const ex = exercise.trim();
    if (!ex) { toast.error("Nombre requerido"); return false; }
    if (!Number.isFinite(w) || w <= 0) { toast.error("Peso inválido"); return false; }
    try {
      const prevRec = records.find((r) => r.id === id);
      await update.mutateAsync({ id, exercise: ex, weight: w });
      if (prevRec && w > Number(prevRec.weight)) {
        setCelebrate({
          exercise: ex,
          weight: w,
          delta: Math.round((w - Number(prevRec.weight)) * 100) / 100,
          repMax: prevRec.rep_max ?? 1,
        });
      }
      if (prevRec && ex !== prevRec.exercise) openView(ex);
      toast.success("Actualizado");
      return true;
    } catch (err: any) {
      toast.error(err?.message ?? "Error");
      return false;
    }
  }

  async function handleDelete(r: PersonalRecord): Promise<boolean> {
    if (!window.confirm(`¿Eliminar el ${r.rep_max ?? 1}RM de "${r.exercise}"?`)) return false;
    try {
      await del.mutateAsync(r.id);
      toast.success("Eliminado");
      return true;
    } catch (err: any) {
      toast.error(err?.message ?? "Error");
      return false;
    }
  }

  const viewGroup = viewExercise ? groups.find((g) => g.key === groupKey(viewExercise)) ?? null : null;
  if (viewExercise && !isLoading) {
    if (!viewGroup) {
      return (
        <div className="py-10 text-center text-sm text-muted-foreground">
          No hay récords de «{viewExercise}».{" "}
          <button type="button" onClick={closeView} className="font-bold text-gold">Volver</button>
        </div>
      );
    }
    return (
      <>
        {celebrate && <PrCelebration data={celebrate} onClose={() => setCelebrate(null)} />}
        <ProgressionView
          key={viewGroup.key}
          records={viewGroup.records}
          allHistory={allHistory}
          sessions={progress.get(viewGroup.key)?.sessions ?? []}
          onBack={closeView}
          onSaveEdit={saveEdit}
          onDelete={handleDelete}
        />
      </>
    );
  }

  return (
    <>
      {celebrate && <PrCelebration data={celebrate} onClose={() => setCelebrate(null)} />}
      {showAdd && (
        <form onSubmit={handleAdd} className="glass-panel glass-refraction animate-fade mb-6 space-y-4 rounded-[28px] p-5">
          <div>
            <label className="text-[13px] text-muted-foreground">
              Tipo de RM
            </label>
            <div className="mt-2 flex gap-2">
              {REP_MAXES.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setNewRepMax(n)}
                  className={`min-h-11 flex-1 rounded-xl border px-2 text-sm font-semibold transition ${
                    newRepMax === n
                      ? "gold-gradient border-transparent"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  {n}RM
                </button>
              ))}
            </div>
          </div>

          <div className="relative">
            <label className="text-[13px] text-muted-foreground">
              Ejercicio
            </label>
            <input
              value={newExercise}
              onChange={(e) => {
                setNewExercise(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              placeholder="Escribe para buscar…"
              maxLength={60}
              autoComplete="off"
              className="mt-1.5 min-h-12 w-full rounded-[14px] border border-white/[0.14] bg-white/[0.06] px-3.5 text-base outline-none focus:border-[color:var(--gold)]/60"
            />
            {showSuggestions && filteredSuggestions.length > 0 && (
              <ul className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-border bg-surface shadow-lg">
                {filteredSuggestions.map((s) => (
                  <li key={s}>
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setNewExercise(s);
                        setShowSuggestions(false);
                      }}
                      className="block w-full px-3.5 py-2.5 text-left text-sm hover:bg-surface-2"
                    >
                      {s}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <label className="text-[13px] text-muted-foreground">
              Peso (kg)
            </label>
            <input
              type="number"
              inputMode="decimal"
              step="0.5"
              min="0"
              value={newWeight}
              onChange={(e) => setNewWeight(e.target.value)}
              placeholder="0"
              className="mt-1.5 min-h-12 w-full rounded-[14px] border border-white/[0.14] bg-white/[0.06] px-3.5 text-base outline-none focus:border-[color:var(--gold)]/60"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={upsert.isPending}
              className="pressable gold-gradient min-h-[50px] flex-1 rounded-[var(--r-md)] text-sm font-semibold"
            >
              Guardar
            </button>
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="rounded-2xl border border-border px-5 py-3 text-sm"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {!isLoading && records.length > 0 && (
        <ProgressionRecommendations records={records} planning={planning?.data} results={results} />
      )}

      {isLoading ? (
        <PageSkeleton label="Cargando récords" />
      ) : records.length === 0 ? (
        <div className="glass-panel rounded-[24px] p-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-border">
            <Trophy className="h-5 w-5" strokeWidth={1.5} />
          </div>
          <h2 className="text-lg font-semibold">Aún no tienes RM</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Añade tus máximos con «+ Añadir» para usarlos en el asistente de porcentajes.
          </p>
        </div>
      ) : (
        <>
          {(summary.up > 0 || summary.flat > 0 || summary.prs > 0) && (
            <div className="mb-3 rounded-[18px] border border-[color:var(--gold)]/30 bg-[color:var(--gold)]/[0.08] px-4 py-3.5">
              <p className="text-[13px] font-bold tracking-[0.12em] text-gold">ÚLTIMOS 3 MESES</p>
              <div className="mt-1.5 flex gap-5">
                <SummaryStat value={summary.up} label={summary.up === 1 ? "ejercicio subiendo" : "ejercicios subiendo"} />
                <SummaryStat value={summary.flat} label={summary.flat === 1 ? "estancado" : "estancados"} />
                <SummaryStat value={summary.prs} label={summary.prs === 1 ? "récord nuevo" : "récords nuevos"} />
              </div>
            </div>
          )}
          <label className="mb-3 flex min-h-12 items-center gap-2.5 rounded-[14px] border border-white/10 bg-white/[0.06] px-3.5 text-muted-foreground">
            <Search className="h-[18px] w-[18px] shrink-0" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar ejercicio"
              aria-label="Buscar ejercicio"
              className="min-w-0 flex-1 bg-transparent text-[15px] text-foreground outline-none placeholder:text-muted-foreground"
            />
          </label>

          {groups.length === 0 ? (
            <p className="px-1 py-6 text-center text-sm text-muted-foreground">Ningún ejercicio coincide con «{search}».</p>
          ) : (
            <ul className="rise rise-3 overflow-hidden rounded-[20px] border border-white/[0.09] bg-white/[0.045]">
              {groups.map((g) => {
                const pr = progress.get(g.key);
                const tone = pr?.trend.kind === "up" ? "text-[#8FD19E]" : pr?.trend.kind === "down" ? "text-red-300" : "text-muted-foreground";
                return (
                  <li key={g.key} className="border-b border-white/[0.07] last:border-b-0">
                    <button
                      type="button"
                      onClick={() => openView(g.name)}
                      className="flex min-h-[76px] w-full items-center gap-3 px-4 py-2.5 text-left active:bg-white/[0.04]"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-base font-bold">{g.name}</span>
                        <span className={`mt-0.5 block truncate text-[13px] font-semibold ${tone}`}>{pr?.trend.short ?? g.others}</span>
                      </span>
                      <TrendSpark values={pr?.spark ?? []} up={pr?.trend.kind === "up"} />
                      <span className="min-w-[60px] shrink-0 text-right">
                        <span className="block text-[30px] font-black leading-none tabular" style={{ fontFamily: "var(--font-editorial)" }}>{formatKg(Number(g.primary.weight))}</span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">kg · {g.primary.rep_max ?? 1}RM</span>
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="mt-3 px-1 text-[13px] text-muted-foreground">Toca un ejercicio para ver su gráfico de progresión.</p>
        </>
      )}
    </>
  );
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

function SummaryStat({ value, label }: { value: number; label: string }) {
  return (
    <span>
      <span className="block text-[34px] font-black leading-none tabular" style={{ fontFamily: "var(--font-editorial)" }}>{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </span>
  );
}
