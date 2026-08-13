import { useEffect } from "react";

export type PrCelebrationData = {
  exercise: string;
  weight: number;
  delta: number | null;
  repMax: number;
};

export function PrCelebration({ data, onClose }: { data: PrCelebrationData; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 2600);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center px-8"
      style={{ background: "rgba(0,0,0,0.82)", backdropFilter: "blur(8px)" }}
      onClick={onClose}
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
      >
        <p className="text-[11px] uppercase tracking-[0.34em]" style={{ color: "#6F6F6F" }}>
          New PR
        </p>
        <p className="mt-3 text-sm font-semibold uppercase tracking-[0.12em]">{data.exercise}</p>
        <p className="mt-1 text-[52px] font-semibold leading-none tabular tracking-tight">
          {data.weight}
          <span className="text-lg"> kg</span>
        </p>
        <p className="mt-2 text-xs" style={{ color: "#6F6F6F" }}>
          {data.repMax}RM{data.delta != null && data.delta > 0 ? ` · +${data.delta} kg` : ""}
        </p>
      </div>
      <style>{`@keyframes pr-pop{0%{opacity:0;transform:scale(0.9) translateY(10px)}100%{opacity:1;transform:none}}`}</style>
    </div>
  );
}
