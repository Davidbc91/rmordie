import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import {
  usePersonalRecords,
  useUpsertPersonalRecord,
  useUpdatePersonalRecord,
  useDeletePersonalRecord,
  usePersonalRecordHistory,
  usePlanning,
  useAllResults,
  type PersonalRecord,
} from "@/lib/store";
import {
  Trophy,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  ChevronRight,
  ArrowRight,
} from "lucide-react";
import { useState, useMemo, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { PrCelebration, type PrCelebrationData } from "@/components/PrCelebration";
import { normalizeExerciseName, sameExercise, mentionsExercise, formatKg } from "@/lib/rm-matcher";
import { WodRecords } from "@/components/WodRecords";
import { MovementDictionaryLink } from "@/components/MovementDictionaryLink";
import { resolveMovement, resolveMovementId } from "@/lib/dictionary/resolve";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

type RecordsSearch = {
  tab?: "strength" | "wods";
  wod?: string;
  exercise?: string;
  repMax?: number;
};

export const Route = createFileRoute("/records")({
  validateSearch: (search: Record<string, unknown>): RecordsSearch => ({
    tab: search.tab === "wods" ? "wods" : "strength",
    wod: typeof search.wod === "string" ? search.wod : undefined,
    exercise: typeof search.exercise === "string" ? search.exercise : undefined,
    repMax: [1, 3, 5, 10].includes(Number(search.repMax)) ? Number(search.repMax) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Personal Records — RMORDIE" },
      {
        name: "description",
        content: "Consulta y edita tus RM (1RM, 3RM, 5RM, 10RM) con su evolución.",
      },
      { property: "og:title", content: "Personal Records — RM OR DIE" },
      { property: "og:description", content: "Tus récords máximos personales." },
    ],
  }),
  component: RecordsPage,
});

function RecordsPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const category = search.tab === "wods" ? "wods" : "strength";
  const clearFocus = useCallback(
    () =>
      navigate({
        search: (previous) => ({
          ...previous,
          exercise: undefined,
          repMax: undefined,
        }),
        replace: true,
      }),
    [navigate],
  );

  return (
    <AppShell>
      <div className="page-enter">
      <header className="rise rise-1 mb-7 glass-panel glass-refraction rounded-[28px] p-6">
        <div className="flex items-center gap-2">
          <span className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-gold" />
          <p className="cinematic-label">PERSONAL RECORDS</p>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Tu fuerza, evolución y próximos objetivos en un solo lugar.</p>
        <h1 className="cinematic-title mt-4 text-[3.4rem] leading-[.88]">
          {category === "wods" ? "WOD PRs" : "Mis RM"}
        </h1>
      </header>

      <div className="rise rise-2 glass-panel mb-5 flex gap-1 rounded-[20px] border-white/[.14] p-1.5">
        {([
          { label: "Fuerza", value: "strength" as const },
          { label: "WODs", value: "wods" as const },
        ]).map((c) => (
          <button
            key={c.value}
            onClick={() => navigate({ search: { tab: c.value }, replace: true })}
            className={`flex-1 rounded-xl px-3 py-2 text-xs font-semibold tracking-wide transition ${
              category === c.value
                ? "gold-gradient shadow-[0_10px_22px_-16px_rgba(200,179,138,0.36)]"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {category === "wods" ? (
        <WodRecords focusSlug={search.wod} />
      ) : (
        <StrengthRecords
          focusExercise={search.exercise}
          focusRepMax={search.repMax}
          clearFocus={clearFocus}
        />
      )}
      </div>
    </AppShell>
  );
}

const REP_MAXES = [1, 3, 5, 10] as const;
const TABS: { label: string; value: number | "all" }[] = [
  { label: "1RM", value: 1 },
  { label: "3RM", value: 3 },
  { label: "5RM", value: 5 },
  { label: "10RM", value: 10 },
  { label: "MAX", value: "all" },
];

const SUGGESTED = [
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

function LazyProgressionRecommendations({ records }: { records: PersonalRecord[] }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const run = () => {
      if (!cancelled) setReady(true);
    };

    if (typeof window === "undefined") return;
    const idle = "requestIdleCallback" in window
      ? window.requestIdleCallback(run, { timeout: 900 })
      : window.setTimeout(run, 250);

    return () => {
      cancelled = true;
      if ("cancelIdleCallback" in window && typeof idle === "number") {
        window.cancelIdleCallback(idle);
      } else {
        window.clearTimeout(idle);
      }
    };
  }, []);

  if (!ready) return null;
  return <ProgressionRecommendations records={records} />;
}

function ProgressionRecommendations({
  records,
  planning,
  results,
}: {
  records: PersonalRecord[];
  planning: import("@/lib/excel-parser").Planning | undefined;
  results: import("@/lib/store").WorkoutResult[];
}) {
  const recommendations = useMemo(() => {
    if (!planning) return [];
    const oneRms = records.filter((r) => (r.rep_max ?? 1) === 1).slice(0, 8);
    return oneRms.map((record) => {
      const movement = resolveMovement(record.exercise);
      const relevant: import("@/lib/store").WorkoutResult[] = [];
      if (movement) {
        for (const month of planning.months)
          for (const week of month.weeks)
            for (const day of week.days)
              for (const block of day.blocks) {
                if (!mentionsExercise(block.content, record.exercise)) continue;
                relevant.push(
                  ...results.filter(
                    (r) =>
                      r.status === "completed" &&
                      r.month_key === month.key &&
                      r.week === week.index &&
                      r.day_key === day.key &&
                      r.block_key === block.key,
                  ),
                );
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
  }, [planning, records, results]);

  if (!recommendations.length) return null;

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

function StrengthRecords({
  focusExercise,
  focusRepMax,
  clearFocus,
}: {
  focusExercise?: string;
  focusRepMax?: number;
  clearFocus: () => void;
}) {
  const { data: records = [], isLoading } = usePersonalRecords();
  const upsert = useUpsertPersonalRecord();
  const update = useUpdatePersonalRecord();
  const del = useDeletePersonalRecord();

  const [tab, setTab] = useState<number | "all">(1);
  const [showAdd, setShowAdd] = useState(false);
  const [newExercise, setNewExercise] = useState("");
  const [newWeight, setNewWeight] = useState("");
  const [newRepMax, setNewRepMax] = useState<number>(1);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editExercise, setEditExercise] = useState("");
  const [editWeight, setEditWeight] = useState("");
  const [detailFor, setDetailFor] = useState<PersonalRecord | null>(null);
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
    if (record) {
      setTab(focusRepMax ?? 1);
      setDetailFor(record);
    }
    clearFocus();
  }, [clearFocus, focusExercise, focusRepMax, isLoading, records]);

  const visible = useMemo(() => {
    const list = tab === "all" ? records : records.filter((r) => (r.rep_max ?? 1) === tab);
    return [...list].sort(
      (a, b) =>
        a.exercise.localeCompare(b.exercise) || (a.rep_max ?? 1) - (b.rep_max ?? 1),
    );
  }, [records, tab]);

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
      if (tab !== "all") setTab(newRepMax);
      toast.success(`${newRepMax}RM guardado`);
    } catch (err: any) {
      toast.error(err?.message ?? "Error al guardar");
    }
  }

  function startEdit(r: PersonalRecord) {
    setEditingId(r.id);
    setEditExercise(r.exercise);
    setEditWeight(String(r.weight));
  }

  async function saveEdit(id: string) {
    const ex = editExercise.trim();
    const w = Number(editWeight);
    if (!ex) return toast.error("Nombre requerido");
    if (!Number.isFinite(w) || w <= 0) return toast.error("Peso inválido");
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
      setEditingId(null);
      toast.success("Actualizado");
    } catch (err: any) {
      toast.error(err?.message ?? "Error");
    }
  }

  async function handleDelete(r: PersonalRecord) {
    if (!window.confirm(`¿Eliminar el ${r.rep_max ?? 1}RM de "${r.exercise}"?`)) return;
    try {
      await del.mutateAsync(r.id);
      toast.success("Eliminado");
    } catch (err: any) {
      toast.error(err?.message ?? "Error");
    }
  }

  return (
    <>
      {celebrate && <PrCelebration data={celebrate} onClose={() => setCelebrate(null)} />}
      <button
        onClick={() => setShowAdd((v) => !v)}
        className="pressable gold-gradient mb-4 flex min-h-[56px] w-full items-center justify-center gap-2 rounded-[var(--r-md)] px-4 text-sm font-bold tracking-wide"
      >
        <Plus className="h-4 w-4" /> Añadir RM
      </button>

      {/* Segmented rep-max control */}
      <div className="rise rise-2 cinematic-card-dark no-scrollbar mb-5 flex gap-1 overflow-x-auto rounded-2xl border border-white/[.08] p-1">
        {TABS.map((t) => {
          const active = tab === t.value;
          return (
            <button
              key={t.label}
              onClick={() => setTab(t.value)}
              className={`flex-1 whitespace-nowrap rounded-xl px-3 py-2 text-xs font-semibold tracking-wide transition ${
                active
                  ? "gold-gradient shadow-[0_10px_22px_-16px_rgba(216,180,107,0.8)]"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {showAdd && (
        <form onSubmit={handleAdd} className="glass-panel glass-refraction animate-fade mb-6 space-y-4 rounded-[28px] p-5">
          <div>
            <label className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Tipo de RM
            </label>
            <div className="mt-2 flex gap-2">
              {REP_MAXES.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setNewRepMax(n)}
                  className={`flex-1 rounded-xl border px-2 py-2 text-xs font-semibold transition ${
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
            <label className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
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
              className="mt-1.5 w-full rounded-xl border border-border bg-surface-2 px-3.5 py-2.5 text-sm outline-none focus:border-foreground/40"
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
            <label className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
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
              className="mt-1.5 w-full rounded-xl border border-border bg-surface-2 px-3.5 py-2.5 text-sm outline-none focus:border-foreground/40"
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
        <LazyProgressionRecommendations records={records} />
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : visible.length === 0 ? (
        <div className="glass-panel rounded-[28px] p-10 text-center">
          <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-border">
            <Trophy className="h-5 w-5" strokeWidth={1.5} />
          </div>
          <h2 className="text-lg font-semibold">
            {tab === "all" ? "Aún no tienes RM" : `Sin ${tab}RM registrados`}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Añade tus máximos para usarlos en el asistente de porcentajes.
          </p>
        </div>
      ) : (
        <ul className="rise rise-3 cinematic-card-strong divide-y divide-white/[.07] overflow-hidden rounded-[24px] p-0">
          {visible.map((r) => {
            const isEditing = editingId === r.id;
            const hasDictionaryMovement = !!resolveMovement(r.exercise);
            return (
              <li key={r.id} className="px-5 py-4 transition-colors hover:bg-white/[.025]">
                {isEditing ? (
                  <div className="space-y-2">
                    <input
                      value={editExercise}
                      onChange={(e) => setEditExercise(e.target.value)}
                      maxLength={60}
                      className="w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-foreground/40"
                    />
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.5"
                        min="0"
                        value={editWeight}
                        onChange={(e) => setEditWeight(e.target.value)}
                        className="flex-1 rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-foreground/40"
                      />
                      <span className="text-xs text-muted-foreground">kg</span>
                      <button
                        onClick={() => saveEdit(r.id)}
                        className="gold-gradient tap grid place-items-center rounded-[12px]"
                        aria-label="Guardar"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="rounded-lg border border-border p-2"
                        aria-label="Cancelar"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                        {hasDictionaryMovement ? (
                          <MovementDictionaryLink exerciseName={r.exercise}>
                            {r.exercise}
                          </MovementDictionaryLink>
                        ) : (
                          <button
                            onClick={() => setDetailFor(r)}
                            className="min-h-9 max-w-full truncate text-left"
                          >
                            {r.exercise}
                          </button>
                        )}
                      </div>
                      <button
                        onClick={() => setDetailFor(r)}
                        className="mt-1 flex w-full min-w-0 items-center gap-3 rounded-2xl p-1 text-left transition-colors hover:bg-white/[.02]"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline gap-1.5">
                            <span className="display-lg gold-text">{r.weight}</span>
                            <span className="text-xs text-muted-foreground">kg</span>
                            <span className="ml-1 rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold tracking-wide">
                              {r.rep_max ?? 1}RM
                            </span>
                          </div>
                          <div className="mt-1 text-[11px] text-muted-foreground">
                            {new Date(r.updated_at).toLocaleDateString(undefined, {
                              day: "numeric",
                              month: "long",
                              year: "numeric",
                            })}
                          </div>
                        </div>
                        <Sparkline exercise={r.exercise} repMax={r.rep_max ?? 1} />
                        <ChevronRight
                          className="h-4 w-4 shrink-0 text-muted-foreground"
                          strokeWidth={1.5}
                        />
                      </button>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button
                        onClick={() => startEdit(r)}
                        className="rounded-lg p-2 text-muted-foreground hover:text-foreground"
                        aria-label="Editar"
                      >
                        <Pencil className="h-4 w-4" strokeWidth={1.5} />
                      </button>
                      <button
                        onClick={() => handleDelete(r)}
                        className="rounded-lg p-2 text-muted-foreground hover:text-destructive"
                        aria-label="Eliminar"
                      >
                        <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {detailFor && (
        <HistoryModal record={detailFor} onClose={() => setDetailFor(null)} />
      )}
    </>
  );
}

function Sparkline({ exercise, repMax }: { exercise: string; repMax: number }) {
  const { data: history = [] } = usePersonalRecordHistory(exercise, repMax);
  const points = useMemo(() => {
    const sorted = [...history].sort(
      (a, b) => new Date(a.changed_at).getTime() - new Date(b.changed_at).getTime(),
    );
    return sorted.map((h) => Number(h.new_weight));
  }, [history]);

  if (points.length < 2) return <div className="h-8 w-16 shrink-0" />;

  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const w = 64;
  const h = 28;
  const d = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * (w - 4) + 2;
      const y = h - 3 - ((p - min) / span) * (h - 6);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg width={w} height={h} className="shrink-0" aria-hidden="true">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.85" />
    </svg>
  );
}

function HistoryModal({ record, onClose }: { record: PersonalRecord; onClose: () => void }) {
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

function EvolutionChart({
  history,
  estimated,
}: {
  history: { changed_at: string; new_weight: number }[];
  estimated: { changed_at: string; weight: number; reps: number; sourceWeight: number }[];
}) {
  const data = useMemo(() => {
    const points = [
      ...history.map((h) => ({ changed_at: h.changed_at, real: Number(h.new_weight), estimated: null as number | null, reps: null as number | null })),
      ...estimated.map((p) => ({ changed_at: p.changed_at, real: null as number | null, estimated: p.weight, reps: p.reps })),
    ];
    return points.sort((a, b) => new Date(a.changed_at).getTime() - new Date(b.changed_at).getTime()).map((p) => ({
      date: new Date(p.changed_at).toLocaleDateString(undefined, { day: "2-digit", month: "short" }),
      real: p.real,
      estimated: p.estimated,
      reps: p.reps,
    }));
  }, [history, estimated]);

  if (data.length < 2) return null;

  const weights = data.flatMap((d) => [d.real, d.estimated].filter((v): v is number => v != null));
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const pad = Math.max(2, (max - min) * 0.15);

  return (
    <div className="glass-quiet mb-5 rounded-[20px] border-white/[.11] bg-white/[.045] p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          Evolución
        </p>
        <p className="text-[11px] text-muted-foreground tabular">
          <span className="font-semibold text-foreground">{max} kg</span> máx · {min} kg mín
        </p>
      </div>
      <div className="h-40 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="date"
              stroke="var(--muted-foreground)"
              tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              domain={[Math.floor(min - pad), Math.ceil(max + pad)]}
              stroke="var(--muted-foreground)"
              tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
              tickLine={false}
              axisLine={false}
              width={40}
            />
            <Tooltip
              contentStyle={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                fontSize: 12,
                color: "var(--foreground)",
              }}
              labelStyle={{ color: "var(--muted-foreground)" }}
              formatter={(v: number) => [`${v} kg`, "Peso"]}
            />
            <Line
              type="monotone"
              dataKey="real"
              name="RM confirmado"
              stroke="var(--gold)"
              strokeWidth={2.5}
              dot={{ r: 3, fill: "var(--gold)", strokeWidth: 0 }}
              activeDot={{ r: 5 }}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="estimated"
              name="1RM estimado"
              stroke="var(--foreground)"
              strokeWidth={1.5}
              strokeDasharray="5 4"
              dot={{ r: 2, fill: "var(--foreground)", strokeWidth: 0 }}
              activeDot={{ r: 4 }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}