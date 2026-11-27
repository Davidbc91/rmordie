import { useEffect } from "react";

export type PrCelebrationData = {
  /** Nombre del ejercicio o del WOD */
  exercise: string;
  /** PR de fuerza */
  weight?: number;
  repMax?: number;
  delta?: number | null;
  /** PR de WOD */
  valueText?: string;
  deltaText?: string | null;
  subtitle?: string;
  matched?: boolean;
};

export function PrCelebration({
  data,
  onClose,
  onView,
  onShare,
}: {
  data: PrCelebrationData;
  onClose: () => void;
  onView?: () => void;
  onShare?: () => void;
}) {
  const hasActions = !!onView || !!onShare;

  useEffect(() => {
    if (hasActions) return;
    const t = setTimeout(onClose, 2600);
    return () => clearTimeout(t);
  }, [onClose, hasActions]);

  const value =
    data.valueText ??
    (data.weight != null ? `${data.weight}` : "—");
  const isWeight = data.valueText == null && data.weight != null;
  const sub =
    data.subtitle ??
    (data.repMax != null
      ? `${data.repMax}RM${data.delta != null && data.delta > 0 ? ` · +${data.delta} kg` : ""}`
      : (data.deltaText ?? ""));

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center px-8"
      style={{ background: "rgba(0,0,0,0.82)", backdropFilter: "blur(8px)" }}
      onClick={hasActions ? undefined : onClose}
      role="status"
      aria-live="polite"
    >
      <Confetti />
      <div
        className="glass-elevated glass-sheen glass-gold w-full max-w-xs p-7 text-center"
        style={{ animation: "pr-pop 420ms cubic-bezier(0.22,1,0.36,1)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-[13px] font-semibold tracking-[0.2em] text-gold">
          {data.matched ? "Igualas tu récord" : "Nuevo récord"}
        </p>
        <p className="mt-3 text-sm font-semibold text-muted-foreground">{data.exercise}</p>
        <p className="gold-text mt-2 leading-none tabular" style={{ fontFamily: "var(--font-num)", fontWeight: 900, fontSize: "64px" }}>
          {value}
          {isWeight && <span className="text-lg"> kg</span>}
        </p>
        {!!sub && <p className="mt-2 text-sm text-muted-foreground">{sub}</p>}

        {hasActions && (
          <div className="mt-6 space-y-2">
            {onView && (
              <button
                onClick={onView}
                className="pressable gold-gradient min-h-[48px] w-full rounded-[var(--r-md)] text-xs font-semibold"
              >
                Ver PR
              </button>
            )}
            {onShare && (
              <button
                onClick={onShare}
                className="pressable min-h-[48px] w-full rounded-[var(--r-md)] border border-[color:var(--glass-border-strong)] bg-[color:var(--glass-bg)] text-xs font-semibold text-foreground"
              >
                Compartir
              </button>
            )}
            <button
              onClick={onClose}
              className="min-h-11 w-full text-sm text-muted-foreground"
            >
              Cerrar
            </button>
          </div>
        )}
      </div>
      <style>{`@keyframes pr-pop{0%{opacity:0;transform:scale(0.9) translateY(10px)}100%{opacity:1;transform:none}}`}</style>
    </div>
  );
}

const CONFETTI_COLORS = ["var(--gold)", "#FF8A3D", "#3BB8F5", "var(--gold)", "var(--gold-soft)"];
/** Confeti de colores al batir un récord. */
function Confetti() {
  const pieces = Array.from({ length: 60 }, (_, i) => {
    const r = (n: number) => ((Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1 + 1) % 1;
    return {
      left: `${r(1) * 100}%`,
      delay: `${Math.round(r(2) * 400)}ms`,
      dur: `${1600 + Math.round(r(3) * 1200)}ms`,
      rot: `${Math.round(r(4) * 720 - 360)}deg`,
      dx: `${Math.round(r(5) * 160 - 80)}px`,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      w: 6 + Math.round(r(6) * 6),
      h: 10 + Math.round(r(7) * 8),
    };
  });
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="rmd-confetti absolute top-[-20px] rounded-[2px]"
          style={{ left: p.left, width: p.w, height: p.h, background: p.color, animationDelay: p.delay, animationDuration: p.dur, ["--rot" as string]: p.rot, ["--dx" as string]: p.dx }}
        />
      ))}
      <style>{`.rmd-confetti{animation-name:rmd-confetti;animation-timing-function:cubic-bezier(.2,.6,.4,1);animation-fill-mode:both}
@keyframes rmd-confetti{0%{transform:translate(0,0) rotate(0);opacity:1}100%{transform:translate(var(--dx),110vh) rotate(var(--rot));opacity:.9}}
@media (prefers-reduced-motion:reduce){.rmd-confetti{display:none}}`}</style>
    </div>
  );
}
