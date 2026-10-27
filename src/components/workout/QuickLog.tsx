import { useEffect, useRef, useState } from "react";
import { Minus, Plus, Timer } from "lucide-react";
import { platesPerSide, type PlateConfig } from "@/lib/plates";
import { formatKg } from "@/lib/rm-matcher";

// Piezas para registrar una serie con el pulgar, sin abrir el teclado.

const toNum = (v: string) => {
  const n = Number(v.replace(",", ".").trim());
  return v.trim() !== "" && Number.isFinite(n) ? n : null;
};

const stepBtn =
  "pressable grid h-14 w-[52px] shrink-0 place-items-center rounded-[14px] border border-white/[0.14] bg-white/[0.06] text-[15px] font-bold disabled:opacity-40";

/** Carga con botones de −/+ 2,5 kg; el número se puede seguir escribiendo. */
export function LoadStepper({ value, onChange, placeholder, highlight }: { value: string; onChange: (v: string) => void; placeholder?: string; highlight?: boolean }) {
  const n = toNum(value);
  const bump = (d: number) => {
    const next = Math.max(0, Math.round(((n ?? 0) + d) * 100) / 100);
    onChange(next > 0 ? String(next) : "");
  };
  return (
    <div>
      <span className="mb-1.5 block text-[13px] text-muted-foreground">Carga</span>
      <div className="flex items-center gap-2">
        <button type="button" aria-label="Bajar 2,5 kg" onClick={() => bump(-2.5)} disabled={!n} className={stepBtn}>−2,5</button>
        <label className={`flex h-14 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-[14px] border bg-white/[0.06] px-2 ${highlight ? "border-[color:var(--gold)]/50" : "border-white/[0.14]"}`}>
          <span className="sr-only">Carga en kg</span>
          <input
            inputMode="decimal"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder ?? "0"}
            className="w-full min-w-0 bg-transparent text-center text-[32px] font-extrabold tabular outline-none placeholder:text-base placeholder:font-normal placeholder:text-muted-foreground/70"
            style={{ fontFamily: "var(--font-editorial)" }}
          />
          <span className="text-sm text-muted-foreground">kg</span>
        </label>
        <button type="button" aria-label="Subir 2,5 kg" onClick={() => bump(2.5)} className={stepBtn}>+2,5</button>
      </div>
    </div>
  );
}

/** Número entero con − y + (series, reps). */
export function CountStepper({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const n = toNum(value) ?? 0;
  const set = (v: number) => onChange(v > 0 ? String(v) : "");
  return (
    <div>
      <span className="mb-1.5 block text-[13px] text-muted-foreground">{label}</span>
      <div className="flex h-14 items-center rounded-[14px] border border-white/[0.14] bg-white/[0.06]">
        <button type="button" aria-label={`${label}: uno menos`} onClick={() => set(n - 1)} disabled={n <= 0} className="grid h-14 w-12 shrink-0 place-items-center disabled:opacity-35">
          <Minus className="h-5 w-5" />
        </button>
        <input
          inputMode="numeric"
          aria-label={label}
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, ""))}
          placeholder="–"
          className="w-full min-w-0 bg-transparent text-center text-[30px] font-extrabold tabular outline-none placeholder:text-muted-foreground/60"
          style={{ fontFamily: "var(--font-editorial)" }}
        />
        <button type="button" aria-label={`${label}: uno más`} onClick={() => set(n + 1)} className="grid h-14 w-12 shrink-0 place-items-center">
          <Plus className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

const RPE_HINT: Record<number, string> = {
  6: "6 = te quedaban 4 reps o más",
  7: "7 = te quedaban 3 reps",
  8: "8 = te quedaban 2 reps",
  9: "9 = te quedaba 1 rep",
  10: "10 = no podías hacer ni una más",
};

/** RPE con botones del 6 al 10. Tocar el elegido lo quita. */
export function RpeChips({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const n = toNum(value);
  const other = n != null && ![6, 7, 8, 9, 10].includes(n);
  return (
    <div>
      <span className="mb-1.5 block text-[13px] text-muted-foreground">¿Cómo de duro? (RPE)</span>
      <div role="group" aria-label="RPE" className="grid grid-cols-5 gap-1.5">
        {[6, 7, 8, 9, 10].map((v) => {
          const on = n === v;
          return (
            <button
              key={v}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(on ? "" : String(v))}
              className={`h-12 rounded-[12px] text-[22px] font-extrabold transition-colors ${on ? "bg-[color:var(--gold)] text-[color:var(--gold-foreground)]" : "border border-white/[0.14] bg-white/[0.05] text-foreground/85"}`}
              style={{ fontFamily: "var(--font-editorial)" }}
            >
              {v}
            </button>
          );
        })}
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">
        {n != null && RPE_HINT[n] ? RPE_HINT[n] : other ? `RPE ${formatKg(n!)}` : "Opcional"}
      </p>
    </div>
  );
}

/** Dibujo de la barra con los discos de un lado y el texto «20 + 15 + 2,5 por lado». */
export function PlateLine({ total, cfg }: { total: number | null; cfg: PlateConfig | undefined }) {
  if (!total || !cfg) return null;
  const r = platesPerSide(total, cfg);
  if (!r) return null;
  const maxPlate = Math.max(25, ...r.plates);
  let x = 42;
  return (
    <div className="mt-2 flex items-center gap-3 rounded-[12px] bg-black/30 px-3 py-2.5">
      <svg width="116" height="34" viewBox="0 0 116 34" aria-hidden className="shrink-0">
        <rect x="0" y="15" width="116" height="4" rx="2" fill="#6B6860" />
        <rect x="36" y="11" width="4" height="12" rx="1" fill="#99968E" />
        {r.plates.slice(0, 8).map((p, i) => {
          const h = Math.max(10, Math.round((p / maxPlate) * 32));
          const w = p >= 10 ? 8 : p >= 5 ? 6 : 4;
          const el = <rect key={i} x={x} y={17 - h / 2} width={w} height={h} rx="1.5" fill={p >= 15 ? "#C8B38A" : p >= 5 ? "#E8DDC8" : "#99968E"} />;
          x += w + 1.5;
          return el;
        })}
      </svg>
      <span className="min-w-0 text-sm text-foreground/85">
        {r.plates.length === 0 ? (
          <>Solo la barra de {formatKg(r.bar)}</>
        ) : (
          <>Barra {formatKg(r.bar)} + <b>{r.plates.map(formatKg).join(" + ")}</b> por lado</>
        )}
        {r.rest > 0 && <span className="block text-xs text-muted-foreground">Con tus discos faltan {formatKg(r.rest)} kg</span>}
      </span>
    </div>
  );
}

function clock(s: number) {
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

/** Cuenta atrás del descanso entre series. Vibra al terminar. */
export function RestTimer({ seconds }: { seconds: number }) {
  const [endAt, setEndAt] = useState<number | null>(null);
  const [left, setLeft] = useState(seconds);
  const vibrated = useRef(false);

  useEffect(() => { if (endAt == null) setLeft(seconds); }, [seconds, endAt]);

  useEffect(() => {
    if (endAt == null) return;
    vibrated.current = false;
    const tick = () => {
      const s = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
      setLeft(s);
      if (s === 0 && !vibrated.current) {
        vibrated.current = true;
        try { navigator.vibrate?.([250, 120, 250]); } catch { /* sin vibración */ }
        window.setTimeout(() => setEndAt(null), 2500);
      }
    };
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [endAt]);

  const running = endAt != null;
  const finished = running && left === 0;
  return (
    <div className={`flex items-center gap-3 rounded-[14px] border border-dashed px-3.5 py-2 ${finished ? "border-[color:var(--gold)] bg-[color:var(--gold)]/12" : "border-[color:var(--gold)]/40"}`}>
      <Timer className="h-5 w-5 shrink-0 text-gold" />
      <span className="flex-1 text-sm" role="timer" aria-live={finished ? "assertive" : "off"}>
        {finished ? "¡A por la siguiente serie!" : running ? "Descansando" : "Descanso"}{" "}
        {!finished && <b className="text-[22px] tabular" style={{ fontFamily: "var(--font-editorial)" }}>{clock(left)}</b>}
      </span>
      {running && !finished ? (
        <button type="button" onClick={() => setEndAt(null)} className="min-h-11 rounded-[12px] px-3.5 text-sm font-bold text-muted-foreground">Parar</button>
      ) : (
        <button type="button" onClick={() => setEndAt(Date.now() + seconds * 1000)} className="min-h-11 rounded-[12px] bg-[color:var(--gold)]/16 px-3.5 text-sm font-bold text-[color:var(--gold-soft)]">
          {finished ? "Otra vez" : "Empezar"}
        </button>
      )}
    </div>
  );
}
