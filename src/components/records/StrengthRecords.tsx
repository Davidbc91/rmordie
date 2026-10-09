import {
  usePersonalRecords,
  useUpsertPersonalRecord,
  useUpdatePersonalRecord,
  useDeletePersonalRecord,
  usePlanning,
  useAllResults,
  type PersonalRecord,
} from "@/lib/store";
import { Trophy, Pencil, Trash2, Check, X, Search } from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { toast } from "sonner";
import { PrCelebration, type PrCelebrationData } from "@/components/PrCelebration";
import { formatKg, normalizeExerciseName, sameExercise } from "@/lib/rm-matcher";
import { MovementDictionaryLink } from "@/components/MovementDictionaryLink";
import { resolveMovement, resolveMovementId } from "@/lib/dictionary/resolve";
import { ProgressionRecommendations } from "./progression";
import { Sparkline } from "./charts";
import { HistoryModal } from "./HistoryModal";
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
}: {
  focusExercise?: string;
  focusRepMax?: number;
  clearFocus: () => void;
  showAdd: boolean;
  setShowAdd: (v: boolean | ((prev: boolean) => boolean)) => void;
}) {
  const { data: records = [], isLoading } = usePersonalRecords();
  const { data: planning } = usePlanning();
  const { data: results = [] } = useAllResults();
  const upsert = useUpsertPersonalRecord();
  const update = useUpdatePersonalRecord();
  const del = useDeletePersonalRecord();

  const [search, setSearch] = useState("");
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
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
      setExpandedKey(groupKey(record.exercise));
      setDetailFor(record);
    }
    clearFocus();
  }, [clearFocus, focusExercise, focusRepMax, isLoading, records]);

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
                const expanded = expandedKey === g.key;
                return (
                  <li key={g.key} className="border-b border-white/[0.07] last:border-b-0">
                    <button
                      type="button"
                      aria-expanded={expanded}
                      onClick={() => setExpandedKey(expanded ? null : g.key)}
                      className="flex min-h-[76px] w-full items-center gap-3 px-4 py-2.5 text-left"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-base font-semibold">{g.name}</span>
                        <span className="mt-0.5 block truncate text-[13px] text-muted-foreground">{g.others}</span>
                      </span>
                      <Sparkline exercise={g.primary.exercise} repMax={g.primary.rep_max ?? 1} />
                      <span className="min-w-[64px] shrink-0 text-right">
                        <span className="metric block leading-none gold-text">{formatKg(Number(g.primary.weight))}</span>
                        <span className="mt-1 block text-xs text-muted-foreground">kg · {g.primary.rep_max ?? 1}RM</span>
                      </span>
                    </button>

                    {expanded && (
                      <div className="space-y-2 px-4 pb-4">
                        {g.records.map((r) => (
                          <div key={r.id} className="rounded-[14px] bg-white/[0.04] p-3">
                            {editingId === r.id ? (
                              <div className="space-y-2">
                                <input
                                  value={editExercise}
                                  onChange={(e) => setEditExercise(e.target.value)}
                                  maxLength={60}
                                  aria-label="Nombre del ejercicio"
                                  className="min-h-11 w-full rounded-xl border border-white/[0.14] bg-white/[0.06] px-3 text-[15px] outline-none focus:border-[color:var(--gold)]/60"
                                />
                                <div className="flex items-center gap-2">
                                  <input
                                    type="number"
                                    inputMode="decimal"
                                    step="0.5"
                                    min="0"
                                    value={editWeight}
                                    onChange={(e) => setEditWeight(e.target.value)}
                                    aria-label="Peso en kg"
                                    className="min-h-11 flex-1 rounded-xl border border-white/[0.14] bg-white/[0.06] px-3 text-lg font-semibold tabular outline-none focus:border-[color:var(--gold)]/60"
                                  />
                                  <span className="text-sm text-muted-foreground">kg</span>
                                  <button onClick={() => saveEdit(r.id)} className="gold-gradient grid h-11 w-11 place-items-center rounded-[12px]" aria-label="Guardar">
                                    <Check className="h-4 w-4" />
                                  </button>
                                  <button onClick={() => setEditingId(null)} className="grid h-11 w-11 place-items-center rounded-[12px] border border-border" aria-label="Cancelar">
                                    <X className="h-4 w-4" />
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="flex items-baseline justify-between gap-3">
                                  <span className="text-[15px] font-semibold">{r.rep_max ?? 1}RM · {formatKg(Number(r.weight))} kg</span>
                                  <span className="text-[13px] text-muted-foreground">{shortDate(r.updated_at)}</span>
                                </div>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  <button onClick={() => setDetailFor(r)} className="min-h-10 rounded-xl border border-white/[0.14] px-3.5 text-sm font-medium">
                                    Historial
                                  </button>
                                  <button onClick={() => startEdit(r)} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-white/[0.14] px-3.5 text-sm">
                                    <Pencil className="h-3.5 w-3.5" strokeWidth={1.8} /> Editar
                                  </button>
                                  <button onClick={() => handleDelete(r)} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl px-3.5 text-sm text-muted-foreground hover:text-destructive">
                                    <Trash2 className="h-3.5 w-3.5" strokeWidth={1.8} /> Borrar
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        ))}
                        {g.hasDictionary && (
                          <div className="pt-1 text-sm">
                            <MovementDictionaryLink exerciseName={g.primary.exercise}>Ver en el diccionario</MovementDictionaryLink>
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          <p className="mt-3 px-1 text-[13px] text-muted-foreground">Toca un ejercicio para ver su historial, editarlo o borrarlo.</p>
        </>
      )}
      {detailFor && (
        <HistoryModal record={detailFor} onClose={() => setDetailFor(null)} />
      )}
    </>
  );
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}
