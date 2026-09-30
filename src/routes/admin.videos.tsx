import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeft, Check, ExternalLink, KeyRound, Link2, Loader2, Search, Trash2, Upload, X } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { movements } from "@/lib/dictionary/catalog";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentUserId } from "@/lib/pin-gate";
import { useProfiles } from "@/lib/store";
import {
  createMovementVideoUpload,
  deleteMovementVideo,
  isVideoAdmin,
  MOVEMENT_VIDEO_BUCKET,
  saveMovementUpload,
  saveMovementYoutube,
  verifyVideoAdminPin,
  type MovementVideo,
} from "@/lib/admin-videos";

export const Route = createFileRoute("/admin/videos")({
  component: AdminVideosPage,
});

function AdminVideosPage() {
  const profileId = getCurrentUserId();
  const qc = useQueryClient();
  const { data: profiles = [] } = useProfiles();
  const isBcProfile = profiles.some((profile) => profile.id === profileId && profile.name.trim().toLowerCase() === "bc");
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
    enabled: admin === true || !!pinHash,
  });

  const [pin, setPin] = useState("");
  const [pinHash, setPinHash] = useState<string | null>(null);
  const [pinError, setPinError] = useState("");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [youtubeDrafts, setYoutubeDrafts] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState("");

  const videoByMovement = useMemo(
    () => new Map(videos.map((video) => [video.movement_id, video])),
    [videos],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return movements;
    return movements.filter((movement) =>
      [movement.id, movement.name, movement.nameEs].some((value) =>
        value.toLowerCase().includes(q),
      ),
    );
  }, [search]);

  const stats = useMemo(() => {
    const configured = movements.filter((m) => videoByMovement.has(m.id)).length;
    return {
      total: movements.length,
      configured,
      missing: movements.length - configured,
      uploads: videos.filter((v) => v.source_type === "upload").length,
      youtube: videos.filter((v) => v.source_type === "youtube").length,
    };
  }, [videoByMovement, videos]);

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
      </div>

      {notice && (
        <div className="mt-4 flex items-center gap-2 rounded-2xl border border-[rgba(200,169,107,.2)] bg-white/[.03] px-4 py-3 text-sm">
          <Check className="h-4 w-4 shrink-0 text-[var(--gold)]" />
          <span>{notice}</span>
        </div>
      )}

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

      <div className="mt-4 space-y-3">
        {loadingVideos ? <Loading /> : filtered.map((movement) => {
          const video = videoByMovement.get(movement.id);
          const isBusy = busy === movement.id;
          const previewUrl = video?.storage_path
            ? supabase.storage.from(MOVEMENT_VIDEO_BUCKET).getPublicUrl(video.storage_path).data.publicUrl
            : video?.youtube_url ?? null;

          return (
            <div key={movement.id} className="cinematic-card-strong rounded-[24px] p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <span className="cinematic-label">{movement.id}</span>
                  <h2 className="mt-1 text-base font-semibold">{movement.name}</h2>
                  <p className="text-xs text-muted-foreground">{movement.nameEs}</p>
                </div>
                <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[.14em] ${video ? "border-[rgba(200,169,107,.28)] text-[var(--gold)]" : "border-white/10 text-muted-foreground"}`}>
                  {video ? video.source_type : "sin vídeo"}
                </span>
              </div>

              {previewUrl && (
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-[var(--gold)]"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Abrir vídeo actual
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
