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
import { useState, useMemo } from "react";
import { toast } from "sonner";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";


export const Route = createFileRoute("/records")({
  head: () => ({
    meta: [
      { title: "RM — RM OR DIE" },
      { name: "description", content: "Consulta y edita tus récords máximos por ejercicio." },
      { property: "og:title", content: "RM — RM OR DIE" },
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
                      onClick={() => setHistoryFor(r)}
                      className="rounded-lg border border-border p-2 text-muted-foreground hover:text-foreground"
                      aria-label="Historial"
                    >
                      <History className="h-4 w-4" />
                    </button>
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

      {historyFor && (
        <HistoryModal record={historyFor} onClose={() => setHistoryFor(null)} />
      )}
    </AppShell>
  );
}

function HistoryModal({ record, onClose }: { record: PersonalRecord; onClose: () => void }) {
  const { data: history = [], isLoading } = usePersonalRecordHistory(record.exercise);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-2xl border border-border bg-surface p-5 shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Historial</p>
            <h2 className="mt-1 text-lg font-semibold">{record.exercise}</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg border border-border p-2 text-muted-foreground"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : history.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin cambios registrados todavía.</p>
        ) : (
          <>
            <EvolutionChart history={history} />
            <ul className="max-h-[40vh] space-y-2 overflow-auto">
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
              const diff =
                h.previous_weight != null ? h.new_weight - h.previous_weight : null;
              return (
                <li
                  key={h.id}
                  className="rounded-xl border border-border bg-background/40 p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-xs text-muted-foreground">
                      {dateStr} · {timeStr}
                    </div>
                    {diff != null && diff !== 0 && (
                      <span
                        className={`text-xs font-medium tabular ${
                          diff > 0 ? "gold-text" : "text-muted-foreground"
                        }`}
                      >
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
                        <span className="font-semibold gold-text">{h.new_weight} kg</span>
                      </>
                    ) : (
                      <>
                        <span className="text-muted-foreground">Creación</span>
                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="font-semibold gold-text">{h.new_weight} kg</span>
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
        (a, b) =>
          new Date(a.changed_at).getTime() - new Date(b.changed_at).getTime(),
      )
      .map((h) => ({
        date: new Date(h.changed_at).toLocaleDateString(undefined, {
          day: "2-digit",
          month: "short",
        }),
        weight: Number(h.new_weight),
      }));
  }, [history]);

  if (data.length < 2) {
    return (
      <div className="mb-4 rounded-xl border border-border bg-background/40 p-4 text-center">
        <p className="text-xs text-muted-foreground">
          Necesitas al menos 2 registros para ver la evolución.
        </p>
        <p className="mt-1 text-lg font-semibold gold-text tabular">
          {data[0]?.weight ?? 0} kg
        </p>
      </div>
    );
  }

  const weights = data.map((d) => d.weight);
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const pad = Math.max(2, (max - min) * 0.15);

  return (
    <div className="mb-4 rounded-xl border border-border bg-background/40 p-3">
      <div className="mb-2 flex items-baseline justify-between">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Evolución
        </p>
        <p className="text-xs text-muted-foreground tabular">
          <span className="gold-text font-semibold">{max} kg</span> máx ·{" "}
          {min} kg mín
        </p>
      </div>
      <div className="h-40 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
            <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="date"
              stroke="hsl(var(--muted-foreground))"
              tick={{ fontSize: 10 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              domain={[Math.floor(min - pad), Math.ceil(max + pad)]}
              stroke="hsl(var(--muted-foreground))"
              tick={{ fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              width={40}
            />
            <Tooltip
              contentStyle={{
                background: "hsl(var(--background))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 8,
                fontSize: 12,
              }}
              labelStyle={{ color: "hsl(var(--muted-foreground))" }}
              formatter={(v: number) => [`${v} kg`, "Peso"]}
            />
            <Line
              type="monotone"
              dataKey="weight"
              stroke="var(--gold, #d4af37)"
              strokeWidth={2.5}
              dot={{ r: 3, fill: "var(--gold, #d4af37)", strokeWidth: 0 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}


