import { LinkedText } from "@/components/LinkedText";
import { usePersonalRecords, useUpsertPersonalRecord } from "@/lib/store";
import { extractPercentages } from "@/lib/plates";
import {
  detectExercise,
  loadsForPercentages,
  formatKg,
  compareLoads,
  LOAD_STATUS_LABEL,
} from "@/lib/rm-matcher";
import { resolveMovementId } from "@/lib/dictionary/resolve";
import { movements } from "@/lib/dictionary/catalog";
import { Sparkles, Check, Timer, Trophy } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { loadDraft, saveDraft } from "@/lib/active-workout";
import {
  detectWod,
  formatScore,
  parseClockInput,
  SCALE_LABEL,
  WOD_TYPE_LABEL,
  type WodScale,
} from "@/lib/wod";
import { type WodResult, type WodSaveInput, type PrOutcome } from "@/lib/wod-store";
import { WodScoreFields } from "@/components/WodRecords";
import { suggestNextLoad, estimateOneRm, parseTime, formatTime } from "./loads";
import { PercentAssistant } from "./PercentAssistant";

export type BlockPayload = {
  block_key: string;
  status: "completed";
  weight: number | null;
  sets: number | null;
  reps: number | null;
  time_seconds: number | null;
  rpe: number | null;
  notes: string | null;
};

export const SCALES: WodScale[] = ["rx", "scaled", "custom"];

export function BlockCard({
  blockKey, content, existing, existingWod, settings, contextIds, register, registerPr, registerWod, persistWod, onWodSaved,
}: {
  blockKey: string; content: string;
  existing: import("@/lib/store").WorkoutResult | undefined;
  existingWod: WodResult | null;
  settings: import("@/lib/store").AppSettings | undefined;
  register: (fn: () => BlockPayload) => void;
  registerPr: (fn: () => Promise<boolean>) => void;
  registerWod: (fn: () => WodSaveInput | null) => void;
  persistWod: () => Promise<PrOutcome | null>;
  onWodSaved: (out: PrOutcome) => void;
  contextIds: { month_key: string; week: number; day_key: string };
}) {
  const upsertRecord = useUpsertPersonalRecord();
  const { data: records = [] } = usePersonalRecords();
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
  const detected = useMemo(() => detectExercise(content, records), [content, records]);
  const targetLoads = useMemo(
    () => (detected ? loadsForPercentages(detected.weight, pcts) : []),
    [detected, pcts],
  );
  const targetHint =
    targetLoads.length > 0
      ? `Objetivo: ${targetLoads.map((l) => `${l.suggested} kg`).join(" · ")}`
      : detected
        ? `RM: ${formatKg(detected.weight)} kg`
        : undefined;

  // Carga realizada vs carga objetivo: indicador calculado, sin escribir nada.
  const actualLoad = useMemo(() => {
    const w = weight.replace(",", ".").trim();
    const n = Number(w);
    return w !== "" && Number.isFinite(n) && n > 0 ? n : null;
  }, [weight]);
  const estimatedOneRm = useMemo(() => {
    const w = Number(weight.replace(",", ".").trim());
    const r = Number(reps);
    return estimateOneRm(w, r);
  }, [weight, reps]);

  const nextLoad = useMemo(() => {
    const r = Number(rpe);
    return actualLoad != null ? suggestNextLoad(actualLoad, r) : null;
  }, [actualLoad, rpe]);

  const loadCompare = useMemo(
    () =>
      actualLoad != null && targetLoads.length > 0
        ? compareLoads(actualLoad, targetLoads[0].suggested)
        : null,
    [actualLoad, targetLoads],
  );


  function payload(): BlockPayload {
    const w = weight.replace(",", ".").trim();
    return {
      block_key: blockKey,
      status: "completed",
      weight: w && Number.isFinite(Number(w)) ? Number(w) : null,
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
    registerPr(maybeSaveStrengthPr);
    registerWod(wodPayload);
  });

  async function maybeSaveStrengthPr(): Promise<boolean> {
    const w = Number(weight.replace(",", ".").trim());
    const r = Number(reps);
    if (!detected || !Number.isFinite(w) || w <= 0 || r !== 1) return false;
    const movementId = resolveMovementId(detected.exercise);
    const movement = movementId ? movements.find((item) => item.id === movementId) : null;
    if (!movement?.rm) return false;
    const current = records.find((record) => (record.rep_max ?? 1) === 1 && resolveMovementId(record.exercise) === movement.id);
    if (current && w <= Number(current.weight)) return false;
    await upsertRecord.mutateAsync({ exercise: movement.name, weight: w, rep_max: 1 });
    return true;
  }

  return (
    <div className="glass glass-sheen">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-[56px] w-full cursor-pointer items-center justify-between gap-3 p-5 text-left"
      >
        <div className="flex items-center gap-3">
          <span className="grid h-9 min-w-9 place-items-center rounded-[12px] border border-[rgba(216,180,107,0.32)] bg-[rgba(216,180,107,0.12)] px-2 text-xs font-bold uppercase tracking-wide text-gold">
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
      </button>

      {open && (
      <div className="border-t border-border/60 px-5 pb-5 pt-4">
        <LinkedText text={content} className="opacity-90" />

        {detected && (
          <div className="glass-quiet mt-4 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">RM detectado</p>
                <p className="mt-1 text-lg font-semibold">{detected.exercise}</p>
              </div>
              <div className="text-right">
                <p className="metric gold-text">{formatKg(detected.weight)}</p>
                <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">kg · {detected.rep_max}RM</p>
              </div>
            </div>
            {targetLoads.length > 0 && (
              <button
                type="button"
                onClick={() => setWeight(String(targetLoads[0].suggested))}
                className="pressable mt-3 flex w-full items-center justify-between rounded-xl border border-[rgba(216,180,107,0.28)] bg-[rgba(216,180,107,0.08)] px-3.5 py-2.5 text-left"
              >
                <span className="text-xs text-muted-foreground">Objetivo {targetLoads[0].pct}%</span>
                <span className="text-sm font-bold text-gold">Usar {formatKg(targetLoads[0].suggested)} kg</span>
              </button>
            )}
          </div>
        )}

        {estimatedOneRm != null && detected && (
          <div className="glass-quiet mt-4 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">1RM estimado</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatKg(Number(weight.replace(",", ".")))} kg × {reps} reps · fórmula Epley
                </p>
              </div>
              <div className="text-right">
                <p className="metric gold-text">{formatKg(estimatedOneRm)}</p>
                <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">kg · estimado</p>
              </div>
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
              Es una referencia calculada, no un 1RM confirmado. Puedes usarla como referencia para futuras cargas.
            </p>
          </div>
        )}

        {pcts.length > 0 && settings && (
          <PercentAssistant percentages={pcts} settings={settings} record={detected} />
        )}

        {wod && (
          <div className="glass-quiet mt-5 p-4">
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
              Se guardará al guardar el entrenamiento completo.
            </p>
          </div>
        )}

        <div className="mt-5 grid grid-cols-2 gap-3">
          <Field label="Carga realizada (kg)" value={weight} onChange={setWeight} type="number" placeholder={targetHint} />
          <Field label="Series" value={sets} onChange={setSets} type="number" />
          <Field label="Reps" value={reps} onChange={setReps} type="number" />
          <Field label="Tiempo (mm:ss)" value={time} onChange={setTime} placeholder="3:45" />
          <Field label="RPE" value={rpe} onChange={setRpe} type="number" placeholder="1-10" />
        </div>

        {nextLoad && detected && (
          <div className="glass-quiet mt-3 flex items-center justify-between gap-3 rounded-[var(--r-md)] border border-[color:var(--glass-border)] px-3.5 py-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Próxima carga sugerida</p>
              <p className="mt-1 text-sm font-semibold">{formatKg(nextLoad.weight)} kg</p>
              <p className="text-[10px] text-muted-foreground">{nextLoad.reason} · basada en RPE</p>
            </div>
            <button
              type="button"
              onClick={() => setWeight(String(nextLoad.weight))}
              className="pressable rounded-xl border border-[rgba(216,180,107,0.3)] bg-[rgba(216,180,107,0.08)] px-3 py-2 text-xs font-semibold text-gold"
            >
              Usar próxima
            </button>
          </div>
        )}

        {loadCompare && (
          <div
            className={`mt-3 flex items-center justify-between gap-3 rounded-[var(--r-md)] border px-3.5 py-2.5 ${
              loadCompare.status === "met"
                ? "border-[rgba(216,180,107,0.45)] bg-[rgba(216,180,107,0.1)]"
                : loadCompare.status === "above"
                  ? "border-[rgba(235,214,166,0.35)] bg-[rgba(235,214,166,0.06)]"
                  : "border-[color:var(--glass-border)] bg-[color:var(--glass-bg)]"
            }`}
          >
            <span className="text-[11px] text-muted-foreground tabular">
              Objetivo {formatKg(targetLoads[0].suggested)} kg · Realizado {formatKg(actualLoad ?? 0)} kg
            </span>
            <span
              className={`shrink-0 text-[11px] font-bold uppercase tracking-[0.14em] ${
                loadCompare.status === "met"
                  ? "text-gold"
                  : loadCompare.status === "above"
                    ? "text-gold-soft"
                    : "text-muted-foreground"
              }`}
            >
              {LOAD_STATUS_LABEL[loadCompare.status]}
              <span className="ml-1.5 font-medium normal-case tracking-normal opacity-70">
                {loadCompare.status === "met" ? "" : `${loadCompare.diff > 0 ? "+" : "−"}${formatKg(Math.abs(loadCompare.diff))} kg`}
              </span>

            </span>
          </div>
        )}

        <textarea

          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notas, escala, sensaciones…"
          rows={2}
          className="mt-3 w-full rounded-[var(--r-md)] border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] px-3.5 py-3 text-[15px] outline-none transition focus:border-[rgba(216,180,107,0.55)]"
        />


      </div>
      )}
    </div>
  );
}

export function Field({ label, value, onChange, type = "text", placeholder }: {
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
