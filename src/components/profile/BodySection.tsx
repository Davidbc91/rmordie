import { useState } from "react";
import { toast } from "sonner";
import { Trash2, Plus } from "lucide-react";
import { useBodyMetrics, useAddBodyMetric, useDeleteBodyMetric } from "@/lib/profile-store";
import { Card, Empty, Field, inputCls, MonoChart, num } from "./shared";

export const BODY_FIELDS: { key: string; label: string; unit: string }[] = [
  { key: "weight_kg", label: "Peso", unit: "kg" },
  { key: "body_fat_pct", label: "% grasa", unit: "%" },
  { key: "muscle_mass_kg", label: "Masa muscular", unit: "kg" },
  { key: "waist_cm", label: "Cintura", unit: "cm" },
  { key: "chest_cm", label: "Pecho", unit: "cm" },
  { key: "hip_cm", label: "Cadera", unit: "cm" },
  { key: "arm_cm", label: "Brazo", unit: "cm" },
  { key: "thigh_cm", label: "Muslo", unit: "cm" },
];

export function BodySection() {
  const { data: metrics = [] } = useBodyMetrics();
  const add = useAddBodyMetric();
  const del = useDeleteBodyMetric();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({ measured_on: new Date().toISOString().slice(0, 10) });
  const [metricKey, setMetricKey] = useState("weight_kg");

  const chartData = metrics
    .filter((m) => (m as any)[metricKey] != null)
    .map((m) => ({
      label: new Date(m.measured_on).toLocaleDateString("es-ES", { day: "2-digit", month: "short" }),
      value: Number((m as any)[metricKey]),
    }));

  async function submit() {
    const payload: any = { measured_on: form.measured_on, notes: form.notes || null };
    let any = false;
    for (const f of BODY_FIELDS) {
      const v = num(form[f.key]);
      if (v != null) {
        payload[f.key] = v;
        any = true;
      }
    }
    if (!any) return toast.error("Introduce al menos un valor");
    try {
      await add.mutateAsync(payload);
      setForm({ measured_on: new Date().toISOString().slice(0, 10) });
      setOpen(false);
      toast.success("Registro guardado");
    } catch (e: any) {
      toast.error(e?.message ?? "Error");
    }
  }

  return (
    <div className="space-y-4">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-center gap-2 rounded-[18px] gold-gradient py-3 text-sm font-semibold"
      >
        <Plus className="h-4 w-4" /> Nuevo registro corporal
      </button>

      {open && (
        <Card>
          <Field label="Fecha">
            <input type="date" className={inputCls} value={form.measured_on} onChange={(e) => setForm({ ...form, measured_on: e.target.value })} />
          </Field>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {BODY_FIELDS.map((f) => (
              <Field key={f.key} label={`${f.label} (${f.unit})`}>
                <input inputMode="decimal" className={inputCls} value={form[f.key] ?? ""} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
              </Field>
            ))}
          </div>
          <div className="mt-3">
            <Field label="Notas">
              <input className={inputCls} value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} maxLength={200} />
            </Field>
          </div>
          <button onClick={submit} className="mt-5 w-full rounded-[18px] gold-gradient py-3 text-sm font-semibold">
            Guardar
          </button>
        </Card>
      )}

      <Card>
        <div className="-mx-1 mb-4 flex gap-1 overflow-x-auto no-scrollbar">
          {BODY_FIELDS.map((f) => (
            <button
              key={f.key}
              onClick={() => setMetricKey(f.key)}
              className="whitespace-nowrap rounded-full px-3 py-1.5 text-[13px] font-semibold transition"
              style={
                metricKey === f.key
                  ? { background: "linear-gradient(140deg,#EBD6A6,#D8B46B)", color: "#0A0A0B" }
                  : { background: "#F1F1F1", color: "#6F6F6F" }
              }
            >
              {f.label}
            </button>
          ))}
        </div>
        <MonoChart data={chartData} />
      </Card>

      <div className="space-y-2">
        {metrics.length === 0 && <Empty text="Registra tu primer dato corporal para ver la evolución." />}
        {[...metrics].reverse().map((m) => (
          <div key={m.id} className="flex items-center gap-3 rounded-[22px] border border-border bg-surface p-4">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">
                {new Date(m.measured_on).toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" })}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {BODY_FIELDS.filter((f) => (m as any)[f.key] != null)
                  .map((f) => `${f.label} ${(m as any)[f.key]}${f.unit}`)
                  .join(" · ") || "—"}
              </div>
              {m.notes && <div className="mt-1 text-xs text-muted-foreground">{m.notes}</div>}
            </div>
            <button
              onClick={() => {
                if (window.confirm("¿Eliminar este registro?")) del.mutate(m.id);
              }}
              className="rounded-xl border border-border p-2 text-muted-foreground"
              aria-label="Eliminar registro"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- 3. Progress dashboard ---------------- */
