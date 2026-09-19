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
      <div
        className="glass-elevated glass-sheen glass-gold w-full max-w-xs p-7 text-center"
        style={{ animation: "pr-pop 420ms cubic-bezier(0.22,1,0.36,1)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-[10px] font-semibold uppercase tracking-[0.34em] text-gold">
          {data.matched ? "Matched PR" : "New PR"}
        </p>
        <p className="mt-3 text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">{data.exercise}</p>
        <p className="gold-text mt-2 text-[52px] font-semibold leading-none tabular tracking-tight">
          {value}
          {isWeight && <span className="text-lg"> kg</span>}
        </p>
        {!!sub && <p className="mt-2 text-xs text-muted-foreground">{sub}</p>}

        {hasActions && (
          <div className="mt-6 space-y-2">
            {onView && (
              <button
                onClick={onView}
                className="pressable gold-gradient min-h-[48px] w-full rounded-[var(--r-md)] text-xs font-semibold uppercase tracking-[0.18em]"
              >
                Ver PR
              </button>
            )}
            {onShare && (
              <button
                onClick={onShare}
                className="pressable min-h-[48px] w-full rounded-[var(--r-md)] border border-[color:var(--glass-border-strong)] bg-[color:var(--glass-bg)] text-xs font-semibold uppercase tracking-[0.18em] text-foreground"
              >
                Compartir
              </button>
            )}
            <button
              onClick={onClose}
              className="w-full py-2.5 text-xs uppercase tracking-[0.18em] text-muted-foreground"
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
