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
import { Check, ChevronDown, Trophy } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { loadDraft, saveDraft } from "@/lib/active-workout";
import {
  compareScores,
  detectWod,
  formatDelta,
  formatScore,
  parseClockInput,
  scoreValue,
  SCALE_LABEL,
  WOD_TYPE_LABEL,
  type WodScale,
} from "@/lib/wod";
import { useWodResults, type WodResult, type WodSaveInput, type PrOutcome } from "@/lib/wod-store";
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
  blockKey, content, existing, existingWod, settings, contextIds, register, registerPr, registerWod, persistWod, onWodSaved, defaultOpen = false,
}: {
  blockKey: string; content: string; defaultOpen?: boolean;
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
  const [open, setOpen] = useState<boolean>(defaultOpen);
  const [notesOpen, setNotesOpen] = useState(false);
  const [title, secondLine] = useMemo(() => firstLines(content), [content]);
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


  const { data: wodHistory = [] } = useWodResults();
  const bestForScale = useMemo(() => {
    if (!wod) return null;
    const ranked = wodHistory.filter(
      (r) => r.wod_slug === wod.slug && r.scale === wodScale && r.id !== existingWod?.id && scoreValue(r) != null,
    );
    if (!ranked.length) return null;
    return ranked.reduce((best, cur) => ((compareScores(wod.type, cur, best) ?? 0) > 0 ? cur : best));
  }, [wod, wodHistory, wodScale, existingWod?.id]);

  // Aviso en vivo si el resultado escrito mejora tu marca (no guarda nada).
  const livePr = useMemo(() => {
    if (!wod || !bestForScale || wodCap) return null;
    const n = (v: string) => (v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : null);
    const current = {
      wod_type: wod.type,
      status: "completed",
      time_seconds: parseClockInput(wodTime),
      rounds: n(wodRounds),
      reps: wod.type === "max_calories" || wod.type === "max_distance" ? null : n(wodReps),
      calories: wod.type === "max_calories" ? n(wodReps) : null,
      distance: wod.type === "max_distance" ? n(wodReps) : null,
    };
    const cmp = compareScores(wod.type, current, bestForScale);
    if (cmp == null || cmp <= 0) return null;
    const delta = formatDelta(wod.type, current, bestForScale);
    return `${formatScore(current)} sería nuevo PR${delta ? ` (${delta})` : ""}`;
  }, [wod, bestForScale, wodCap, wodTime, wodRounds, wodReps]);

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

  const done = !!existing || !!existingWod;
  const summary = done ? blockSummary(existing, existingWod) : null;
  const subtitle = summary ?? (wod ? `${WOD_TYPE_LABEL[wod.type]}${secondLine ? ` · ${secondLine}` : ""}` : secondLine);
  const showNotes = notesOpen || notes.trim() !== "";

  return (
    <div className={`glass glass-sheen ${open ? "border-[color:var(--gold)]/35" : ""}`}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-[68px] w-full cursor-pointer items-center gap-3 px-4 py-3 text-left"
      >
        {done ? (
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[12px] bg-[color:var(--gold)] text-[color:var(--gold-foreground)]" aria-label={`Bloque ${blockKey} registrado`}>
            <Check className="h-[18px] w-[18px]" strokeWidth={3} />
          </span>
        ) : (
          <span className={`grid h-9 min-w-9 shrink-0 place-items-center rounded-[12px] border px-2 text-sm font-bold uppercase ${open ? "border-[color:var(--gold)]/40 text-gold" : "border-white/15 text-muted-foreground"}`}>
            {blockKey}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold">{done ? `${blockKey} · ${title}` : title}</span>
          {subtitle && <span className="mt-0.5 block truncate text-[13px] text-muted-foreground">{subtitle}</span>}
        </span>
        {existingWod?.is_pr && <Trophy className="h-4 w-4 shrink-0 text-gold" />}
        {wod && !done && (
          <span className="shrink-0 rounded-full border border-white/15 px-2.5 py-1 text-xs font-semibold text-foreground/85">
            {WOD_TYPE_LABEL[wod.type]}
          </span>
        )}
        <ChevronDown className={`h-[18px] w-[18px] shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
      <div className="space-y-4 px-4 pb-4">
        <LinkedText text={content} className="text-[15px] leading-relaxed text-foreground/85" />

        {/* WOD: marca, escala y resultado */}
        {wod ? (
          <>
            {bestForScale && (
              <p className="text-[13px] text-muted-foreground">
                Tu mejor marca {SCALE_LABEL[wodScale]}:{" "}
                <span className="font-semibold text-gold-soft">{formatScore(bestForScale)}</span>
                {" · "}{new Date(bestForScale.performed_on).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}
              </p>
            )}
            {wod.timeCapSeconds && (
              <p className="text-[13px] text-muted-foreground">Time cap: {formatTime(wod.timeCapSeconds)}</p>
            )}
            <div role="group" aria-label="Escala" className="grid grid-cols-3 gap-1.5 rounded-[14px] bg-white/[0.05] p-1">
              {SCALES.map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={wodScale === s}
                  onClick={() => setWodScale(s)}
                  className={`min-h-10 rounded-[10px] text-sm transition ${
                    wodScale === s ? "bg-[color:var(--gold)] font-bold text-[color:var(--gold-foreground)]" : "text-foreground/80"
                  }`}
                >
                  {SCALE_LABEL[s]}
                </button>
              ))}
            </div>
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
            <div className="grid grid-cols-2 gap-2.5">
              <Field label="RPE" value={rpe} onChange={setRpe} type="number" placeholder="1–10" />
            </div>
            {livePr && <p className="text-[13px] font-medium text-gold">{livePr}</p>}
          </>
        ) : (
          <>
            {/* Fuerza: una sola tarjeta con la carga de hoy */}
            {detected && (
              <div className="space-y-2.5 rounded-[16px] border border-[color:var(--gold)]/30 bg-[color:var(--gold)]/[0.09] p-3.5">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-[13px] text-muted-foreground">
                  <span>Tu {detected.rep_max}RM: <span className="font-semibold text-foreground">{formatKg(detected.weight)} kg</span></span>
                  {targetLoads.length > 0 && (
                    <span>
                      {targetLoads.map((l, i) => (
                        <span key={l.pct}>{i > 0 && " · "}{l.pct} % → <span className="font-semibold text-foreground">{formatKg(l.suggested)} kg</span></span>
                      ))}
                    </span>
                  )}
                </div>
                {targetLoads.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setWeight(String(targetLoads[0].suggested))}
                    className="pressable flex min-h-12 w-full items-center justify-center rounded-[14px] bg-[color:var(--gold)] text-base font-bold text-[color:var(--gold-foreground)]"
                  >
                    Usar {formatKg(targetLoads[0].suggested)} kg
                  </button>
                )}
                {nextLoad && (
                  <p className="text-[13px] text-muted-foreground">
                    Próxima vez: <span className="font-semibold text-foreground">{formatKg(nextLoad.weight)} kg</span> ({nextLoad.reason})
                  </p>
                )}
                {loadCompare && (
                  <p className="text-[13px] text-muted-foreground">
                    {LOAD_STATUS_LABEL[loadCompare.status]}
                    {loadCompare.status !== "met" && ` · ${loadCompare.diff > 0 ? "+" : "−"}${formatKg(Math.abs(loadCompare.diff))} kg sobre el objetivo`}
                  </p>
                )}
                {estimatedOneRm != null && Number(reps) > 1 && (
                  <p className="text-[13px] text-muted-foreground">1RM estimado con esto: <span className="font-semibold text-foreground">{formatKg(estimatedOneRm)} kg</span></p>
                )}
              </div>
            )}

            {!detected && pcts.length > 0 && settings && (
              <PercentAssistant percentages={pcts} settings={settings} record={detected} />
            )}

            <div className="grid grid-cols-2 gap-2.5">
              <Field label="Carga (kg)" value={weight} onChange={setWeight} type="number" placeholder={targetHint} highlight={!!detected} />
              <Field label="RPE" value={rpe} onChange={setRpe} type="number" placeholder="1–10" />
              <Field label="Series" value={sets} onChange={setSets} type="number" />
              <Field label="Reps" value={reps} onChange={setReps} type="number" />
              {!detected && pcts.length === 0 && (
                <Field label="Tiempo (mm:ss)" value={time} onChange={setTime} placeholder="3:45" />
              )}
            </div>
          </>
        )}

        {showNotes ? (
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notas, escala, sensaciones…"
            rows={2}
            autoFocus={notesOpen && notes === ""}
            className="w-full rounded-[14px] border border-[color:var(--glass-border)] bg-white/[0.06] px-3.5 py-3 text-[15px] outline-none transition focus:border-[color:var(--gold)]/55"
          />
        ) : (
          <button type="button" onClick={() => setNotesOpen(true)} className="min-h-11 text-sm font-medium text-gold">
            + Añadir nota
          </button>
        )}
      </div>
      )}
    </div>
  );
}

function firstLines(content: string): [string, string] {
  const lines = content.split("\n").map((l) => l.trim()).filter(Boolean);
  return [lines[0] ?? "Bloque", lines[1] ?? ""];
}

function blockSummary(existing: import("@/lib/store").WorkoutResult | undefined, existingWod: WodResult | null): string {
  if (existingWod) return `${formatScore(existingWod)} · ${SCALE_LABEL[existingWod.scale as WodScale] ?? existingWod.scale}`;
  if (!existing) return "";
  const parts: string[] = [];
  if (existing.weight != null) parts.push(`${formatKg(Number(existing.weight))} kg`);
  if (existing.sets != null && existing.reps != null) parts.push(`${existing.sets}×${existing.reps}`);
  else if (existing.reps != null) parts.push(`${existing.reps} reps`);
  if (existing.time_seconds != null) parts.push(formatTime(existing.time_seconds));
  if (existing.rpe != null) parts.push(`RPE ${existing.rpe}`);
  return parts.length ? parts.join(" · ") : "Registrado";
}

export function Field({ label, value, onChange, type = "text", placeholder, highlight }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; highlight?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] text-muted-foreground">{label}</span>
      <input
        type={type === "number" ? "text" : type}
        inputMode={type === "number" ? "decimal" : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`tap min-h-[52px] w-full rounded-[14px] border bg-white/[0.06] px-3.5 text-xl font-semibold tabular outline-none transition placeholder:text-sm placeholder:font-normal placeholder:text-muted-foreground/70 focus:border-[color:var(--gold)]/60 ${highlight ? "border-[color:var(--gold)]/45" : "border-white/[0.14]"}`}
      />
    </label>
  );
}
