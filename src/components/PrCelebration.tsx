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
        className="w-full max-w-xs rounded-[24px] p-7 text-center"
        style={{
          background: "#FFFFFF",
          color: "#000000",
          animation: "pr-pop 520ms cubic-bezier(0.22,1,0.36,1)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-[11px] uppercase tracking-[0.34em]" style={{ color: "#6F6F6F" }}>
          {data.matched ? "Matched PR" : "New PR"}
        </p>
        <p className="mt-3 text-sm font-semibold uppercase tracking-[0.12em]">{data.exercise}</p>
        <p className="mt-1 text-[52px] font-semibold leading-none tabular tracking-tight">
          {value}
          {isWeight && <span className="text-lg"> kg</span>}
        </p>
        {!!sub && (
          <p className="mt-2 text-xs" style={{ color: "#6F6F6F" }}>
            {sub}
          </p>
        )}

        {hasActions && (
          <div className="mt-6 space-y-2">
            {onView && (
              <button
                onClick={onView}
                className="w-full rounded-[18px] py-3 text-xs font-semibold uppercase tracking-[0.18em]"
                style={{ background: "#000000", color: "#FFFFFF" }}
              >
                Ver PR
              </button>
            )}
            {onShare && (
              <button
                onClick={onShare}
                className="w-full rounded-[18px] border py-3 text-xs font-semibold uppercase tracking-[0.18em]"
                style={{ borderColor: "#D4D4D4", color: "#000000" }}
              >
                Compartir
              </button>
            )}
            <button
              onClick={onClose}
              className="w-full py-2 text-xs uppercase tracking-[0.18em]"
              style={{ color: "#6F6F6F" }}
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
