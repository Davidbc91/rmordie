import { LinkedText } from "@/components/LinkedText";
import { usePersonalRecords, useUpsertPersonalRecord, useAllResults, usePlanning } from "@/lib/store";
import { buildBlockMovementIndex, findLastTime, mainMovementId } from "@/lib/last-time";
import { extractPercentages, extractSetsReps, extractRestSeconds } from "@/lib/plates";
import { LoadStepper, CountStepper, RpeChips, PlateLine, RestTimer } from "./QuickLog";
import {
  detectExercise,
  loadsForPercentages,
  formatKg,
  compareLoads,
  LOAD_STATUS_LABEL,
} from "@/lib/rm-matcher";
import { resolveMovementId } from "@/lib/dictionary/resolve";
import { movements } from "@/lib/dictionary/catalog";
import { Check, ChevronDown, Trophy, Timer as TimerIcon } from "lucide-react";
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
import { WodTimer, type WodTimerResult } from "./WodTimer";
import { timerConfigFor } from "@/lib/wod-timer";

/** Nuevo 1RM de fuerza detectado al guardar un bloque. */
export type StrengthPr = { exercise: string; weight: number; previous: number | null };

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
  registerPr: (fn: () => Promise<StrengthPr | null>) => void;
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
  const timerConfig = useMemo(() => timerConfigFor(content), [content]);
  const [timerOpen, setTimerOpen] = useState(false);
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
  const planSetsReps = useMemo(() => extractSetsReps(content), [content]);
  const restSeconds = useMemo(() => extractRestSeconds(content), [content]);
  const plateCfg = settings ? { bars: settings.bar_weights, plates: settings.plate_weights } : undefined;
  const detected = useMemo(() => detectExercise(content, records), [content, records]);
  const { data: allResults = [] } = useAllResults();
  const { data: planningData } = usePlanning();
  const blockIndex = useMemo(() => buildBlockMovementIndex(planningData?.data.months ?? []), [planningData]);
  const lastTime = useMemo(
    () => findLastTime(mainMovementId(content, detected?.exercise), allResults, blockIndex, contextIds),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [content, detected?.exercise, allResults, blockIndex, contextIds.month_key, contextIds.week, contextIds.day_key],
  );
  const lastNext = lastTime && lastTime.result.rpe != null ? suggestNextLoad(Number(lastTime.result.weight), Number(lastTime.result.rpe)) : null;
  const targetLoads = useMemo(
    () => (detected ? loadsForPercentages(detected.weight, pcts) : []),
    [detected, pcts],
  );

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

  // Récord con el resultado que sale del timer (no guarda nada).
  function timerPrCheck(r: WodTimerResult): string | null {
    if (!wod || !bestForScale || r.kind === "none") return null;
    if (r.kind === "time" && r.cap) return null;
    const current = {
      wod_type: wod.type,
      status: "completed",
      time_seconds: r.kind === "time" ? r.seconds : null,
      rounds: r.kind === "rounds" ? r.rounds : null,
      reps: r.kind === "rounds" ? r.reps : null,
      calories: null,
      distance: null,
    };
    const cmp = compareScores(wod.type, current, bestForScale);
    if (cmp == null || cmp <= 0) return null;
    return `${formatScore(current)} sería nuevo PR · antes ${formatScore(bestForScale)}`;
  }

  function applyTimer(r: WodTimerResult) {
    if (r.kind === "rounds") {
      setWodRounds(String(r.rounds));
      setWodReps(r.reps > 0 ? String(r.reps) : "");
    } else if (r.kind === "time") {
      setWodCap(r.cap);
      setWodTime(r.cap ? "" : formatTime(r.seconds));
    }
    setTimerOpen(false);
    setOpen(true);
  }

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

  async function maybeSaveStrengthPr(): Promise<StrengthPr | null> {
    const w = Number(weight.replace(",", ".").trim());
    const r = Number(reps);
    if (!detected || !Number.isFinite(w) || w <= 0 || r !== 1) return null;
    const movementId = resolveMovementId(detected.exercise);
    const movement = movementId ? movements.find((item) => item.id === movementId) : null;
    if (!movement?.rm) return null;
    const current = records.find((record) => (record.rep_max ?? 1) === 1 && resolveMovementId(record.exercise) === movement.id);
    if (current && w <= Number(current.weight)) return null;
    await upsertRecord.mutateAsync({ exercise: movement.name, weight: w, rep_max: 1 });
    return { exercise: movement.name, weight: w, previous: current ? Number(current.weight) : null };
  }

  // Un bloque con un ejercicio con RM o con % es de fuerza aunque sea un EMOM/E2MOM
  // («E2MOM 10: 5 Back Squat (70%)»): se muestran la carga de hoy y sus campos.
  // El resultado de WOD solo se pide si no es un EMOM de fuerza.
  const showStrength = !wod || !!detected || pcts.length > 0;
  const showWodScore = !!wod && !(wod.type === "emom" && (!!detected || pcts.length > 0));
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

        {timerConfig && (
          <div>
            <button
              type="button"
              onClick={() => setTimerOpen(true)}
              className="pressable gold-gradient flex min-h-16 w-full items-center justify-center gap-2.5 rounded-[16px]"
            >
              <TimerIcon className="h-6 w-6" strokeWidth={2.2} />
              <span className="flex flex-col items-start leading-none">
                <span className="cta-display" style={{ fontSize: "1.6rem" }}>INICIAR TIMER</span>
                <span className="mt-0.5 text-[13px] font-bold">{timerConfig.label}</span>
              </span>
            </button>
            <p className="mt-1.5 text-center text-[13px] text-muted-foreground">Ya viene configurado del plan · 10 s de cuenta atrás</p>
          </div>
        )}
        {timerOpen && timerConfig && (
          <WodTimer
            config={timerConfig}
            title={`${blockKey} · ${title}`}
            onClose={() => setTimerOpen(false)}
            onApply={applyTimer}
            prCheck={timerPrCheck}
          />
        )}

        {/* WOD: marca, escala y resultado */}
        {showWodScore && wod && (
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
            {!showStrength && <RpeChips value={rpe} onChange={setRpe} />}
            {livePr && <p className="text-[13px] font-medium text-gold">{livePr}</p>}
          </>
        )}

        {showStrength && (
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
                    onClick={() => {
                      setWeight(String(targetLoads[0].suggested));
                      if (planSetsReps) {
                        setSets(String(planSetsReps.sets));
                        setReps(String(planSetsReps.reps));
                      }
                    }}
                    className="pressable cta-display flex min-h-[52px] w-full items-center justify-center rounded-[14px] bg-[color:var(--gold)] text-[color:var(--gold-foreground)]"
                    style={{ fontSize: "1.5rem" }}
                  >
                    USAR {formatKg(targetLoads[0].suggested)} KG{planSetsReps ? ` · ${planSetsReps.sets}×${planSetsReps.reps}` : ""}
                  </button>
                )}
                {targetLoads.length > 0 && planSetsReps && (
                  <p className="text-[13px] text-muted-foreground">Rellena carga, series y reps del plan de una vez.</p>
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

            {lastTime && (
              <div className="space-y-2 rounded-[16px] border border-white/[0.1] bg-white/[0.04] p-3.5">
                <p className="text-[13px] text-muted-foreground">
                  La última vez
                  {lastTime.result.updated_at ? ` · ${new Date(lastTime.result.updated_at).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}` : ""}:{" "}
                  <span className="font-semibold text-foreground">
                    {[
                      `${formatKg(Number(lastTime.result.weight))} kg`,
                      lastTime.result.sets != null && lastTime.result.reps != null ? `${lastTime.result.sets}×${lastTime.result.reps}` : lastTime.result.reps != null ? `${lastTime.result.reps} reps` : null,
                      lastTime.result.rpe != null ? `RPE ${formatKg(Number(lastTime.result.rpe))}` : null,
                    ].filter(Boolean).join(" · ")}
                  </span>
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setWeight(String(lastTime.result.weight));
                      if (lastTime.result.sets != null) setSets(String(lastTime.result.sets));
                      if (lastTime.result.reps != null) setReps(String(lastTime.result.reps));
                    }}
                    className="pressable min-h-11 flex-1 rounded-[12px] border border-white/15 bg-white/[0.06] px-3 text-sm font-bold"
                  >
                    Repetir lo de la última vez
                  </button>
                  {lastNext && lastNext.weight !== Number(lastTime.result.weight) && (
                    <button
                      type="button"
                      onClick={() => {
                        setWeight(String(lastNext.weight));
                        if (lastTime.result.sets != null) setSets(String(lastTime.result.sets));
                        if (lastTime.result.reps != null) setReps(String(lastTime.result.reps));
                      }}
                      className="pressable min-h-11 flex-1 rounded-[12px] bg-[color:var(--gold)]/16 px-3 text-sm font-bold text-[color:var(--gold-soft)]"
                    >
                      {lastNext.weight > Number(lastTime.result.weight) ? "Subir" : "Bajar"} a {formatKg(lastNext.weight)} kg
                    </button>
                  )}
                </div>
                {lastNext && (
                  <p className="text-xs text-muted-foreground">
                    {lastNext.weight > Number(lastTime.result.weight)
                      ? `Con RPE ${formatKg(Number(lastTime.result.rpe))} te sobró margen: prueba un poco más.`
                      : lastNext.weight < Number(lastTime.result.weight)
                        ? `Con RPE ${formatKg(Number(lastTime.result.rpe))} fue al límite: mejor bajar un poco.`
                        : `Con RPE ${formatKg(Number(lastTime.result.rpe))} fue exigente: repite el peso.`}
                  </p>
                )}
              </div>
            )}

            <div>
              <LoadStepper
                value={weight}
                onChange={setWeight}
                highlight={!!detected}
                placeholder={targetLoads.length > 0 ? `${formatKg(targetLoads[0].suggested)} objetivo` : undefined}
              />
              <PlateLine total={actualLoad} cfg={plateCfg} />
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <CountStepper label="Series" value={sets} onChange={setSets} />
              <CountStepper label="Reps" value={reps} onChange={setReps} />
            </div>
            <RpeChips value={rpe} onChange={setRpe} />
            {!detected && pcts.length === 0 && (
              <div className="grid grid-cols-2 gap-2.5">
                <Field label="Tiempo (mm:ss)" value={time} onChange={setTime} placeholder="3:45" />
              </div>
            )}
            {(restSeconds != null || detected || pcts.length > 0) && <RestTimer seconds={restSeconds ?? 120} />}
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
