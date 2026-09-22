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
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { PrCelebration, type PrCelebrationData } from "@/components/PrCelebration";
import { normalizeExerciseName, sameExercise, mentionsExercise, formatKg } from "@/lib/rm-matcher";
import { WodRecords } from "@/components/WodRecords";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

type RecordsSearch = { tab?: "strength" | "wods"; wod?: string };

export const Route = createFileRoute("/records")({
  validateSearch: (search: Record<string, unknown>): RecordsSearch => ({
    tab: search.tab === "wods" ? "wods" : "strength",
    wod: typeof search.wod === "string" ? search.wod : undefined,
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

  return (
    <AppShell>
      <header className="rise rise-1 mb-5">
        <p className="text-[11px] uppercase tracking-[0.28em] text-muted-foreground">
          Personal Records
        </p>
        <h1 className="mt-2 text-[32px] font-semibold leading-none tracking-tight">
          {category === "wods" ? "WOD PRs" : "Mis RM"}
        </h1>
      </header>

      <div className="rise rise-2 glass glass-sheen mb-5 flex gap-1 p-1">
        {([
          { label: "Fuerza", value: "strength" as const },
          { label: "WODs", value: "wods" as const },
        ]).map((c) => (
          <button
            key={c.value}
            onClick={() => navigate({ search: { tab: c.value }, replace: true })}
            className={`flex-1 rounded-xl px-3 py-2 text-xs font-semibold tracking-wide transition ${
              category === c.value
                ? "gold-gradient shadow-[0_10px_22px_-16px_rgba(216,180,107,0.8)]"
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
        <StrengthRecords />
      )}
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

function StrengthRecords() {
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
        className="pressable gold-gradient mb-4 flex min-h-[50px] w-full items-center justify-center gap-2 rounded-[var(--r-md)] px-4 text-sm font-semibold"
      >
        <Plus className="h-4 w-4" /> Añadir RM
      </button>

      {/* Segmented rep-max control */}
      <div className="rise rise-2 glass glass-sheen no-scrollbar mb-5 flex gap-1 overflow-x-auto p-1">
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
        <form onSubmit={handleAdd} className="card-elevated animate-fade mb-6 space-y-4 p-5">
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

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : visible.length === 0 ? (
        <div className="card-elevated p-10 text-center">
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
        <ul className="rise rise-3 card-elevated divide-y divide-border overflow-hidden p-0">
          {visible.map((r) => {
            const isEditing = editingId === r.id;
            return (
              <li key={r.id} className="px-5 py-4">
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
                    <button
                      onClick={() => setDetailFor(r)}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                          {r.exercise}
                        </div>
                        <div className="mt-1 flex items-baseline gap-1.5">
                          <span className="metric gold-text">
                            {r.weight}
                          </span>
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

  const bestEver = useMemo(() => {
    const weights = [Number(record.weight), ...history.map((h) => Number(h.new_weight))];
    return Math.max(...weights);
  }, [record.weight, history]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 pb-[calc(72px+env(safe-area-inset-bottom))] sm:items-center sm:pb-0"
      onClick={onClose}
    >
      <div
        className="card-elevated animate-fade max-h-[calc(100dvh-72px-env(safe-area-inset-bottom)-16px)] w-full max-w-md overflow-x-hidden overflow-y-auto overscroll-contain rounded-b-none p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] [-webkit-overflow-scrolling:touch] sm:max-h-[88dvh] sm:rounded-b-3xl sm:pb-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
              {repMax}RM · Evolución
            </p>
            <h2 className="mt-1.5 truncate text-xl font-semibold tracking-tight">
              {record.exercise}
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

        <div className="mb-5 grid grid-cols-2 gap-2.5">
          <div className="rounded-2xl border border-border p-3.5">
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">RM actual</p>
            <p className="mt-1.5 text-lg font-semibold tabular text-[var(--gold)]">
              {formatKg(Number(record.weight))} kg
            </p>
          </div>
          <div className="rounded-2xl border border-border p-3.5">
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Mejor marca</p>
            <p className="mt-1.5 text-lg font-semibold tabular">{formatKg(bestEver)} kg</p>
          </div>
          <div className="rounded-2xl border border-border p-3.5">
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Última carga</p>
            <p className="mt-1.5 text-lg font-semibold tabular">
              {lastLoad ? `${formatKg(Number(lastLoad.weight))} kg` : "—"}
            </p>
          </div>
          <div className="rounded-2xl border border-border p-3.5">
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Veces realizado</p>
            <p className="mt-1.5 text-lg font-semibold tabular">{performed.length}</p>
          </div>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : history.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin cambios registrados todavía.</p>
        ) : (
          <>
            {history.length >= 2 && <EvolutionChart history={history} />}
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
}: {
  history: { changed_at: string; new_weight: number }[];
}) {
  const data = useMemo(() => {
    return [...history]
      .sort(
        (a, b) => new Date(a.changed_at).getTime() - new Date(b.changed_at).getTime(),
      )
      .map((h) => ({
        date: new Date(h.changed_at).toLocaleDateString(undefined, {
          day: "2-digit",
          month: "short",
        }),
        weight: Number(h.new_weight),
      }));
  }, [history]);

  if (data.length < 2) return null;

  const weights = data.map((d) => d.weight);
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const pad = Math.max(2, (max - min) * 0.15);

  return (
    <div className="mb-5 rounded-2xl border border-border p-4">
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
              dataKey="weight"
              stroke="var(--gold)"
              strokeWidth={2}
              dot={{ r: 2.5, fill: "var(--gold)", strokeWidth: 0 }}
              activeDot={{ r: 4.5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
