import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { PageSkeleton } from "@/components/PageSkeleton";
import {
  usePlanning,
  useDayResults,
  useSaveResult,
  useDeleteWorkoutResults,
  useSettings,
  findDay,
} from "@/lib/store";
import { formatKg } from "@/lib/rm-matcher";
import { ChevronLeft, CheckCheck, Share2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { setActiveWorkout, clearActiveWorkout, clearDraft } from "@/lib/active-workout";
import { formatScore, formatDelta, SCALE_LABEL, WOD_TYPE_LABEL } from "@/lib/wod";
import {
  useWodResults,
  useSaveWodResult,
  useDeleteWodResult,
  type WodSaveInput,
  type PrOutcome,
} from "@/lib/wod-store";
import { PrCelebration, type PrCelebrationData } from "@/components/PrCelebration";
import { useCreatePost } from "@/lib/social";
import { useWellnessLogs } from "@/lib/profile-store";
import { getCurrentUserId } from "@/lib/pin-gate";
import { downloadSessionReport } from "@/lib/session-report";
import { renderWorkoutCard, shareOrDownloadCard } from "@/lib/share-card";
import { WorkoutReview, WorkoutReviewCard } from "@/components/workout/WorkoutReviewCard";
import { BlockPayload, BlockCard } from "@/components/workout/BlockCard";

export const Route = createFileRoute("/workout/$month/$week/$day")({
  head: () => ({ meta: [{ title: "Entrenamiento — RMORDIE" }] }),
  component: WorkoutPage,
});

function WorkoutPage() {
  const { month, week, day } = Route.useParams();
  const weekN = Number(week);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: planning, isLoading: planningLoading } = usePlanning();
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
  const [sharingCard, setSharingCard] = useState(false);

  useEffect(() => {
    setActiveWorkout({ month, week: weekN, day, label: `${month} · S${weekN} · ${day}` });
  }, [month, weekN, day]);

  const dayWods = useMemo(
    () => wodResults.filter((r) => r.month_key === month && r.week === weekN && r.day_key === day),
    [wodResults, month, weekN, day],
  );

  if (!planning && planningLoading) return <AppShell><PageSkeleton label="Cargando entreno" variant="workout" /></AppShell>;
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
    if (!d || !mo) return;
    setSharingCard(true);
    try {
      const loads = (results as any[]).map((r) => ({
        block: r.block_key,
        weight: r.weight ?? null,
        sets: r.sets ?? null,
        reps: r.reps ?? null,
      }));
      const volume = loads.reduce((a, l) => a + (Number(l.weight) || 0) * (Number(l.sets) || 0) * (Number(l.reps) || 0), 0);
      const blob = await renderWorkoutCard({
        title: d.key,
        subtitle: `${mo.label} · Semana ${weekN}`,
        date: new Date().toLocaleDateString("es-ES"),
        blocks: d.blocks.map((b) => ({ key: b.key, content: b.content })),
        loads,
        volume,
      });
      const outcome = await shareOrDownloadCard(blob, `entreno-${month}-s${weekN}-${day}.png`);
      toast.success(outcome === "shared" ? "Imagen del entreno compartida" : "Imagen del entreno descargada");
    } catch (e: any) {
      if (e?.name !== "AbortError") toast.error(e?.message ?? "No se pudo generar la imagen del entreno");
    } finally {
      setSharingCard(false);
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
          disabled={sharingCard}
          className="pressable mb-4 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-[var(--r-lg)] border border-[color:var(--gold)]/30 bg-[color:var(--gold)]/8 text-sm font-semibold disabled:opacity-50"
        >
          <Share2 className="h-4 w-4" />
          {sharingCard ? "Generando imagen…" : "Compartir imagen del entreno"}
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
