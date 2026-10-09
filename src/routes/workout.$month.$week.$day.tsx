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
import { ChevronLeft, CheckCheck, MoreHorizontal, Share2, Undo2 } from "lucide-react";
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
  const [menuOpen, setMenuOpen] = useState(false);

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

  const isBlockDone = (key: string) => results.some((r) => r.block_key === key) || dayWods.some((r) => r.block_key === key);
  const doneCount = d.blocks.filter((b) => isBlockDone(b.key)).length;
  // Se abre solo el primer bloque pendiente; los hechos quedan cerrados con su resumen.
  const firstPendingKey = d.blocks.find((b) => !isBlockDone(b.key))?.key ?? null;

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
      <div className="mb-2 flex items-center justify-between">
        <Link
          to="/calendar"
          className="flex min-h-11 items-center gap-1 text-[15px] text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-[18px] w-[18px]" /> Plan
        </Link>
        {!d.isRest && (
          <div className="relative">
            <button
              type="button"
              aria-label="Más opciones"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
              className="grid h-11 w-11 place-items-center rounded-full bg-white/[0.06] text-foreground"
            >
              <MoreHorizontal className="h-5 w-5" />
            </button>
            {menuOpen && (
              <>
                <button type="button" aria-label="Cerrar menú" className="fixed inset-0 z-40 cursor-default" onClick={() => setMenuOpen(false)} />
                <div role="menu" className="absolute right-0 top-12 z-50 w-64 overflow-hidden rounded-2xl border border-white/10 bg-[#141412] shadow-2xl">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => { setMenuOpen(false); void shareToday(); }}
                    disabled={sharingCard}
                    className="flex min-h-12 w-full items-center gap-3 px-4 text-left text-[15px] disabled:opacity-50"
                  >
                    <Share2 className="h-4 w-4 text-muted-foreground" />
                    {sharingCard ? "Generando imagen…" : "Compartir imagen del entreno"}
                  </button>
                  {(results.length > 0 || dayWods.length > 0) && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => { setMenuOpen(false); void unmarkWorkout(); }}
                      disabled={deleteWorkoutResults.isPending || deleteWodResult.isPending}
                      className="flex min-h-12 w-full items-center gap-3 border-t border-white/10 px-4 text-left text-[15px] text-red-300 disabled:opacity-50"
                    >
                      <Undo2 className="h-4 w-4" />
                      {deleteWorkoutResults.isPending || deleteWodResult.isPending ? "Desmarcando…" : "Desmarcar entreno"}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <header className="rise rise-1 mb-4 space-y-2.5 px-1">
        <p className="text-[13px] tracking-[0.12em] text-muted-foreground">{mo.label.toUpperCase()} · SEMANA {weekN}</p>
        <div className="flex items-end justify-between gap-4">
          <h1 className="display-lg min-w-0 truncate gold-text">{d.key}</h1>
          {!d.isRest && (
            <p className="shrink-0 text-right text-[13px] text-muted-foreground">
              <span className="text-2xl font-bold tabular text-foreground">{doneCount}</span>/{d.blocks.length} hechos
            </p>
          )}
        </div>
        {!d.isRest && d.blocks.length > 0 && (
          <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.09]" aria-hidden>
            <div className="h-full rounded-full bg-[color:var(--gold)] transition-[width] duration-500" style={{ width: `${(doneCount / d.blocks.length) * 100}%` }} />
          </div>
        )}
      </header>

      {d.isRest && (
        <div className="glass glass-sheen p-6 text-center">
          <p className="text-sm text-muted-foreground">Día de descanso y movilidad</p>
        </div>
      )}

      <div className="space-y-3">
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
              defaultOpen={b.key === firstPendingKey}
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

      {d.blocks.length > 0 && (
        <button
          onClick={saveAll}
          disabled={savingAll}
          className="pressable gold-gradient mt-5 flex min-h-[60px] w-full flex-col items-center justify-center rounded-[18px] disabled:opacity-45"
        >
          <span className="flex items-center gap-2 text-[17px] font-bold">
            <CheckCheck className="h-[18px] w-[18px]" />
            {savingAll ? "Guardando entreno…" : "Guardar entreno completo"}
          </span>
          {!savingAll && <span className="text-xs font-medium opacity-75">{doneCount}/{d.blocks.length} bloques registrados</span>}
        </button>
      )}
    </AppShell>
  );
}
