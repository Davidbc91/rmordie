import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Keyboard } from "lucide-react";

/*
 * Ruleta como la del despertador del iPhone: se gira con el dedo y el valor
 * se queda en la franja del centro. PickerField muestra el valor y, al tocarlo,
 * abre una hoja con una ruleta (rondas, minutos…) o dos (minutos : segundos).
 * También se puede escribir con el teclado numérico.
 */

const ITEM = 44;
const VISIBLE = 5;

export function WheelColumn({
  values, value, onChange, format = String, label, width = 96,
}: {
  values: number[];
  value: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
  label?: string;
  width?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState(0); // posición continua (en ítems) para el efecto 3D
  const settle = useRef<number>(0);
  const raf = useRef<number>(0);
  const index = Math.max(0, values.indexOf(value));

  // Colocar en el valor actual al abrir (y si cambia desde fuera)
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (Math.round(el.scrollTop / ITEM) !== index) el.scrollTop = index * ITEM;
    setPos(el.scrollTop / ITEM);
  }, [index]);

  const onScroll = () => {
    const el = ref.current;
    if (!el) return;
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => setPos(el.scrollTop / ITEM));
    window.clearTimeout(settle.current);
    settle.current = window.setTimeout(() => {
      const i = Math.max(0, Math.min(values.length - 1, Math.round(el.scrollTop / ITEM)));
      if (values[i] !== value) {
        onChange(values[i]);
        try { navigator.vibrate?.(4); } catch { /* sin vibración */ }
      }
    }, 80);
  };

  const step = (d: number) => {
    const i = Math.max(0, Math.min(values.length - 1, index + d));
    onChange(values[i]);
  };

  return (
    <div className="relative" style={{ width }}>
      <div
        ref={ref}
        role="listbox"
        aria-label={label}
        aria-activedescendant={undefined}
        tabIndex={0}
        onScroll={onScroll}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp") { e.preventDefault(); step(-1); }
          if (e.key === "ArrowDown") { e.preventDefault(); step(1); }
        }}
        className="no-scrollbar relative overflow-y-scroll overscroll-contain rounded-[12px] outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--gold)]"
        style={{
          height: ITEM * VISIBLE,
          scrollSnapType: "y mandatory",
          paddingBlock: ITEM * Math.floor(VISIBLE / 2),
          WebkitMaskImage: "linear-gradient(transparent, #000 30%, #000 70%, transparent)",
          maskImage: "linear-gradient(transparent, #000 30%, #000 70%, transparent)",
        }}
      >
        {values.map((v, i) => {
          const d = i - pos;
          return (
            <button
              key={v}
              type="button"
              role="option"
              aria-selected={i === index}
              tabIndex={-1}
              onClick={() => ref.current?.scrollTo({ top: i * ITEM, behavior: "smooth" })}
              className="block w-full text-center tabular-nums"
              style={{
                height: ITEM,
                scrollSnapAlign: "center",
                fontFamily: "var(--font-editorial)",
                fontWeight: 800,
                fontSize: 30,
                lineHeight: `${ITEM}px`,
                color: Math.abs(d) < 0.5 ? "var(--foreground, #F2F0EA)" : "var(--muted-foreground, #8E8B83)",
                opacity: Math.max(0.25, 1 - Math.abs(d) * 0.28),
                transform: `perspective(300px) rotateX(${Math.max(-60, Math.min(60, -d * 18))}deg) scale(${1 - Math.min(0.25, Math.abs(d) * 0.08)})`,
              }}
            >
              {format(v)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const range = (min: number, max: number, step = 1) => {
  const out: number[] = [];
  for (let v = min; v <= max; v += step) out.push(v);
  return out;
};
const pad2 = (n: number) => String(n).padStart(2, "0");
export const mmss = (s: number) => `${pad2(Math.floor(s / 60))}:${pad2(s % 60)}`;

type FieldProps = {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  /** "duration": segundos con ruletas de min y seg; "count": una ruleta (rondas, minutos…) */
  kind?: "duration" | "count";
  step?: number;
  unit?: string;
  disabled?: boolean;
  className?: string;
  big?: boolean;
};

/** Campo que muestra el valor y abre la ruleta al tocarlo. */
export function PickerField({ label, value, onChange, min = 0, max = 999, kind = "count", step = 1, unit, disabled, className = "", big }: FieldProps) {
  const [open, setOpen] = useState(false);
  const shown = kind === "duration" ? mmss(value) : String(value);
  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        aria-label={`${label}: ${kind === "duration" ? mmss(value) : `${value}${unit ? ` ${unit}` : ""}`}. Toca para cambiar`}
        className={`flex w-full items-center justify-between gap-3 rounded-[14px] border border-white/[0.14] bg-white/[0.06] px-4 text-left disabled:opacity-40 ${big ? "min-h-16" : "min-h-14"} ${className}`}
      >
        <span className="text-[15px] text-muted-foreground">{label}</span>
        <span className="flex items-baseline gap-1.5">
          <span className="tabular-nums" style={{ fontFamily: "var(--font-editorial)", fontWeight: 800, fontSize: big ? 36 : 30, lineHeight: 1 }}>{shown}</span>
          {unit && kind !== "duration" && <span className="text-sm text-muted-foreground">{unit}</span>}
        </span>
      </button>
      {open && (
        <PickerSheet
          label={label}
          value={value}
          min={min}
          max={max}
          kind={kind}
          step={step}
          unit={unit}
          onClose={() => setOpen(false)}
          onDone={(v) => { setOpen(false); if (v !== value) onChange(v); }}
        />
      )}
    </>
  );
}

function PickerSheet({
  label, value, min, max, kind, step, unit, onClose, onDone,
}: {
  label: string; value: number; min: number; max: number; kind: "duration" | "count"; step: number; unit?: string;
  onClose: () => void; onDone: (v: number) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [typing, setTyping] = useState(false);
  const [text, setText] = useState("");
  const clamp = (n: number) => Math.max(min, Math.min(max, n));

  const countValues = useMemo(() => range(min, max, step), [min, max, step]);
  const maxMin = Math.floor(max / 60);
  const minuteValues = useMemo(() => range(0, Math.max(0, maxMin)), [maxMin]);
  const secondValues = useMemo(() => range(0, 59), []);

  // Teclado: «130» → 1:30 en duraciones; número tal cual en el resto
  const fromText = (t: string) => {
    const digits = t.replace(/\D/g, "");
    if (!digits) return null;
    if (kind === "duration") {
      if (t.includes(":")) {
        const [m, s] = t.split(":").map((x) => parseInt(x || "0", 10));
        return clamp((m || 0) * 60 + Math.min(59, s || 0));
      }
      const n = parseInt(digits, 10);
      return clamp(digits.length <= 2 ? n : Math.floor(n / 100) * 60 + Math.min(59, n % 100));
    }
    return clamp(parseInt(digits, 10));
  };

  const commit = () => {
    if (typing) {
      const v = fromText(text);
      onDone(v ?? draft);
    } else onDone(clamp(draft));
  };

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-end bg-black/60" onClick={onClose}>
      <div
        role="dialog"
        aria-label={`Elegir ${label.toLowerCase()}`}
        className="w-full rounded-t-[24px] border-t border-white/10 bg-[#151412] px-4 pt-4 text-foreground"
        style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2">
          <button type="button" onClick={onClose} className="min-h-11 px-2 text-[15px] text-muted-foreground">Cancelar</button>
          <p className="text-[15px] font-bold">{label}</p>
          <button type="button" onClick={commit} className="min-h-11 px-2 text-[15px] font-extrabold text-gold">Listo</button>
        </div>

        {typing ? (
          <div className="py-6">
            <input
              autoFocus
              inputMode={kind === "duration" ? "decimal" : "numeric"}
              value={text}
              onChange={(e) => setText(e.target.value.replace(/[^\d:]/g, "").slice(0, 6))}
              onKeyDown={(e) => { if (e.key === "Enter") commit(); }}
              placeholder={kind === "duration" ? mmss(draft) : String(draft)}
              aria-label={label}
              className="w-full bg-transparent text-center tabular-nums outline-none"
              style={{ fontFamily: "var(--font-editorial)", fontWeight: 900, fontSize: 64, lineHeight: 1 }}
            />
            <p className="mt-2 text-center text-[13px] text-muted-foreground">
              {kind === "duration" ? "Escribe minutos y segundos: 130 = 1:30, 45 = 0:45" : unit ? `En ${unit}` : "Escribe el número"}
            </p>
          </div>
        ) : (
          <div className="relative my-3 flex items-center justify-center gap-2">
            {/* franja del centro */}
            <div aria-hidden className="pointer-events-none absolute inset-x-6 top-1/2 h-11 -translate-y-1/2 rounded-[12px] bg-white/[0.07]" />
            {kind === "duration" ? (
              <>
                <WheelColumn label="Minutos" values={minuteValues} value={Math.floor(draft / 60)} format={pad2} onChange={(m) => setDraft(clamp(m * 60 + (draft % 60)))} />
                <span className="relative pb-1 text-[30px] font-extrabold" style={{ fontFamily: "var(--font-editorial)" }}>:</span>
                <WheelColumn label="Segundos" values={secondValues} value={draft % 60} format={pad2} onChange={(s) => setDraft(clamp(Math.floor(draft / 60) * 60 + s))} />
                <div className="pointer-events-none absolute inset-x-0 -bottom-1 flex justify-center gap-[70px] text-xs text-muted-foreground">
                  <span>min</span><span>seg</span>
                </div>
              </>
            ) : (
              <>
                <WheelColumn label={label} values={countValues} value={countValues.includes(draft) ? draft : countValues[0]} onChange={setDraft} width={120} />
                {unit && <span className="relative text-[15px] text-muted-foreground">{unit}</span>}
              </>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={() => { setTyping((t) => !t); setText(""); }}
          className="mx-auto mt-1 flex min-h-11 items-center gap-2 rounded-full bg-white/[0.06] px-4 text-sm font-bold"
        >
          <Keyboard className="h-4 w-4" /> {typing ? "Usar la ruleta" : "Escribir con el teclado"}
        </button>
      </div>
    </div>,
    document.body,
  );
}
