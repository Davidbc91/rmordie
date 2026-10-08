import { Share2 } from "lucide-react";
import { type SessionReportLoad, type SessionReportWod } from "@/lib/session-report";

export type WorkoutReview = {
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

export function WorkoutReviewCard({ review, onClose, onDownload, onShare, sharing }: { review: WorkoutReview; onClose: () => void; onDownload: () => void; onShare: () => void | Promise<void>; sharing: boolean }) {
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

export function ReviewStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="cinematic-card-dark rounded-2xl p-3">
      <p className="cinematic-label">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular">{value}</p>
    </div>
  );
}
