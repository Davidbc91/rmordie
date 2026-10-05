import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { LinkedText } from "@/components/LinkedText";
import { usePlanning, useDayResults, useSaveResult, useDeleteWorkoutResults, useSettings, usePersonalRecords, findDay, useUpsertPersonalRecord } from "@/lib/store";
import { extractPercentages, roundToPlates } from "@/lib/plates";
import { detectExercise, loadsForPercentages, formatKg, compareLoads, LOAD_STATUS_LABEL } from "@/lib/rm-matcher";
import { resolveMovementId } from "@/lib/dictionary/resolve";
import { movements } from "@/lib/dictionary/catalog";
import { ChevronLeft, Sparkles, Check, CheckCheck, Timer, Trophy, Share2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
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
import { useWodResults, useSaveWodResult, useDeleteWodResult, type WodResult, type WodSaveInput, type PrOutcome } from "@/lib/wod-store";
import { WodScoreFields } from "@/components/WodRecords";
import { PrCelebration, type PrCelebrationData } from "@/components/PrCelebration";
import { useCreatePost } from "@/lib/social";
import { useWellnessLogs } from "@/lib/profile-store";
import { getCurrentUserId } from "@/lib/pin-gate";
import { downloadSessionReport, type SessionReportLoad, type SessionReportWod } from "@/lib/session-report";

export const Route = createFileRoute("/workout/$month/$week/$day")({
  head: () => ({ meta: [{ title: "Entrenamiento — RMORDIE" }] }),
  component: WorkoutPage,
});

type WorkoutReview = {
  volume: number;
  avgRpe: number | null;
  blocks: number;
  prs: number;
  estimatedBest: number | null;
  recovery: { sleep: number | null; energy: number | null; mood: number | null } | null;
  recommendation: string;
  loads: SessionReportLoad[];
  wods: SessionReportWod[];
};

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
  const queryClient = useQueryClient();
  const { data: planning } = usePlanning();
  const { data: results = [] } = useDayResults(month, weekN, day);
  const { data: wodResults = [] } = useWodResults();
  const { data: settings } = useSettings();
  const save = useSaveResult();
  const deleteWorkoutResults = useDeleteWorkoutResults();
  const saveWod = useSaveWodResult();
  const deleteWodResult = useDeleteWodResult();
  const createPost = useCreatePost();
  const { data: wellnessLogs = [] } = useWellnessLogs();
  const formsRef = useRef<Record<string, () => BlockPayload>>({});
  const prRef = useRef<Record<string, () => Promise<boolean>>>({});
  const wodRef = useRef<Record<string, () => WodSaveInput | null>>({});
  const [savingAll, setSavingAll] = useState(false);
  const [celebrate, setCelebrate] = useState<{ data: PrCelebrationData; outcome: PrOutcome } | null>(null);
  const [review, setReview] = useState<WorkoutReview | null>(null);

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

  async function unmarkWorkout() {
    if (results.length === 0 && dayWods.length === 0) return;
    const confirmed = window.confirm(
      "¿Quieres desmarcar este entreno? Se eliminarán las cargas, RPE, notas y resultado del WOD registrados para este día. Los 1RM ya confirmados no se borrarán."
    );
    if (!confirmed) return;
    try {
      await deleteWorkoutResults.mutateAsync({ month_key: month, week: weekN, day_key: day });
      const wodDeletes = dayWods.map((w) => w.id);
      if (wodDeletes.length) {
        await Promise.all(wodDeletes.map((id) => deleteWodResult.mutateAsync(id)));
      }
      d!.blocks.forEach((b) => clearDraft(month, weekN, day, b.key));
      setReview(null);
      clearActiveWorkout();
      toast.success("Entreno desmarcado");
    } catch (error: any) {
      toast.error(error?.message ?? "No se pudo desmarcar el entreno");
    }
  }

  async function saveAll() {
    const entries = Object.entries(formsRef.current);
    if (entries.length === 0) return;
    setSavingAll(true);
    try {
      const prs: PrOutcome[] = [];
      const wodOutcomes: PrOutcome[] = [];
      const payloads: BlockPayload[] = [];
      for (const [blockKey, get] of entries) {
        const block = get();
        payloads.push(block);
        await save.mutateAsync({ month_key: month, week: weekN, day_key: day, ...block });
        const strengthPr = await prRef.current[blockKey]?.();
        if (strengthPr) toast.success(`Nuevo 1RM: ${formatKg(Number(block.weight))} kg`);
        const out = await persistWod(blockKey);
        if (out) {
          wodOutcomes.push(out);
          if (out.kind === "pr" || out.kind === "matched") prs.push(out);
        }
      }
      const weightedRpes = payloads.filter((b) => b.rpe != null);
      const avgRpe = weightedRpes.length
        ? weightedRpes.reduce((sum, b) => sum + Number(b.rpe), 0) / weightedRpes.length
        : null;
      const volume = payloads.reduce((sum, b) => {
        if (b.weight == null || b.reps == null) return sum;
        const sets = b.sets && b.sets > 0 ? b.sets : 1;
        return sum + b.weight * b.reps * sets;
      }, 0);
      const latestRecovery = [...wellnessLogs]
        .sort((a, b) => String(b.logged_on ?? "").localeCompare(String(a.logged_on ?? "")))[0];
      const recovery = latestRecovery
        ? { sleep: latestRecovery.sleep_hours, energy: latestRecovery.energy, mood: latestRecovery.mood }
        : null;
      const recommendation = avgRpe == null
        ? "Sigue registrando RPE para afinar las recomendaciones."
        : avgRpe >= 9
          ? "La sesión ha sido exigente. Prioriza recuperación y consolida la carga antes de subir."
          : avgRpe <= 7
            ? "Has dejado margen. Si la técnica y la recuperación acompañan, puedes valorar progresar."
            : "Carga bien controlada. Mantén la progresión y observa cómo responde el siguiente entrenamiento.";
      // Force the completed results into the active query cache before
      // returning to the dashboard. This prevents the dashboard from briefly
      // showing the session we have just completed.
      const uid = getCurrentUserId();
      if (uid) {
        await queryClient.refetchQueries({
          queryKey: ["results", uid, "all"],
          type: "all",
        });
        await queryClient.refetchQueries({
          queryKey: ["results", uid, month, weekN, day],
          type: "all",
        });
      }

      setReview({
        volume,
        avgRpe,
        blocks: payloads.length,
        prs: prs.filter((p) => p.kind === "pr").length,
        estimatedBest: null,
        recovery,
        recommendation,
        loads: payloads.map((p) => ({ block: p.block_key, weight: p.weight, sets: p.sets, reps: p.reps, rpe: p.rpe, notes: p.notes })),
        wods: wodOutcomes.map((out) => ({
          name: out.wod_name,
          type: WOD_TYPE_LABEL[out.wod_type],
          scale: SCALE_LABEL[out.scale],
          result: formatScore(out.result),
          status: out.result.status === "cap" ? "CAP" : "Completado",
          isPr: out.kind === "pr",
        })),
      });
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

  async function shareToday() {
    const loads = (results as any[]).map((r) => ({ block: r.block_key, weight: r.weight ?? null, sets: r.sets ?? null, reps: r.reps ?? null, rpe: r.rpe ?? null, notes: r.notes ?? null }));
    const rpes = loads.map((l) => l.rpe).filter((x): x is number => typeof x === "number");
    const volume = loads.reduce((a, l) => a + (Number(l.weight) || 0) * (Number(l.sets) || 0) * (Number(l.reps) || 0), 0);
    try {
      await createPost.mutateAsync({
        kind: "workout",
        caption: `Entreno de hoy · ${month} · S${weekN} · ${day} #workout #rmordie`,
        data: {
          month, week: weekN, day,
          volume,
          avg_rpe: rpes.length ? Math.round((rpes.reduce((a, b) => a + b, 0) / rpes.length) * 10) / 10 : null,
          blocks: d?.blocks.length ?? 0,
          prs: 0,
          loads,
          wods: [],
        },
      });
      toast.success("Entreno compartido con tus compañeros");
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo compartir el entreno");
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
      {review && (
        <WorkoutReviewCard
        review={review}
        onClose={() => { setReview(null); navigate({ to: "/" }); }}
        onDownload={() => downloadSessionReport({ title: `${month} · Semana ${weekN} · ${day}`, date: new Date().toLocaleDateString("es-ES"), rpe: review.avgRpe, loads: review.loads, wods: review.wods })}
        sharing={createPost.isPending}
        onShare={async () => {
          try {
            await createPost.mutateAsync({
              kind: "workout",
              caption: `Entreno completado · ${month} · S${weekN} · ${day} #workout #rmordie`,
              data: {
                month,
                week: weekN,
                day,
                volume: review.volume,
                avg_rpe: review.avgRpe,
                blocks: review.blocks,
                prs: review.prs,
                loads: review.loads,
                wods: review.wods,
              },
            });
            toast.success("Entreno compartido en tu feed");
          } catch (e: any) {
            toast.error(e?.message ?? "No se pudo compartir el entreno");
          }
        }}
      />
      )}

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

      {!d.isRest && (
        <button
          type="button"
          onClick={shareToday}
          disabled={createPost.isPending}
          className="pressable mb-4 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-[var(--r-lg)] border border-[color:var(--gold)]/30 bg-[color:var(--gold)]/8 text-sm font-semibold disabled:opacity-50"
        >
          <Share2 className="h-4 w-4" />
          {createPost.isPending ? "Compartiendo…" : "Compartir entreno con mis compañeros"}
        </button>
      )}

      {(results.length > 0 || dayWods.length > 0) && (
        <button
          type="button"
          onClick={unmarkWorkout}
          disabled={deleteWorkoutResults.isPending || deleteWodResult.isPending}
          className="pressable mb-4 flex min-h-[48px] w-full items-center justify-center rounded-[var(--r-lg)] border border-red-400/25 bg-red-500/5 text-sm font-semibold text-red-300 disabled:opacity-50"
        >
          {deleteWorkoutResults.isPending || deleteWodResult.isPending ? "Desmarcando entreno…" : "Desmarcar entreno realizado por error"}
        </button>
      )}

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
              registerPr={(fn) => { prRef.current[b.key] = fn; }}
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


function WorkoutReviewCard({ review, onClose, onDownload, onShare, sharing }: { review: WorkoutReview; onClose: () => void; onDownload: () => void; onShare: () => void | Promise<void>; sharing: boolean }) {
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 p-3 backdrop-blur-sm sm:items-center">
      <div className="cinematic-card-strong max-h-[calc(100dvh-1.5rem)] w-full max-w-lg overflow-y-auto overscroll-contain rounded-[28px] p-5 pb-[max(env(safe-area-inset-bottom),1.5rem)] sm:max-h-[90vh] sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="cinematic-label">POST-WORKOUT REVIEW</span>
            <h2 className="cinematic-title mt-2">Sesión completada</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-muted-foreground">Cerrar</button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <ReviewStat label="Volumen" value={review.volume > 0 ? `${Math.round(review.volume).toLocaleString("es-ES")} kg` : "—"} />
          <ReviewStat label="RPE medio" value={review.avgRpe != null ? review.avgRpe.toFixed(1) : "—"} />
          <ReviewStat label="Bloques" value={String(review.blocks)} />
          <ReviewStat label="PRs" value={String(review.prs)} />
        </div>

        <div className="cinematic-card-dark mt-4 rounded-2xl p-4">
          <p className="cinematic-label">LECTURA DE LA SESIÓN</p>
          <p className="mt-2 text-sm leading-relaxed text-foreground/90">{review.recommendation}</p>
        </div>

        {review.recovery && (
          <div className="mt-3 grid grid-cols-3 gap-2">
            <ReviewStat label="Sueño" value={review.recovery.sleep != null ? `${review.recovery.sleep} h` : "—"} />
            <ReviewStat label="Energía" value={review.recovery.energy != null ? String(review.recovery.energy) : "—"} />
            <ReviewStat label="Ánimo" value={review.recovery.mood != null ? String(review.recovery.mood) : "—"} />
          </div>
        )}

        <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <button type="button" onClick={onShare} disabled={sharing} className="pressable flex h-12 items-center justify-center gap-2 rounded-2xl border border-[color:var(--gold)]/30 bg-[color:var(--gold)]/8 font-semibold disabled:opacity-50">
            <Share2 className="h-4 w-4" />
            {sharing ? "Compartiendo…" : "Compartir entreno"}
          </button>
          <button type="button" onClick={onDownload} className="pressable h-12 rounded-2xl border border-white/10 bg-white/5 font-semibold">
            Generar informe
          </button>
          <button type="button" onClick={onClose} className="pressable h-12 rounded-2xl gold-gradient font-semibold" style={{ color: "var(--gold-foreground)" }}>
            Continuar
          </button>
        </div>
      </div>
    </div>
  );
}

function ReviewStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="cinematic-card-dark rounded-2xl p-3">
      <p className="cinematic-label">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular">{value}</p>
    </div>
  );
}

function suggestNextLoad(weight: number, rpe: number): { weight: number; reason: string } | null {
  if (!Number.isFinite(weight) || weight <= 0 || !Number.isFinite(rpe) || rpe < 1 || rpe > 10) return null;
  const step = rpe <= 7 ? 2.5 : rpe === 8 ? 1.25 : rpe === 9 ? 0 : -2.5;
  return { weight: Math.max(0, Math.round((weight + step) * 2) / 2), reason: rpe <= 7 ? "RPE bajo" : rpe === 8 ? "RPE controlado" : rpe === 9 ? "RPE alto" : "RPE máximo" };
}

function estimateOneRm(weight: number, reps: number): number | null {
  if (!Number.isFinite(weight) || weight <= 0 || !Number.isInteger(reps) || reps < 2 || reps > 10) return null;
  // Epley: useful as an estimate, never treated as a confirmed 1RM.
  return Math.round((weight * (1 + reps / 30)) * 2) / 2;
}

function BlockCard({
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

function PercentAssistant({ percentages, settings, record }: {
  percentages: number[];
  settings: import("@/lib/store").AppSettings;
  record: import("@/lib/store").PersonalRecord | null;
}) {
  const [oneRm, setOneRm] = useState<string>("");
  const cfg = { bars: settings.bar_weights, plates: settings.plate_weights };
  const manualRm = Number(oneRm);

  // Automatic mode: exercise detected in the planning and RM found in records.
  if (record) {
    const loads = loadsForPercentages(record.weight, percentages);
    return (
      <div className="mt-4 rounded-[var(--r-md)] border border-[rgba(216,180,107,0.3)] bg-[rgba(216,180,107,0.06)] p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-medium text-gold">
            <Sparkles className="h-3.5 w-3.5" /> Cargas según tu RM
          </div>
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {record.exercise} · RM {formatKg(record.weight)} kg
          </span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {loads.map((l) => (
            <div key={l.pct} className="glass-quiet px-3 py-2 text-xs text-foreground">
              <span className="text-muted-foreground">{l.pct}%</span>
              <span className="mx-2 text-muted-foreground/50">→</span>
              <span className="font-semibold text-gold tabular">{formatKg(l.suggested)} kg</span>
              <span className="ml-1 text-muted-foreground/60">({l.exact.toFixed(1)})</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-[var(--r-md)] border border-[rgba(216,180,107,0.3)] bg-[rgba(216,180,107,0.06)] p-4">
      <div className="flex items-center gap-2 text-xs font-medium text-gold">
        <Sparkles className="h-3.5 w-3.5" /> Asistente de %
      </div>
      <p className="mt-1.5 text-[11px] text-muted-foreground">RM no disponible para este ejercicio</p>
      <div className="mt-3 flex items-center gap-2">
        <input
          type="text"
          inputMode="decimal"
          placeholder="Tu 1RM (kg)"
          value={oneRm}
          onChange={(e) => setOneRm(e.target.value)}
          className="tap w-32 rounded-[var(--r-md)] border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] px-3.5 py-3 text-[15px] text-foreground tabular outline-none placeholder:text-muted-foreground/70 focus:border-[rgba(216,180,107,0.55)]"
        />
        <span className="text-xs text-muted-foreground">→ peso recomendado, redondeado a tus discos</span>
      </div>
      {manualRm > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {percentages.map((p) => {
            const target = (manualRm * p) / 100;
            const rec = roundToPlates(target, cfg);
            return (
              <div key={p} className="glass-quiet px-3 py-2 text-xs text-foreground">
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
