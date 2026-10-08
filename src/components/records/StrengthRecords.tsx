import {
  usePersonalRecords,
  useUpsertPersonalRecord,
  useUpdatePersonalRecord,
  useDeletePersonalRecord,
  usePlanning,
  useAllResults,
  type PersonalRecord,
} from "@/lib/store";
import { Trophy, Plus, Pencil, Trash2, Check, X, ChevronRight } from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { toast } from "sonner";
import { PrCelebration, type PrCelebrationData } from "@/components/PrCelebration";
import { normalizeExerciseName, sameExercise } from "@/lib/rm-matcher";
import { MovementDictionaryLink } from "@/components/MovementDictionaryLink";
import { resolveMovement, resolveMovementId } from "@/lib/dictionary/resolve";
import { ProgressionRecommendations } from "./progression";
import { Sparkline } from "./charts";
import { HistoryModal } from "./HistoryModal";
import { PageSkeleton } from "@/components/PageSkeleton";

export const REP_MAXES = [1, 3, 5, 10] as const;

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
}: {
  focusExercise?: string;
  focusRepMax?: number;
  clearFocus: () => void;
}) {
  const { data: records = [], isLoading } = usePersonalRecords();
  const { data: planning } = usePlanning();
  const { data: results = [] } = useAllResults();
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
        <ProgressionRecommendations records={records} planning={planning?.data} results={results} />
      )}

      {isLoading ? (
        <PageSkeleton label="Cargando récords" />
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
