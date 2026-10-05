import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeft, AlertTriangle, Check, CheckCircle2, ExternalLink, KeyRound, Link2, Loader2, Search, Trash2, Upload, X } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { movements } from "@/lib/dictionary/catalog";
import { useCustomMovements } from "@/lib/dictionary/custom";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentUserId } from "@/lib/pin-gate";
import { useProfiles } from "@/lib/store";
import {
  createMovementVideoUpload,
  createCustomMovement,
  reviewMovementVideo,
  deleteMovementVideo,
  isVideoAdmin,
  MOVEMENT_VIDEO_BUCKET,
  saveMovementUpload,
  saveMovementYoutube,
  verifyVideoAdminPin,
  type MovementVideo,
  type VideoReviewStatus,
} from "@/lib/admin-videos";
import { getDictionaryVideoId } from "@/lib/dictionary/videoOverrides";

export const Route = createFileRoute("/admin/videos")({
  component: AdminVideosPage,
});

function AdminVideosPage() {
  const profileId = getCurrentUserId();
  const qc = useQueryClient();
  const { data: profiles = [] } = useProfiles();
  const isBcProfile = profiles.some((profile) => profile.id === profileId && profile.name.trim().toLowerCase() === "bc");
  const [pin, setPin] = useState("");
  const [pinHash, setPinHash] = useState<string | null>(null);
  const [pinError, setPinError] = useState("");
  const [search, setSearch] = useState("");
  const [reviewFilter, setReviewFilter] = useState<"all" | VideoReviewStatus | "missing">("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [youtubeDrafts, setYoutubeDrafts] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState("");
  const { data: customMovements = [] } = useCustomMovements();
  const allMovements = useMemo(() => [...movements, ...customMovements], [customMovements]);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newMovement, setNewMovement] = useState({
    name: "", nameEs: "", aliases: "", category: "Personalizado", equipment: "",
    level: "Intermediate" as "Beginner" | "Intermediate" | "Advanced", rm: false,
    description: "", technique: "", commonMistakes: "", progressions: "", regressions: "", muscles: "", videoUrl: "",
  });

  const { data: admin, isLoading: checking } = useQuery({
    queryKey: ["video-admin", profileId],
    queryFn: isVideoAdmin,
    enabled: !!profileId,
  });
  const { data: videos = [], isLoading: loadingVideos } = useQuery({
    queryKey: ["movement-videos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("movement_videos")
        .select("*")
        .order("movement_id");
      if (error) throw error;
      return (data ?? []) as MovementVideo[];
    },
    enabled: !!pinHash,
  });
  const { data: reviews = [], isLoading: loadingReviews } = useQuery({
    queryKey: ["movement-video-reviews"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("movement_video_reviews")
        .select("*");
      if (error) throw error;
      return (data ?? []) as Array<{
        movement_id: string;
        status: VideoReviewStatus;
        reviewed_at: string | null;
        notes: string | null;
      }>;
    },
    enabled: !!pinHash,
  });


  const reviewByMovement = useMemo(
    () => new Map(reviews.map((review) => [review.movement_id, review])),
    [reviews],
  );

  const videoByMovement = useMemo(
    () => new Map(videos.map((video) => [video.movement_id, video])),
    [videos],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allMovements.filter((movement) => {
      const matchesSearch = !q || [movement.id, movement.name, movement.nameEs].some((value) =>
        value.toLowerCase().includes(q),
      );
      if (!matchesSearch) return false;
      const hasVideo = !!videoByMovement.get(movement.id) || !!getDictionaryVideoId(movement.videoUrl);
      const status = reviewByMovement.get(movement.id)?.status ?? (hasVideo ? "pending" : null);
      if (reviewFilter === "missing") return !hasVideo;
      if (reviewFilter === "all") return true;
      return status === reviewFilter;
    });
  }, [search, reviewFilter, videoByMovement, reviewByMovement, allMovements]);

  const stats = useMemo(() => {
    let configured = 0;
    let catalogYoutube = 0;
    let verified = 0;
    let needsReview = 0;
    let pending = 0;
    for (const movement of allMovements) {
      const managed = videoByMovement.get(movement.id);
      const hasCatalogVideo = !!getDictionaryVideoId(movement.videoUrl);
      if (managed || hasCatalogVideo) configured++;
      if (!managed && hasCatalogVideo) catalogYoutube++;
      const status = reviewByMovement.get(movement.id)?.status ?? ((managed || hasCatalogVideo) ? "pending" : null);
      if (status === "verified") verified++;
      else if (status === "needs_review") needsReview++;
      else if (status === "pending") pending++;
    }
    return {
      total: allMovements.length,
      configured,
      missing: allMovements.length - configured,
      uploads: videos.filter((v) => v.source_type === "upload").length,
      youtube: videos.filter((v) => v.source_type === "youtube").length + catalogYoutube,
      verified,
      needsReview,
      pending,
    };
  }, [videoByMovement, videos, reviewByMovement, allMovements]);

  async function unlock() {
    setPinError("");
    try {
      const hash = await verifyVideoAdminPin(pin);
      setPinHash(hash);
      setPin("");
    } catch {
      setPinError("PIN incorrecto.");
    }
  }

  async function createMovement() {
    if (!pinHash) return;
    if (!newMovement.name.trim() || !newMovement.nameEs.trim()) {
      setNotice("Necesitas nombre y nombre en español.");
      return;
    }
    setCreating(true);
    setNotice("");
    const list = (value: string) => value.split(/[\\n,]/).map((x) => x.trim()).filter(Boolean);
    try {
      await createCustomMovement(pinHash, {
        name: newMovement.name,
        nameEs: newMovement.nameEs,
        aliases: list(newMovement.aliases),
        category: newMovement.category,
        equipment: list(newMovement.equipment),
        level: newMovement.level,
        rm: newMovement.rm,
        description: newMovement.description,
        technique: list(newMovement.technique),
        commonMistakes: list(newMovement.commonMistakes),
        progressions: list(newMovement.progressions),
        regressions: list(newMovement.regressions),
        muscles: list(newMovement.muscles),
        videoUrl: newMovement.videoUrl,
      });
      await qc.invalidateQueries({ queryKey: ["custom-movements"] });
      setNewMovement({
        name: "", nameEs: "", aliases: "", category: "Personalizado", equipment: "",
        level: "Intermediate", rm: false, description: "", technique: "", commonMistakes: "",
        progressions: "", regressions: "", muscles: "", videoUrl: "",
      });
      setShowCreate(false);
      setNotice("Movimiento personalizado creado. Ya forma parte del diccionario y del detector automático.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudo crear el movimiento.");
    } finally {
      setCreating(false);
    }
  }

  async function saveYoutube(movementId: string, title: string) {
    if (!pinHash) return;
    const url = (youtubeDrafts[movementId] ?? "").trim();
    if (!url) return;
    setBusy(movementId);
    setNotice("");
    try {
      await saveMovementYoutube(pinHash, movementId, title, url);
      setYoutubeDrafts((current) => ({ ...current, [movementId]: "" }));
      await qc.invalidateQueries({ queryKey: ["movement-videos"] });
      setNotice(`Vídeo actualizado: ${title}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudo guardar el vídeo.");
    } finally {
      setBusy(null);
    }
  }

  async function uploadVideo(movementId: string, title: string, file: File) {
    if (!pinHash) return;
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!["mp4", "webm", "mov"].includes(ext)) {
      setNotice("Solo se permiten MP4, WebM o MOV.");
      return;
    }

    setBusy(movementId);
    setNotice("");
    try {
      const signed = await createMovementVideoUpload(pinHash, movementId, ext);
      const { error } = await supabase.storage
        .from(MOVEMENT_VIDEO_BUCKET)
        .uploadToSignedUrl(signed.path, signed.token, file, {
          contentType: file.type || `video/${ext}`,
        });
      if (error) throw error;

      await saveMovementUpload(pinHash, movementId, title, signed.path);
      await qc.invalidateQueries({ queryKey: ["movement-videos"] });
      setNotice(`Vídeo subido: ${title}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudo subir el vídeo.");
    } finally {
      setBusy(null);
    }
  }

  async function setReview(movementId: string, status: VideoReviewStatus) {
    if (!pinHash) return;
    setBusy(movementId);
    setNotice("");
    try {
      await reviewMovementVideo(pinHash, movementId, status);
      await qc.invalidateQueries({ queryKey: ["movement-video-reviews"] });
      const label = status === "verified" ? "verificado" : status === "needs_review" ? "marcado para revisar" : "pendiente";
      setNotice(`Vídeo ${label}: ${movementId}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudo actualizar la revisión.");
    } finally {
      setBusy(null);
    }
  }

  async function removeVideo(movementId: string, title: string) {
    if (!pinHash) return;
    if (!window.confirm(`¿Eliminar el vídeo de «${title}»?`)) return;
    setBusy(movementId);
    setNotice("");
    try {
      await deleteMovementVideo(pinHash, movementId);
      await qc.invalidateQueries({ queryKey: ["movement-videos"] });
      setNotice(`Vídeo eliminado: ${title}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudo eliminar el vídeo.");
    } finally {
      setBusy(null);
    }
  }

  if (checking) {
    return <PageShell><Loading /></PageShell>;
  }

  if (!pinHash) {
    return (
      <PageShell>
        <div className="cinematic-card-strong mx-auto max-w-md rounded-[28px] p-6 sm:p-8">
          <div className="grid h-12 w-12 place-items-center rounded-2xl border border-[rgba(200,169,107,.24)] bg-white/[.035] text-[var(--gold)]">
            <KeyRound className="h-5 w-5" />
          </div>
          <span className="cinematic-label mt-6 block">ADMIN ACCESS</span>
          <h1 className="cinematic-title mt-2">Gestión de vídeos</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Introduce el PIN de tu perfil BC para gestionar los vídeos del diccionario.
          </p>
          <input
            type="password"
            inputMode="numeric"
            autoComplete="off"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void unlock(); }}
            placeholder="PIN"
            className="mt-6 h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-center text-lg tracking-[.35em] outline-none focus:border-[var(--gold)]"
          />
          {pinError && <p className="mt-3 text-sm text-red-300">{pinError}</p>}
          <button
            type="button"
            onClick={() => void unlock()}
            disabled={!pin}
            className="mt-4 h-12 w-full rounded-2xl gold-gradient font-semibold"
            style={{ color: "var(--gold-foreground)" }}
          >
            Entrar
          </button>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="flex items-start justify-between gap-4">
        <div>
          <span className="cinematic-label">ADMIN / MOVEMENT VIDEOS</span>
          <h1 className="cinematic-title mt-2">Vídeos</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            180 movimientos · asociación por ID estable.
          </p>
        </div>
        <button
          type="button"
          onClick={() => { setPinHash(null); setNotice(""); }}
          className="rounded-full border border-white/10 px-3 py-2 text-xs text-muted-foreground hover:text-foreground"
        >
          Cerrar
        </button>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <AdminStat label="Movimientos" value={stats.total} />
        <AdminStat label="Con vídeo" value={stats.configured} />
        <AdminStat label="YouTube" value={stats.youtube} />
        <AdminStat label="Subidos" value={stats.uploads} />
        <AdminStat label="Verificados" value={stats.verified} />
        <AdminStat label="A revisar" value={stats.needsReview} />
      </div>

      {notice && (
        <div className="mt-4 flex items-center gap-2 rounded-2xl border border-[rgba(200,169,107,.2)] bg-white/[.03] px-4 py-3 text-sm">
          <Check className="h-4 w-4 shrink-0 text-[var(--gold)]" />
          <span>{notice}</span>
        </div>
      )}

      <div className="mt-5 cinematic-card-strong rounded-[24px] p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="cinematic-label">DICCIONARIO</span>
            <h2 className="mt-1 text-lg font-semibold">Crear movimiento personalizado</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Añade un movimiento que no exista en el catálogo. Quedará disponible para todos y el detector podrá reconocerlo.
            </p>
          </div>
          <button type="button" onClick={() => setShowCreate((v) => !v)} className="shrink-0 rounded-xl border border-[rgba(200,169,107,.3)] px-3 py-2 text-xs font-semibold text-[var(--gold)]">
            {showCreate ? "Cerrar" : "Nuevo"}
          </button>
        </div>

        {showCreate && (
          <form onSubmit={(e) => { e.preventDefault(); void createMovement(); }} className="mt-5 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Nombre"><input required value={newMovement.name} onChange={(e) => setNewMovement((s) => ({ ...s, name: e.target.value }))} placeholder="Ej. Cyclist Squat" /></Field>
              <Field label="Nombre en español"><input required value={newMovement.nameEs} onChange={(e) => setNewMovement((s) => ({ ...s, nameEs: e.target.value }))} placeholder="Ej. Sentadilla ciclista" /></Field>
              <Field label="Alias, separados por coma"><input value={newMovement.aliases} onChange={(e) => setNewMovement((s) => ({ ...s, aliases: e.target.value }))} placeholder="cyclist squat, heel elevated squat" /></Field>
              <Field label="Categoría"><input value={newMovement.category} onChange={(e) => setNewMovement((s) => ({ ...s, category: e.target.value }))} placeholder="Fuerza" /></Field>
              <Field label="Equipamiento"><input value={newMovement.equipment} onChange={(e) => setNewMovement((s) => ({ ...s, equipment: e.target.value }))} placeholder="Barra, discos" /></Field>
              <Field label="Nivel">
                <select value={newMovement.level} onChange={(e) => setNewMovement((s) => ({ ...s, level: e.target.value as typeof s.level }))}>
                  <option>Beginner</option><option>Intermediate</option><option>Advanced</option>
                </select>
              </Field>
            </div>
            <Field label="Descripción"><textarea value={newMovement.description} onChange={(e) => setNewMovement((s) => ({ ...s, description: e.target.value }))} rows={3} placeholder="Qué es y para qué sirve..." /></Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Técnica, una línea por paso"><textarea value={newMovement.technique} onChange={(e) => setNewMovement((s) => ({ ...s, technique: e.target.value }))} rows={4} placeholder={"Postura inicial\nEjecuta el movimiento\nFinaliza..."}/></Field>
              <Field label="Errores frecuentes"><textarea value={newMovement.commonMistakes} onChange={(e) => setNewMovement((s) => ({ ...s, commonMistakes: e.target.value }))} rows={4} placeholder={"Rodillas colapsan\nPierdes tensión..."}/></Field>
              <Field label="Progresiones"><textarea value={newMovement.progressions} onChange={(e) => setNewMovement((s) => ({ ...s, progressions: e.target.value }))} rows={3} /></Field>
              <Field label="Regresiones"><textarea value={newMovement.regressions} onChange={(e) => setNewMovement((s) => ({ ...s, regressions: e.target.value }))} rows={3} /></Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Músculos"><input value={newMovement.muscles} onChange={(e) => setNewMovement((s) => ({ ...s, muscles: e.target.value }))} placeholder="Cuádriceps, glúteos" /></Field>
              <Field label="Vídeo YouTube"><input value={newMovement.videoUrl} onChange={(e) => setNewMovement((s) => ({ ...s, videoUrl: e.target.value }))} placeholder="https://youtube.com/..." /></Field>
              <label className="flex min-h-11 items-center gap-2 rounded-xl border border-white/8 bg-black/15 px-3 text-xs">
                <input type="checkbox" checked={newMovement.rm} onChange={(e) => setNewMovement((s) => ({ ...s, rm: e.target.checked }))} />
                <span>Usar para RM</span>
              </label>
            </div>
            <button type="submit" disabled={creating} className="h-12 w-full rounded-2xl gold-gradient font-semibold disabled:opacity-50" style={{ color: "var(--gold-foreground)" }}>
              {creating ? "Creando ficha..." : "Crear ficha personalizada"}
            </button>
          </form>
        )}
      </div>

      <div className="cinematic-card-dark mt-5 flex items-center gap-3 rounded-2xl px-4 py-3">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar movimiento..."
          className="min-w-0 flex-1 bg-transparent text-sm outline-none"
        />
        {search && (
          <button type="button" onClick={() => setSearch("")} aria-label="Limpiar búsqueda">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
      </div>

      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {[
          ["all", "Todos"],
          ["pending", "Pendientes"],
          ["needs_review", "A revisar"],
          ["verified", "Verificados"],
          ["missing", "Sin vídeo"],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setReviewFilter(value as typeof reviewFilter)}
            className={`shrink-0 rounded-full border px-3 py-2 text-xs font-semibold ${reviewFilter === value ? "border-[var(--gold)] bg-[var(--gold)]/10 text-[var(--gold)]" : "border-white/10 text-muted-foreground"}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        {loadingVideos ? <Loading /> : filtered.map((movement) => {
          const video = videoByMovement.get(movement.id);
          const isBusy = busy === movement.id;
          const catalogVideoId = getDictionaryVideoId(movement.videoUrl);
          const catalogVideoUrl = catalogVideoId ? `https://www.youtube.com/watch?v=${catalogVideoId}` : null;
          const hasCatalogVideo = !video && !!catalogVideoUrl;
          const review = reviewByMovement.get(movement.id);
          const reviewStatus = review?.status ?? (video || hasCatalogVideo ? "pending" : null);
          const previewUrl = video?.storage_path
            ? supabase.storage.from(MOVEMENT_VIDEO_BUCKET).getPublicUrl(video.storage_path).data.publicUrl
            : video?.youtube_url ?? catalogVideoUrl;

          return (
            <div key={movement.id} className="cinematic-card-strong rounded-[24px] p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <span className="cinematic-label">{movement.id}</span>
                  <h2 className="mt-1 text-base font-semibold">{movement.name}</h2>
                  <p className="text-xs text-muted-foreground">{movement.nameEs}</p>
                </div>
                <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[.14em] ${video ? "border-[rgba(200,169,107,.28)] text-[var(--gold)]" : "border-white/10 text-muted-foreground"}`}>
                  {video ? video.source_type : hasCatalogVideo ? "catálogo" : "sin vídeo"}
                </span>
              </div>

              {reviewStatus && (
                <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-black/15 px-3 py-2">
                  <span className="inline-flex items-center gap-2 text-xs">
                    {reviewStatus === "verified" ? <CheckCircle2 className="h-4 w-4 text-[var(--gold)]" /> : <AlertTriangle className="h-4 w-4 text-amber-300" />}
                    <span className={reviewStatus === "verified" ? "text-[var(--gold)]" : "text-muted-foreground"}>
                      {reviewStatus === "verified" ? "Verificado" : reviewStatus === "needs_review" ? "Revisar" : "Pendiente de revisión"}
                    </span>
                  </span>
                  <div className="flex gap-1.5">
                    {reviewStatus !== "verified" && (
                      <button type="button" onClick={() => void setReview(movement.id, "verified")} disabled={isBusy} className="rounded-xl border border-white/10 px-2.5 py-1.5 text-[11px] font-semibold">✓ Verificado</button>
                    )}
                    {reviewStatus !== "needs_review" && (
                      <button type="button" onClick={() => void setReview(movement.id, "needs_review")} disabled={isBusy} className="rounded-xl border border-white/10 px-2.5 py-1.5 text-[11px] font-semibold">Revisar</button>
                    )}
                  </div>
                </div>
              )}

              {previewUrl && (
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-[var(--gold)]"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Abrir vídeo actual{hasCatalogVideo ? " · vídeo del catálogo" : ""}
                </a>
              )}

              <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto]">
                <div className="flex min-w-0 items-center gap-2 rounded-2xl border border-white/8 bg-black/20 px-3">
                  <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <input
                    value={youtubeDrafts[movement.id] ?? ""}
                    onChange={(e) => setYoutubeDrafts((current) => ({ ...current, [movement.id]: e.target.value }))}
                    placeholder="Pegar URL exacta de YouTube"
                    className="min-w-0 flex-1 bg-transparent py-3 text-xs outline-none"
                    disabled={isBusy}
                  />
                  <button
                    type="button"
                    onClick={() => void saveYoutube(movement.id, movement.name)}
                    disabled={isBusy || !(youtubeDrafts[movement.id] ?? "").trim()}
                    className="rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold disabled:opacity-40"
                  >
                    Guardar
                  </button>
                </div>

                <label className="pressable inline-flex cursor-pointer items-center justify-center gap-2 rounded-2xl gold-gradient px-4 py-3 text-xs font-bold sm:min-w-40" style={{ color: "var(--gold-foreground)" }}>
                  {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  Subir vídeo
                  <input
                    type="file"
                    accept="video/mp4,video/webm,video/quicktime"
                    className="sr-only"
                    disabled={isBusy}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void uploadVideo(movement.id, movement.name, file);
                      e.currentTarget.value = "";
                    }}
                  />
                </label>
              </div>

              {video && (
                <button
                  type="button"
                  onClick={() => void removeVideo(movement.id, movement.name)}
                  disabled={isBusy}
                  className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-red-300 disabled:opacity-40"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Eliminar vídeo
                </button>
              )}
            </div>
          );
        })}
      </div>
    </PageShell>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="cinematic-page space-y-5 pb-8">
      <Link
        to="/dictionary"
        className="inline-flex min-h-10 items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Diccionario
      </Link>
      {children}
    </div>
  );
}

function Loading() {
  return (
    <div className="cinematic-card-dark flex items-center justify-center rounded-2xl p-8 text-sm text-muted-foreground">
      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Cargando…
    </div>
  );
}

function AdminStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="cinematic-card-dark rounded-2xl p-3">
      <p className="cinematic-label">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular">{value}</p>
    </div>
  );
}


function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[.18em] text-muted-foreground">{label}</span>
      <span className="[&_input]:min-h-11 [&_input]:w-full [&_input]:rounded-xl [&_input]:border [&_input]:border-white/10 [&_input]:bg-black/20 [&_input]:px-3 [&_input]:text-sm [&_input]:outline-none [&_textarea]:w-full [&_textarea]:rounded-xl [&_textarea]:border [&_textarea]:border-white/10 [&_textarea]:bg-black/20 [&_textarea]:px-3 [&_textarea]:py-3 [&_textarea]:text-sm [&_textarea]:outline-none [&_select]:min-h-11 [&_select]:w-full [&_select]:rounded-xl [&_select]:border [&_select]:border-white/10 [&_select]:bg-black/20 [&_select]:px-3 [&_select]:text-sm [&_select]:outline-none">
        {children}
      </span>
    </label>
  );
}
