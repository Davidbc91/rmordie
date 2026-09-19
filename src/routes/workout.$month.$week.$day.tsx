import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { LinkedText } from "@/components/LinkedText";
import { usePlanning, useDayResults, useSaveResult, useSettings, findDay } from "@/lib/store";
import { extractPercentages, roundToPlates } from "@/lib/plates";
import { ChevronLeft, Sparkles, Check, CheckCheck, Timer, Trophy } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { setActiveWorkout, clearActiveWorkout, loadDraft, saveDraft, clearDraft } from "@/lib/active-workout";
import {
  detectWod,
  formatScore,
  formatDelta,
  parseClockInput,
  SCALE_LABEL,
  WOD_TYPE_LABEL,
  type WodScale,
} from "@/lib/wod";
import { useWodResults, useSaveWodResult, type WodResult, type WodSaveInput, type PrOutcome } from "@/lib/wod-store";
import { WodScoreFields } from "@/components/WodRecords";
import { PrCelebration, type PrCelebrationData } from "@/components/PrCelebration";
import { useCreatePost } from "@/lib/social";

export const Route = createFileRoute("/workout/$month/$week/$day")({
  head: () => ({ meta: [{ title: "Entrenamiento — RMORDIE" }] }),
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

const SCALES: WodScale[] = ["rx", "scaled", "custom"];

function WorkoutPage() {
  const { month, week, day } = Route.useParams();
  const weekN = Number(week);
  const navigate = useNavigate();
  const { data: planning } = usePlanning();
  const { data: results = [] } = useDayResults(month, weekN, day);
  const { data: wodResults = [] } = useWodResults();
  const { data: settings } = useSettings();
  const save = useSaveResult();
  const saveWod = useSaveWodResult();
  const createPost = useCreatePost();
  const formsRef = useRef<Record<string, () => BlockPayload>>({});
  const wodRef = useRef<Record<string, () => WodSaveInput | null>>({});
  const [savingAll, setSavingAll] = useState(false);
  const [celebrate, setCelebrate] = useState<{ data: PrCelebrationData; outcome: PrOutcome } | null>(null);

  useEffect(() => {
    setActiveWorkout({ month, week: weekN, day, label: `${month} · S${weekN} · ${day}` });
  }, [month, weekN, day]);

  const dayWods = useMemo(
    () => wodResults.filter((r) => r.month_key === month && r.week === weekN && r.day_key === day),
    [wodResults, month, weekN, day],
  );

  if (!planning) return <AppShell><p className="text-sm text-muted-foreground">Importa primero tu planificación.</p></AppShell>;

  const { month: mo, day: d } = findDay(planning.data, month, weekN, day);
  if (!mo || !d) return <AppShell><p className="text-sm text-muted-foreground">Día no encontrado.</p></AppShell>;

  function celebrationFor(out: PrOutcome): PrCelebrationData {
    return {
      exercise: out.wod_name,
      valueText: formatScore(out.result),
      subtitle: `${WOD_TYPE_LABEL[out.wod_type]} · ${SCALE_LABEL[out.scale]}`,
      deltaText: out.previousBest ? formatDelta(out.wod_type, out.result, out.previousBest) : "Primera marca",
      matched: out.kind === "matched",
    };
  }

  async function persistWod(blockKey: string): Promise<PrOutcome | null> {
    const getter = wodRef.current[blockKey];
    if (!getter) return null;
    const payload = getter();
    if (!payload) return null;
    return saveWod.mutateAsync({
      ...payload,
      source: "workout",
      month_key: month,
      week: weekN,
      day_key: day,
      block_key: blockKey,
    });
  }

  async function saveAll() {
    const entries = Object.entries(formsRef.current);
    if (entries.length === 0) return;
    setSavingAll(true);
    try {
      const prs: PrOutcome[] = [];
      for (const [blockKey, get] of entries) {
        await save.mutateAsync({ month_key: month, week: weekN, day_key: day, ...get() });
        const out = await persistWod(blockKey);
        if (out && (out.kind === "pr" || out.kind === "matched")) prs.push(out);
      }
      d!.blocks.forEach((b) => clearDraft(month, weekN, day, b.key));
      clearActiveWorkout();
      toast.success("Entreno completo guardado");
      const first = prs.find((p) => p.kind === "pr") ?? prs[0];
      if (first) setCelebrate({ data: celebrationFor(first), outcome: first });
    } catch {
      toast.error("No se pudo guardar el entreno");
    } finally {
      setSavingAll(false);
    }
  }

  async function shareCelebrated() {
    if (!celebrate) return;
    const out = celebrate.outcome;
    try {
      await createPost.mutateAsync({
        kind: "wod",
        caption: `Nuevo PR en ${out.wod_name} · ${formatScore(out.result)} ${SCALE_LABEL[out.scale]} #wodpr`,
        data: {
          wod_name: out.wod_name,
          wod_type: out.wod_type,
          scale: out.scale,
          score: formatScore(out.result),
          time_seconds: out.result.time_seconds,
          rounds: out.result.rounds,
          reps: out.result.reps,
          is_pr: out.kind === "pr",
        },
      });
      toast.success("Compartido en tu feed");
      setCelebrate(null);
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo compartir");
    }
  }

  return (
    <AppShell>
      {celebrate && (
        <PrCelebration
          data={celebrate.data}
          onClose={() => setCelebrate(null)}
          onView={() => {
            const slug = celebrate.outcome.result.wod_slug;
            setCelebrate(null);
            navigate({ to: "/records", search: { tab: "wods", wod: slug } });
          }}
          onShare={shareCelebrated}
        />
      )}
      <Link
        to="/calendar"
        className="pressable mb-4 inline-flex min-h-[40px] items-center gap-1.5 rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] px-3.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-3.5 w-3.5" /> Calendario
      </Link>

      <header className="glass glass-sheen rise rise-1 mb-4 p-5">
        <p className="eyebrow">{mo.label} · Semana {weekN}</p>
        <div className="mt-3 flex items-end justify-between gap-4">
          <h1 className="display-lg min-w-0 truncate">{d.key}</h1>
          <div className="shrink-0 text-right">
            <div className="metric gold-text">{d.blocks.length}</div>
            <p className="eyebrow mt-1.5">Bloques</p>
          </div>
        </div>
      </header>

      {d.isRest && (
        <div className="glass glass-sheen p-6 text-center">
          <p className="text-sm text-muted-foreground">Día de descanso y movilidad</p>
        </div>
      )}

      {d.blocks.length > 0 && (
        <button
          onClick={saveAll}
          disabled={savingAll}
          className="pressable gold-gradient mb-4 flex min-h-[54px] w-full items-center justify-center gap-2 rounded-[var(--r-lg)] text-[15px] font-semibold disabled:opacity-45"
        >
          <CheckCheck className="h-[18px] w-[18px]" />
          {savingAll ? "Guardando entreno…" : "Guardar entreno completo"}
        </button>
      )}

      <div className="space-y-4">
        {d.blocks.map((b) => {
          const existing = results.find((r) => r.block_key === b.key);
          const existingWod = dayWods.find((r) => r.block_key === b.key) ?? null;
          return (
            <BlockCard
              key={b.key}
              blockKey={b.key}
              content={b.content}
              existing={existing}
              existingWod={existingWod}
              settings={settings}
              register={(fn) => { formsRef.current[b.key] = fn; }}
              registerWod={(fn) => { wodRef.current[b.key] = fn; }}
              onWodSaved={(out) => {
                if (out.kind === "pr" || out.kind === "matched") {
                  setCelebrate({ data: celebrationFor(out), outcome: out });
                }
              }}
              persistWod={() => persistWod(b.key)}
              contextIds={{ month_key: month, week: weekN, day_key: day }}
            />
          );
        })}
      </div>
    </AppShell>
  );
}


function BlockCard({
  blockKey, content, existing, existingWod, settings, contextIds, register, registerWod, persistWod, onWodSaved,
}: {
  blockKey: string; content: string;
  existing: import("@/lib/store").WorkoutResult | undefined;
  existingWod: WodResult | null;
  settings: import("@/lib/store").AppSettings | undefined;
  register: (fn: () => BlockPayload) => void;
  registerWod: (fn: () => WodSaveInput | null) => void;
  persistWod: () => Promise<PrOutcome | null>;
  onWodSaved: (out: PrOutcome) => void;
  contextIds: { month_key: string; week: number; day_key: string };
}) {
  const save = useSaveResult();
  const [weight, setWeight] = useState<string>(existing?.weight?.toString() ?? "");
  const [sets, setSets] = useState<string>(existing?.sets?.toString() ?? "");
  const [reps, setReps] = useState<string>(existing?.reps?.toString() ?? "");
  const [time, setTime] = useState<string>(existing?.time_seconds ? formatTime(existing.time_seconds) : "");
  const [rpe, setRpe] = useState<string>(existing?.rpe?.toString() ?? "");
  const [notes, setNotes] = useState<string>(existing?.notes ?? "");
  const [open, setOpen] = useState<boolean>(!!existing || /^[A-D]$/.test(blockKey));
  const loadedRef = useRef(false);

  const wod = useMemo(() => detectWod(content), [content]);
  const [wodScale, setWodScale] = useState<WodScale>((existingWod?.scale as WodScale) ?? "rx");
  const [wodCap, setWodCap] = useState<boolean>(existingWod?.status === "cap");
  const [wodTime, setWodTime] = useState<string>(existingWod?.time_seconds ? formatTime(existingWod.time_seconds) : "");
  const [wodRounds, setWodRounds] = useState<string>(existingWod?.rounds?.toString() ?? "");
  const [wodReps, setWodReps] = useState<string>(existingWod?.reps?.toString() ?? "");
  const [savingWod, setSavingWod] = useState(false);

  // Restaurar borrador (valores escritos y no guardados) al volver a la pantalla
  useEffect(() => {
    const d = loadDraft<{
      weight?: string; sets?: string; reps?: string; time?: string; rpe?: string; notes?: string; open?: boolean;
      wodScale?: WodScale; wodCap?: boolean; wodTime?: string; wodRounds?: string; wodReps?: string;
    }>(contextIds.month_key, contextIds.week, contextIds.day_key, blockKey);
    if (d) {
      if (d.weight !== undefined) setWeight(d.weight);
      if (d.sets !== undefined) setSets(d.sets);
      if (d.reps !== undefined) setReps(d.reps);
      if (d.time !== undefined) setTime(d.time);
      if (d.rpe !== undefined) setRpe(d.rpe);
      if (d.notes !== undefined) setNotes(d.notes);
      if (d.open !== undefined) setOpen(d.open);
      if (d.wodScale !== undefined) setWodScale(d.wodScale);
      if (d.wodCap !== undefined) setWodCap(d.wodCap);
      if (d.wodTime !== undefined) setWodTime(d.wodTime);
      if (d.wodRounds !== undefined) setWodRounds(d.wodRounds);
      if (d.wodReps !== undefined) setWodReps(d.wodReps);
    }
    loadedRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blockKey]);

  useEffect(() => {
    if (!loadedRef.current) return;
    saveDraft(contextIds.month_key, contextIds.week, contextIds.day_key, blockKey, {
      weight, sets, reps, time, rpe, notes, open, wodScale, wodCap, wodTime, wodRounds, wodReps,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weight, sets, reps, time, rpe, notes, open, wodScale, wodCap, wodTime, wodRounds, wodReps, blockKey]);

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

  function wodPayload(): WodSaveInput | null {
    if (!wod) return null;
    const t = parseClockInput(wodTime);
    const hasScore =
      t != null || wodRounds.trim() !== "" || wodReps.trim() !== "";
    if (!hasScore) return null;
    return {
      wod_slug: wod.slug,
      wod_name: wod.name,
      wod_type: wod.type,
      scale: wodScale,
      status: wodCap ? "cap" : "completed",
      time_seconds: t,
      rounds: wodRounds ? Number(wodRounds) : null,
      reps: wod.type === "max_calories" || wod.type === "max_distance" ? null : wodReps ? Number(wodReps) : null,
      calories: wod.type === "max_calories" && wodReps ? Number(wodReps) : null,
      distance: wod.type === "max_distance" && wodReps ? Number(wodReps) : null,
      rpe: rpe ? Number(rpe) : null,
      notes: notes || null,
    };
  }

  useEffect(() => {
    register(payload);
    registerWod(wodPayload);
  });

  async function onSaveClick() {
    await save.mutateAsync({ ...contextIds, ...payload() });
    if (wod) {
      setSavingWod(true);
      try {
        const out = await persistWod();
        if (out) onWodSaved(out);
      } finally {
        setSavingWod(false);
      }
    }
    toast.success(`${blockKey} guardado`);
  }

  return (
    <details
      className="card-elevated group"
      open={open}
      onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}
    >
      <summary className="flex cursor-pointer items-center justify-between p-5 [&::-webkit-details-marker]:hidden">
        <div className="flex items-center gap-3">
          <span className="flex h-8 min-w-8 items-center justify-center rounded-lg bg-surface-2 px-2 text-xs font-semibold uppercase tracking-wide text-gold">
            {blockKey}
          </span>
          {existing && <Check className="h-4 w-4 text-gold" />}
          {wod && (
            <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
              <Timer className="h-3 w-3" /> {WOD_TYPE_LABEL[wod.type]}
            </span>
          )}
          {existingWod?.is_pr && <Trophy className="h-4 w-4" />}
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

        {wod && (
          <div className="mt-5 rounded-xl border border-border bg-surface-2 p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em]">
                Resultado WOD · {wod.name}
              </p>
              {existingWod && (
                <span className="text-[11px] text-muted-foreground">{formatScore(existingWod)}</span>
              )}
            </div>
            {wod.timeCapSeconds && (
              <p className="mt-1 text-[11px] text-muted-foreground">
                Time cap detectado: {formatTime(wod.timeCapSeconds)}
              </p>
            )}
            <div className="mt-3 flex gap-2">
              {SCALES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setWodScale(s)}
                  className={`flex-1 rounded-xl border px-2 py-1.5 text-[11px] font-semibold transition ${
                    wodScale === s ? "gold-gradient border-transparent" : "border-border text-muted-foreground"
                  }`}
                >
                  {SCALE_LABEL[s]}
                </button>
              ))}
            </div>
            <div className="mt-3">
              <WodScoreFields
                type={wod.type}
                cap={wodCap}
                setCap={setWodCap}
                time={wodTime}
                setTime={setWodTime}
                rounds={wodRounds}
                setRounds={setWodRounds}
                reps={wodReps}
                setReps={setWodReps}
              />
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Se guardará automáticamente como marca en WOD PRs.
            </p>
          </div>
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
          className="mt-3 w-full rounded-[var(--r-md)] border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] px-3.5 py-3 text-[15px] outline-none transition focus:border-[rgba(216,180,107,0.55)]"
        />

        <button
          onClick={onSaveClick}
          disabled={save.isPending || savingWod}
          className="pressable mt-4 min-h-[50px] w-full rounded-[var(--r-md)] border border-[color:var(--glass-border-strong)] bg-[color:var(--glass-bg-2)] text-sm font-semibold text-foreground disabled:opacity-45"
        >
          {save.isPending || savingWod ? "Guardando…" : (existing ? "Actualizar" : "Guardar")}
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
        className="tap w-full rounded-[var(--r-md)] border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] px-3.5 py-3 text-[15px] tabular outline-none transition focus:border-[rgba(216,180,107,0.55)]"
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
