import { useState } from "react";
import { toast } from "sonner";
import { Trash2, Plus } from "lucide-react";
import { useGoals, useSaveGoal, useDeleteGoal, type AthleteGoal } from "@/lib/profile-store";
import { windowStats, bodyChange, fmtNum } from "@/lib/analytics";
import { sameExercise } from "@/lib/rm-matcher";
import { Card, Empty, Field, inputCls, num } from "./shared";

export const GOAL_TYPES = [
  { key: "weight", label: "Peso", unit: "kg" },
  { key: "pr", label: "PR", unit: "kg" },
  { key: "time", label: "Tiempo", unit: "s" },
  { key: "reps", label: "Repeticiones", unit: "reps" },
  { key: "volume", label: "Volumen", unit: "kg" },
  { key: "frequency", label: "Frecuencia", unit: "ses/sem" },
  { key: "benchmark", label: "Benchmark", unit: "" },
];

export function GoalsSection({ records, results, metrics }: any) {
  const { data: goals = [] } = useGoals();
  const save = useSaveGoal();
  const del = useDeleteGoal();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Record<string, any>>({ goal_type: "pr" });

  const currentFor = (g: AthleteGoal): number | null => {
    if (g.goal_type === "pr" && g.exercise) {
      const recs = records.filter((r: any) => sameExercise(r.exercise, g.exercise!));
      return recs.length ? Math.max(...recs.map((r: any) => Number(r.weight))) : g.current_value ?? null;
    }
    if (g.goal_type === "weight") return bodyChange(metrics).current ?? g.current_value ?? null;
    if (g.goal_type === "volume") return windowStats(results, [], 28).volume;
    if (g.goal_type === "frequency") return windowStats(results, [], 28).weeklyFreq;
    return g.current_value ?? null;
  };

  async function submit() {
    const target = num(form.target_value);
    if (!form.title?.trim()) return toast.error("Escribe un título");
    if (target == null) return toast.error("Objetivo inválido");
    try {
      await save.mutateAsync({
        title: form.title.trim(),
        goal_type: form.goal_type,
        exercise: form.exercise || null,
        start_value: num(form.start_value),
        current_value: num(form.start_value),
        target_value: target,
        unit: GOAL_TYPES.find((t) => t.key === form.goal_type)?.unit ?? "",
        target_date: form.target_date || null,
        status: "active",
      });
      setForm({ goal_type: "pr" });
      setOpen(false);
      toast.success("Objetivo creado");
    } catch (e: any) {
      toast.error(e?.message ?? "Error");
    }
  }

  return (
    <div className="space-y-4">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-center gap-2 rounded-[18px] gold-gradient py-3 text-sm font-semibold">
        <Plus className="h-4 w-4" /> Nuevo objetivo
      </button>

      {open && (
        <Card>
          <Field label="Título">
            <input className={inputCls} value={form.title ?? ""} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={60} />
          </Field>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Field label="Tipo">
              <select className={inputCls} value={form.goal_type} onChange={(e) => setForm({ ...form, goal_type: e.target.value })}>
                {GOAL_TYPES.map((t) => (
                  <option key={t.key} value={t.key}>{t.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Ejercicio (opcional)">
              <input className={inputCls} value={form.exercise ?? ""} onChange={(e) => setForm({ ...form, exercise: e.target.value })} maxLength={60} />
            </Field>
            <Field label="Valor inicial">
              <input inputMode="decimal" className={inputCls} value={form.start_value ?? ""} onChange={(e) => setForm({ ...form, start_value: e.target.value })} />
            </Field>
            <Field label="Objetivo">
              <input inputMode="decimal" className={inputCls} value={form.target_value ?? ""} onChange={(e) => setForm({ ...form, target_value: e.target.value })} />
            </Field>
            <Field label="Fecha límite">
              <input type="date" className={inputCls} value={form.target_date ?? ""} onChange={(e) => setForm({ ...form, target_date: e.target.value })} />
            </Field>
          </div>
          <button onClick={submit} className="mt-5 w-full rounded-[18px] gold-gradient py-3 text-sm font-semibold">Crear</button>
        </Card>
      )}

      {goals.length === 0 && <Empty text="Crea tu primer objetivo deportivo." />}

      {goals.map((g) => {
        const current = currentFor(g);
        const start = g.start_value ?? 0;
        const pct =
          current == null || g.target_value === start
            ? null
            : Math.max(0, Math.min(100, Math.round(((current - start) / (g.target_value - start)) * 100)));
        return (
          <Card key={g.id}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-[0.12em]" style={{ color: "#6F6F6F" }}>{g.title}</p>
                <p className="mt-1 text-[34px] font-semibold leading-none tabular tracking-tight">
                  {current != null ? fmtNum(current) : "—"}
                  <span className="text-sm" style={{ color: "#6F6F6F" }}> / {fmtNum(g.target_value)} {g.unit}</span>
                </p>
              </div>
              <button onClick={() => window.confirm("¿Eliminar objetivo?") && del.mutate(g.id)} className="rounded-xl border p-2" style={{ borderColor: "#E4E4E4", color: "#6F6F6F" }} aria-label="Eliminar objetivo">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4 h-[6px] w-full overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.10)" }}>
              <div className="h-full rounded-full" style={{ width: `${pct ?? 0}%`, background: "linear-gradient(140deg,#EBD6A6,#D8B46B)" }} />
            </div>
            <p className="mt-2 text-[13px]" style={{ color: "#6F6F6F" }}>
              {pct != null ? `${pct}% completado` : "Sin datos suficientes"}
              {g.target_date ? ` · hasta ${new Date(g.target_date).toLocaleDateString("es-ES")}` : ""}
            </p>
          </Card>
        );
      })}
    </div>
  );
}

/* ---------------- 13. Milestones ---------------- */
