import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import {
  usePersonalRecords,
  useUpsertPersonalRecord,
  useUpdatePersonalRecord,
  useDeletePersonalRecord,
  usePersonalRecordHistory,
  type PersonalRecord,
} from "@/lib/store";
import { Trophy, Plus, Pencil, Trash2, Check, X, History, ArrowRight } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";


export const Route = createFileRoute("/records")({
  head: () => ({
    meta: [
      { title: "RM — Malitos Premium Check" },
      { name: "description", content: "Consulta y edita tus récords máximos por ejercicio." },
      { property: "og:title", content: "RM — Malitos Premium Check" },
      { property: "og:description", content: "Tus récords máximos personales." },
    ],
  }),
  component: RecordsPage,
});

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

function RecordsPage() {
  const { data: records = [], isLoading } = usePersonalRecords();
  const upsert = useUpsertPersonalRecord();
  const update = useUpdatePersonalRecord();
  const del = useDeletePersonalRecord();

  const [showAdd, setShowAdd] = useState(false);
  const [newExercise, setNewExercise] = useState("");
  const [newWeight, setNewWeight] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editExercise, setEditExercise] = useState("");
  const [editWeight, setEditWeight] = useState("");
  const [historyFor, setHistoryFor] = useState<PersonalRecord | null>(null);


  const existingNames = new Set(records.map((r) => r.exercise.toLowerCase()));
  const query = newExercise.trim().toLowerCase();
  const filteredSuggestions = SUGGESTED.filter((s) => {
    if (existingNames.has(s.toLowerCase())) return false;
    if (!query) return true;
    return s.toLowerCase().includes(query);
  }).slice(0, 8);


  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const ex = newExercise.trim();
    const w = Number(newWeight);
    if (!ex) return toast.error("Escribe el nombre del ejercicio");
    if (!Number.isFinite(w) || w <= 0) return toast.error("Peso inválido");
    if (ex.length > 60) return toast.error("Nombre demasiado largo");
    try {
      await upsert.mutateAsync({ exercise: ex, weight: w });
      setNewExercise("");
      setNewWeight("");
      setShowAdd(false);
      toast.success("RM guardado");
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
      await update.mutateAsync({ id, exercise: ex, weight: w });
      setEditingId(null);
      toast.success("Actualizado");
    } catch (err: any) {
      toast.error(err?.message ?? "Error");
    }
  }

  async function handleDelete(r: PersonalRecord) {
    if (!window.confirm(`¿Eliminar el RM de "${r.exercise}"?`)) return;
    try {
      await del.mutateAsync(r.id);
      toast.success("Eliminado");
    } catch (err: any) {
      toast.error(err?.message ?? "Error");
    }
  }

  return (
    <AppShell>
      <header className="mb-6 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Récords</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Mis RM</h1>
          <p className="mt-1 text-sm text-muted-foreground">Tus máximos por ejercicio.</p>
        </div>
        <button
          onClick={() => setShowAdd((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-xl gold-gradient px-3 py-2 text-sm font-medium"
          style={{ color: "var(--gold-foreground)" }}
        >
          <Plus className="h-4 w-4" /> Añadir
        </button>
      </header>

      {showAdd && (
        <form onSubmit={handleAdd} className="card-elevated mb-6 space-y-3 p-4">
          <div className="relative">
            <label className="text-xs uppercase tracking-wider text-muted-foreground">Ejercicio</label>
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
              className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-gold/60"
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
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-white/5"
                    >
                      {s}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground">Peso (kg)</label>
            <input
              type="number"
              inputMode="decimal"
              step="0.5"
              min="0"
              value={newWeight}
              onChange={(e) => setNewWeight(e.target.value)}
              placeholder="0"
              className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-gold/60"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={upsert.isPending}
              className="flex-1 rounded-xl gold-gradient py-2 text-sm font-medium"
              style={{ color: "var(--gold-foreground)" }}
            >
              Guardar
            </button>
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="rounded-xl border border-border px-4 py-2 text-sm"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : records.length === 0 ? (
        <div className="card-elevated p-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl gold-gradient">
            <Trophy className="h-5 w-5" style={{ color: "var(--gold-foreground)" }} />
          </div>
          <h2 className="text-lg font-semibold">Aún no tienes RM</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Añade tus máximos para usarlos en el asistente de porcentajes.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {records.map((r) => {
            const isEditing = editingId === r.id;
            return (
              <li key={r.id} className="card-elevated p-4">
                {isEditing ? (
                  <div className="space-y-2">
                    <input
                      value={editExercise}
                      onChange={(e) => setEditExercise(e.target.value)}
                      maxLength={60}
                      className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-gold/60"
                    />
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.5"
                        min="0"
                        value={editWeight}
                        onChange={(e) => setEditWeight(e.target.value)}
                        className="flex-1 rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-gold/60"
                      />
                      <span className="text-xs text-muted-foreground">kg</span>
                      <button
                        onClick={() => saveEdit(r.id)}
                        className="rounded-lg gold-gradient p-2"
                        style={{ color: "var(--gold-foreground)" }}
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
                    <div className="flex-1 min-w-0">
                      <div className="truncate text-sm font-medium">{r.exercise}</div>
                      <div className="text-xs text-muted-foreground">
                        Actualizado {new Date(r.updated_at).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="gold-text text-xl font-semibold tabular">
                      {r.weight}
                      <span className="ml-1 text-xs text-muted-foreground">kg</span>
                    </div>
                    <button
                      onClick={() => startEdit(r)}
                      className="rounded-lg border border-border p-2 text-muted-foreground hover:text-foreground"
                      aria-label="Editar"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(r)}
                      className="rounded-lg border border-border p-2 text-muted-foreground hover:text-destructive"
                      aria-label="Eliminar"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </AppShell>
  );
}
