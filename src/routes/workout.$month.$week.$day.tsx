import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { LinkedText } from "@/components/LinkedText";
import { usePlanning, useDayResults, useSaveResult, useSettings, findDay } from "@/lib/store";
import { extractPercentages, roundToPlates } from "@/lib/plates";
import { ChevronLeft, Sparkles, Check, CheckCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { setActiveWorkout, clearActiveWorkout, loadDraft, saveDraft, clearDraft } from "@/lib/active-workout";

export const Route = createFileRoute("/workout/$month/$week/$day")({
  head: () => ({ meta: [{ title: "Entrenamiento — RM OR DIE" }] }),
  component: WorkoutPage,
});

type BlockPayload = {
  block_key: string;
  status: "completed";
  weight: number | null;
  sets: number | null;
  reps: number | null;
  time_seconds: number | null;
  rpe: number | null;
  notes: string | null;
};

function WorkoutPage() {
  const { month, week, day } = Route.useParams();
  const weekN = Number(week);
  const { data: planning } = usePlanning();
  const { data: results = [] } = useDayResults(month, weekN, day);
  const { data: settings } = useSettings();
  const save = useSaveResult();
  const formsRef = useRef<Record<string, () => BlockPayload>>({});
  const [savingAll, setSavingAll] = useState(false);

  useEffect(() => {
    setActiveWorkout({ month, week: weekN, day, label: `${month} · S${weekN} · ${day}` });
  }, [month, weekN, day]);


  if (!planning) return <AppShell><p className="text-sm text-muted-foreground">Importa primero tu planificación.</p></AppShell>;

  const { month: mo, day: d } = findDay(planning.data, month, weekN, day);
  if (!mo || !d) return <AppShell><p className="text-sm text-muted-foreground">Día no encontrado.</p></AppShell>;

  async function saveAll() {
    const getters = Object.values(formsRef.current);
    if (getters.length === 0) return;
    setSavingAll(true);
    try {
      for (const get of getters) {
        await save.mutateAsync({
          month_key: month,
          week: weekN,
          day_key: day,
          ...get(),
        });
      }
      toast.success("Entreno completo guardado");
    } catch {
      toast.error("No se pudo guardar el entreno");
    } finally {
      setSavingAll(false);
    }
  }

  return (
    <AppShell>
      <Link to="/calendar" className="mb-4 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-3.5 w-3.5" /> Calendario
      </Link>
      <div className="mb-6">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{mo.label} · Semana {weekN}</p>
        <h1 className="mt-1 text-2xl font-semibold">{d.key}</h1>
      </div>

      {d.isRest && (
        <div className="card-elevated p-6 text-center">
          <p className="text-sm text-muted-foreground">Día de descanso y movilidad</p>
        </div>
      )}

      {d.blocks.length > 0 && (
        <button
          onClick={saveAll}
          disabled={savingAll}
          className="mb-4 flex w-full items-center justify-center gap-2 rounded-[18px] bg-white py-3 text-sm font-semibold text-black disabled:opacity-50"
        >
          <CheckCheck className="h-4 w-4" />
          {savingAll ? "Guardando entreno…" : "Guardar entreno completo"}
        </button>
      )}

      <div className="space-y-4">
        {d.blocks.map((b) => {
          const existing = results.find((r) => r.block_key === b.key);
          return (
            <BlockCard
              key={b.key}
              blockKey={b.key}
              content={b.content}
              existing={existing}
              settings={settings}
              register={(fn) => { formsRef.current[b.key] = fn; }}
              contextIds={{ month_key: month, week: weekN, day_key: day }}
            />
          );
        })}
      </div>
    </AppShell>
  );
}


function BlockCard({
  blockKey, content, existing, settings, contextIds, register,
}: {
  blockKey: string; content: string;
  existing: import("@/lib/store").WorkoutResult | undefined;
  settings: import("@/lib/store").AppSettings | undefined;
  register: (fn: () => BlockPayload) => void;
  contextIds: { month_key: string; week: number; day_key: string };
}) {
  const save = useSaveResult();
  const [weight, setWeight] = useState<string>(existing?.weight?.toString() ?? "");
  const [sets, setSets] = useState<string>(existing?.sets?.toString() ?? "");
  const [reps, setReps] = useState<string>(existing?.reps?.toString() ?? "");
  const [time, setTime] = useState<string>(existing?.time_seconds ? formatTime(existing.time_seconds) : "");
  const [rpe, setRpe] = useState<string>(existing?.rpe?.toString() ?? "");
  const [notes, setNotes] = useState<string>(existing?.notes ?? "");

  const pcts = extractPercentages(content);

  function payload(): BlockPayload {
    return {
      block_key: blockKey,
      status: "completed",
      weight: weight ? Number(weight) : null,
      sets: sets ? Number(sets) : null,
      reps: reps ? Number(reps) : null,
      time_seconds: time ? parseTime(time) : null,
      rpe: rpe ? Number(rpe) : null,
      notes: notes || null,
    };
  }

  useEffect(() => {
    register(payload);
  });

  async function onSaveClick() {
    await save.mutateAsync({ ...contextIds, ...payload() });

    toast.success(`${blockKey} guardado`);
  }

  return (
    <details className="card-elevated group" open={!!existing || /^[A-D]$/.test(blockKey)}>
      <summary className="flex cursor-pointer items-center justify-between p-5 [&::-webkit-details-marker]:hidden">
        <div className="flex items-center gap-3">
          <span className="flex h-8 min-w-8 items-center justify-center rounded-lg bg-surface-2 px-2 text-xs font-semibold uppercase tracking-wide text-gold">
            {blockKey}
          </span>
          {existing && <Check className="h-4 w-4 text-gold" />}
        </div>
        {pcts.length > 0 && (
          <div className="flex items-center gap-1 text-[11px] text-gold">
            <Sparkles className="h-3 w-3" />
            {pcts.map((p) => `${p}%`).join(" · ")}
          </div>
        )}
      </summary>

      <div className="border-t border-border/60 px-5 pb-5 pt-4">
        <LinkedText text={content} className="opacity-90" />

        {pcts.length > 0 && settings && (
          <PercentAssistant percentages={pcts} settings={settings} />
        )}

        <div className="mt-5 grid grid-cols-2 gap-3">
          <Field label="Peso (kg)" value={weight} onChange={setWeight} type="number" />
          <Field label="Series" value={sets} onChange={setSets} type="number" />
          <Field label="Reps" value={reps} onChange={setReps} type="number" />
          <Field label="Tiempo (mm:ss)" value={time} onChange={setTime} placeholder="3:45" />
          <Field label="RPE" value={rpe} onChange={setRpe} type="number" placeholder="1-10" />
        </div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notas, escala, sensaciones…"
          rows={2}
          className="mt-3 w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-gold"
        />

        <button
          onClick={onSaveClick}
          disabled={save.isPending}
          className="mt-4 w-full rounded-xl gold-gradient py-2.5 text-sm font-semibold disabled:opacity-50"
          style={{ color: "var(--gold-foreground)" }}
        >
          {save.isPending ? "Guardando…" : (existing ? "Actualizar" : "Guardar")}
        </button>
      </div>
    </details>
  );
}

function Field({ label, value, onChange, type = "text", placeholder }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <input
        type={type === "number" ? "text" : type}
        inputMode={type === "number" ? "decimal" : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm tabular outline-none focus:border-gold"
      />
    </label>
  );
}

function PercentAssistant({ percentages, settings }: { percentages: number[]; settings: import("@/lib/store").AppSettings }) {
  const [oneRm, setOneRm] = useState<string>("");
  const cfg = { bars: settings.bar_weights, plates: settings.plate_weights };
  const rm = Number(oneRm);
  return (
    <div className="mt-4 rounded-xl border border-gold/30 bg-surface-2 p-4">
      <div className="flex items-center gap-2 text-xs font-medium text-gold">
        <Sparkles className="h-3.5 w-3.5" /> Asistente de %
      </div>
      <div className="mt-3 flex items-center gap-2">
        <input
          type="text"
          inputMode="decimal"
          placeholder="Tu 1RM (kg)"
          value={oneRm}
          onChange={(e) => setOneRm(e.target.value)}
          className="w-32 rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-foreground tabular outline-none placeholder:text-muted-foreground focus:border-foreground/40"
        />
        <span className="text-xs text-muted-foreground">→ peso recomendado, redondeado a tus discos</span>
      </div>
      {rm > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {percentages.map((p) => {
            const target = (rm * p) / 100;
            const rec = roundToPlates(target, cfg);
            return (
              <div key={p} className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs text-foreground">
                <span className="text-muted-foreground">{p}%</span>
                <span className="mx-2 text-muted-foreground/50">·</span>
                <span className="font-semibold text-foreground tabular">{rec} kg</span>
                <span className="ml-1 text-muted-foreground/60">({target.toFixed(1)})</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function parseTime(v: string): number | null {
  if (!v) return null;
  const parts = v.split(":").map((x) => Number(x));
  if (parts.length === 2 && parts.every((n) => !isNaN(n))) return parts[0] * 60 + parts[1];
  const n = Number(v);
  return isNaN(n) ? null : n;
}
function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
