import { useId } from "react";
import type { MedalFamily, MedalTier } from "@/lib/medals";

const TIERS: Record<MedalTier | "off", [string, string, string]> = {
  bronce: ["#C98A55", "#7A4A26", "#3A2414"],
  plata: ["#E3E6EC", "#8F96A3", "#3C4150"],
  oro: ["#FFD86B", "#B8860B", "#4A3605"],
  leyenda: ["#DBFF66", "#7FA600", "#1E2608"],
  off: ["#2E2E31", "#222225", "#161618"],
};

const SHAPES: Record<MedalFamily, string> = {
  constancia: "M50 4 61 14 75 11 79 25 93 30 88 44 96 56 84 64 84 79 70 81 61 94 50 86 39 94 30 81 16 79 16 64 4 56 12 44 7 30 21 25 25 11 39 14Z",
  racha: "M50 6a44 44 0 1 1 0 88a44 44 0 1 1 0-88Z",
  semanas: "M22 8h56a14 14 0 0 1 14 14v56a14 14 0 0 1-14 14H22A14 14 0 0 1 8 78V22A14 14 0 0 1 22 8Z",
  records: "M50 4 90 27v46L50 96 10 73V27Z",
  fuerza: "M50 4 88 16v32c0 24-17 40-38 48C29 88 12 72 12 48V16Z",
  habitos: "M50 4 95 50 50 96 5 50Z",
  retos: "M50 3 62 33 95 35 70 56 78 89 50 72 22 89 30 56 5 35 38 33Z",
};

function Glyph({ family, code }: { family: MedalFamily; code: string }) {
  if (code === "coach_report") return <path d="M36 30h20l8 8v30H36Z M56 30v8h8 M42 48h16 M42 56h12" fill="none" strokeWidth={4.5} strokeLinejoin="round" strokeLinecap="round" />;
  if (code === "shared_workout") return <path d="M50 30v26 M40 40l10-10 10 10 M36 52v14h28V52" fill="none" strokeWidth={5} strokeLinejoin="round" strokeLinecap="round" />;
  if (code === "weekend_10") return <><rect x="32" y="34" width="36" height="32" rx="6" fill="none" strokeWidth={5} /><path d="M32 45h36 M41 30v8 M59 30v8" strokeWidth={5} strokeLinecap="round" /><rect x="52" y="51" width="9" height="9" rx="2" /></>;
  if (code === "first_day_3") return <><rect x="32" y="34" width="36" height="32" rx="6" fill="none" strokeWidth={5} /><path d="M32 45h36 M41 30v8 M59 30v8" strokeWidth={5} strokeLinecap="round" /><path d="M48 51h4v11" fill="none" strokeWidth={4} strokeLinecap="round" /></>;
  switch (family) {
    case "constancia":
      return <><path d="M38 70V28" strokeWidth={5} strokeLinecap="round" /><path d="M40 30h24l-6 8 6 8H40Z" strokeWidth={2} strokeLinejoin="round" /></>;
    case "racha":
      return <path d="M50 28c8 10 16 16 16 28a16 16 0 0 1-32 0c0-7 4-11 7-15 1 6 4 8 6 8-2-8 0-15 3-21Z" />;
    case "semanas":
      return <><rect x="32" y="34" width="36" height="32" rx="6" fill="none" strokeWidth={5} /><path d="M32 45h36 M41 30v8 M59 30v8" strokeWidth={5} strokeLinecap="round" /><path d="m42 56 5 5 11-11" fill="none" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" /></>;
    case "records":
      return <path d="M37 32h26v10a13 13 0 0 1-26 0Z M43 62h14 M50 55v7 M37 36h-6a6 6 0 0 0 6 9 M63 36h6a6 6 0 0 1-6 9" fill="none" strokeWidth={5} strokeLinecap="round" />;
    case "fuerza":
      return <><path d="M30 50h40" strokeWidth={5} /><rect x="33" y="38" width="7" height="24" rx="2" /><rect x="60" y="38" width="7" height="24" rx="2" /><rect x="26" y="43" width="5" height="14" rx="1.5" /><rect x="69" y="43" width="5" height="14" rx="1.5" /></>;
    case "retos":
      return <path d="M41 40h18v6a9 9 0 0 1-18 0Z M46 60h8 M50 55v5" fill="none" strokeWidth={4} strokeLinecap="round" />;
    case "habitos":
      return <><circle cx="50" cy="52" r="9" /><path d="M50 32v6 M50 66v6 M30 52h6 M64 52h6 M36 38l4 4 M60 62l4 4 M64 38l-4 4 M36 66l4-4" strokeWidth={4.5} strokeLinecap="round" /></>;
  }
}

/** Medalla dibujada: forma según familia, metal según nivel; apagada si está bloqueada. */
export function MedalIcon({
  family,
  tier,
  code,
  badge,
  earned,
  size = 72,
  className,
}: {
  family: MedalFamily;
  tier: MedalTier;
  code: string;
  badge?: string;
  earned: boolean;
  size?: number;
  className?: string;
}) {
  const id = useId().replace(/:/g, "");
  const [a, b, c] = TIERS[earned ? tier : "off"];
  const ink = earned ? (tier === "leyenda" ? "#1E2608" : c) : "#3A3A3E";
  const shape = SHAPES[family];
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={className} style={{ overflow: "visible" }} aria-hidden>
      <defs>
        <linearGradient id={`m${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={a} />
          <stop offset="1" stopColor={b} />
        </linearGradient>
      </defs>
      <path d={shape} fill={`url(#m${id})`} style={earned ? { filter: "drop-shadow(0 6px 10px rgba(0,0,0,.55))" } : undefined} />
      <path d={shape} fill="none" stroke={earned ? "rgba(255,255,255,.34)" : "rgba(255,255,255,.06)"} strokeWidth={2} transform="translate(50 50) scale(.84) translate(-50 -50)" />
      <g fill={ink} stroke={ink}>
        <Glyph family={family} code={code} />
      </g>
      {badge ? (
        <g transform="translate(50 82)">
          <rect x={-23} y={-8} width={46} height={15} rx={7.5} fill={earned ? c : "#1D1D20"} opacity={earned ? 0.88 : 1} />
          <text y={3.8} textAnchor="middle" fontSize={11} fontWeight={800} fill={earned ? a : "#5A5A5F"} style={{ fontFamily: "var(--font-num)", letterSpacing: ".04em" }}>
            {badge}
          </text>
        </g>
      ) : null}
    </svg>
  );
}
