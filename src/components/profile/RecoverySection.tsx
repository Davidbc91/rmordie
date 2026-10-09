import { useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { useSaveWellness, useDeleteWellness } from "@/lib/profile-store";
import { windowStats, wellnessAverages, fmtNum } from "@/lib/analytics";
import { Card, Stat, Empty, Field, inputCls, num } from "./shared";

export const WELLNESS_FIELDS = [
  { key: "energy", label: "Energía" },
  { key: "fatigue", label: "Fatiga" },
  { key: "soreness", label: "Dolor" },
  { key: "mood", label: "Ánimo" },
] as const;

export function RecoverySection({ logs, results, days }: any) {
  const save = useSaveWellness();
  const del = useDeleteWellness();
  const [form, setForm] = useState<Record<string, any>>({ logged_on: new Date().toISOString().slice(0, 10) });

  const cur = wellnessAverages(logs, days);
  const all = wellnessAverages(logs, null);
  const curRpe = windowStats(results, [], days).avgRpe;
  const baseRpe = windowStats(results, [], null).avgRpe;

  async function submit() {
    const payload: any = { logged_on: form.logged_on, notes: form.notes || null, sleep_hours: num(form.sleep_hours) };
    for (const f of WELLNESS_FIELDS) payload[f.key] = num(form[f.key]);
    try {
      await save.mutateAsync(payload);
      toast.success("Registro guardado");
      setForm({ logged_on: new Date().toISOString().slice(0, 10) });
    } catch (e: any) {
      toast.error(e?.message ?? "Error");
    }
  }

  const notes: string[] = [];
  if (cur.fatigue != null && all.fatigue != null) {
    if (cur.fatigue > all.fatigue * 1.1) notes.push("Tu fatiga está por encima de tu media habitual.");
    else if (cur.fatigue < all.fatigue * 0.9) notes.push("Tu fatiga está por debajo de tu media habitual.");
    else notes.push("Tu fatiga se mantiene en tu media habitual.");
  }
  if (curRpe != null && baseRpe != null) {
    if (curRpe > baseRpe * 1.05) notes.push("Tu RPE medio ha aumentado respecto a tu histórico.");
    else if (curRpe < baseRpe * 0.95) notes.push("Tu RPE medio ha bajado respecto a tu histórico.");
  }
  if (cur.sleep != null) notes.push(`Duermes una media de ${fmtNum(cur.sleep)} h en este periodo.`);

  return (
    <div className="space-y-4">
      <Card>
        <p className="text-xs uppercase tracking-[0.12em]" style={{ color: "#6F6F6F" }}>
          Registro diario
        </p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Field label="Fecha">
            <input type="date" className={inputCls} value={form.logged_on} onChange={(e) => setForm({ ...form, logged_on: e.target.value })} />
          </Field>
          <Field label="Sueño (h)">
            <input inputMode="decimal" className={inputCls} value={form.sleep_hours ?? ""} onChange={(e) => setForm({ ...form, sleep_hours: e.target.value })} />
          </Field>
        </div>
        <div className="mt-3 space-y-3">
          {WELLNESS_FIELDS.map((f) => (
            <div key={f.key}>
              <div className="flex items-center justify-between text-xs uppercase tracking-[0.12em]" style={{ color: "#6F6F6F" }}>
                <span>{f.label}</span>
                <span>{form[f.key] ?? "—"}/10</span>
              </div>
              <input
                type="range"
                min={1}
                max={10}
                value={form[f.key] ?? 5}
                onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                className="mt-2 w-full accent-black"
              />
            </div>
          ))}
        </div>
        <Field label="Notas">
          <input className={inputCls} value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} maxLength={200} />
        </Field>
        <button onClick={submit} className="mt-4 w-full rounded-[18px] gold-gradient py-3 text-sm font-semibold">
          Guardar día
        </button>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Stat label="Sueño" value={cur.sleep != null ? `${fmtNum(cur.sleep)} h` : "—"} />
        <Stat label="Energía" value={cur.energy != null ? fmtNum(cur.energy) : "—"} />
        <Stat label="Fatiga" value={cur.fatigue != null ? fmtNum(cur.fatigue) : "—"} />
        <Stat label="RPE medio" value={curRpe != null ? fmtNum(curRpe) : "—"} />
      </div>

      {notes.length === 0 ? (
        <Empty text="Registra tu sueño, energía y fatiga varios días para ver tendencias." />
      ) : (
        <div className="space-y-2">
          {notes.map((n, i) => (
            <div key={i} className="rounded-[22px] border border-border bg-surface p-4 text-sm">{n}</div>
          ))}
        </div>
      )}

      <div className="space-y-2">
        {[...logs].reverse().slice(0, 14).map((l: any) => (
          <div key={l.id} className="flex items-center gap-3 rounded-[22px] border border-border bg-surface p-4">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">{new Date(l.logged_on).toLocaleDateString("es-ES", { day: "2-digit", month: "long" })}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {[l.sleep_hours != null && `Sueño ${l.sleep_hours}h`, l.energy != null && `Energía ${l.energy}`, l.fatigue != null && `Fatiga ${l.fatigue}`, l.soreness != null && `Dolor ${l.soreness}`, l.mood != null && `Ánimo ${l.mood}`]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
            </div>
            <button onClick={() => window.confirm("¿Eliminar?") && del.mutate(l.id)} className="rounded-xl border border-border p-2 text-muted-foreground" aria-label="Eliminar">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- 12. Goals ---------------- */
