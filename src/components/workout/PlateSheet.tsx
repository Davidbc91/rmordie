import { useEffect, useMemo, useState, type ReactElement } from "react";
import { createPortal } from "react-dom";
import { Minus, Plus, Settings2, X } from "lucide-react";
import { toast } from "sonner";
import { ALL_PLATES, loadBar, nearestLoadable, plateLook } from "@/lib/plates";
import { formatKg } from "@/lib/rm-matcher";
import { useSaveSettings, useSettings } from "@/lib/store";

/* Preferencias que no están en la base de datos (barra elegida, collarines, libras) */
type Prefs = { bar: number; collars: boolean; lb: boolean };
const PREFS_KEY = "rmordie_plate_prefs";
export function readPlatePrefs(): Prefs {
  try {
    const p = JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}");
    return { bar: Number(p.bar) || 20, collars: !!p.collars, lb: !!p.lb };
  } catch {
    return { bar: 20, collars: false, lb: false };
  }
}
function writePlatePrefs(p: Prefs) {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(p)); } catch { /* sin almacenamiento */ }
  window.dispatchEvent(new Event("rmordie:plate-prefs"));
}
export function usePlatePrefs() {
  const [prefs, setPrefs] = useState<Prefs>(() => (typeof window === "undefined" ? { bar: 20, collars: false, lb: false } : readPlatePrefs()));
  useEffect(() => {
    const read = () => setPrefs(readPlatePrefs());
    window.addEventListener("rmordie:plate-prefs", read);
    return () => window.removeEventListener("rmordie:plate-prefs", read);
  }, []);
  return [prefs, (p: Prefs) => { setPrefs(p); writePlatePrefs(p); }] as const;
}

/** Barra vista de frente con los discos montados a los dos lados. */
export function BarbellDrawing({ plates, collars, height = 150 }: { plates: number[]; collars: boolean; height?: number }) {
  const W = 340, H = 150, cy = 75, inner = 118;
  const side = (dir: 1 | -1) => {
    let x = dir > 0 ? W - inner + 6 : inner - 6;
    const out: ReactElement[] = [];
    // Si no caben, se reduce el grosor para que no se salgan de la manga
    const total = plates.reduce((a, p) => a + plateLook(p).w * 0.95 + 0.6, 0);
    const k = Math.min(1, (inner - 22) / Math.max(total, 1));
    plates.forEach((p, i) => {
      const look = plateLook(p);
      const h = 130 * look.h, w = look.w * 0.95 * k;
      const px = dir > 0 ? x : x - w;
      out.push(
        <g key={`${dir}-${i}`}>
          <rect x={px} y={cy - h / 2} width={w} height={h} rx={Math.min(3, w / 2)} fill={look.color} stroke="rgba(0,0,0,.35)" strokeWidth={0.8} />
          <rect x={px + w * 0.15} y={cy - h / 2 + 4} width={Math.max(1, w * 0.18)} height={h - 8} rx={1} fill="rgba(255,255,255,.2)" />
        </g>,
      );
      x += dir * (w + 0.6);
    });
    out.push(
      collars
        ? <rect key={`c${dir}`} x={dir > 0 ? x : x - 7} y={cy - 14} width={7} height={28} rx={2} fill="var(--gold)" />
        : <rect key={`c${dir}`} x={dir > 0 ? x + 1 : x - 5} y={cy - 9} width={4} height={18} rx={1.5} fill="#55595F" />,
    );
    return out;
  };
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxHeight: height }} aria-hidden>
      <rect x={8} y={cy - 3} width={W - 16} height={6} rx={3} fill="#8D939C" />
      <rect x={W / 2 - 40} y={cy - 3} width={80} height={6} fill="#6F757E" />
      <rect x={inner - 6} y={cy - 9} width={6} height={18} rx={2} fill="#B9BEC6" />
      <rect x={W - inner} y={cy - 9} width={6} height={18} rx={2} fill="#B9BEC6" />
      <rect x={8} y={cy - 6} width={inner - 14} height={12} rx={3} fill="#C9CED6" />
      <rect x={W - inner + 6} y={cy - 6} width={inner - 14} height={12} rx={3} fill="#C9CED6" />
      {side(1)}
      {side(-1)}
    </svg>
  );
}

const CHIPS = [40, 50, 60, 70, 80, 90];

/**
 * Hoja con la calculadora de discos.
 * - `initial`: peso que se abre (el de la serie)
 * - `work`: carga de trabajo para los chips de calentamiento
 * - `onApply`: si se pasa, aparece «Apuntar» para usar el peso en la serie
 */
export function PlateSheet({ initial, work, onApply, onClose }: { initial: number | null; work?: number | null; onApply?: (kg: number) => void; onClose: () => void }) {
  const { data: settings } = useSettings();
  const save = useSaveSettings();
  const [prefs, setPrefs] = usePlatePrefs();
  const [editing, setEditing] = useState(false);
  const plates = settings?.plate_weights?.length ? settings.plate_weights.map(Number) : [25, 20, 15, 10, 5, 2.5, 1.25];
  const bars = useMemo(() => {
    const b = (settings?.bar_weights?.length ? settings.bar_weights.map(Number) : [20, 15, 10]).sort((a, z) => z - a);
    return b.length ? b : [20];
  }, [settings?.bar_weights]);
  const bar = bars.includes(prefs.bar) ? prefs.bar : bars[0];
  const collars = prefs.collars ? 5 : 0;
  const [target, setTarget] = useState<number>(() => Math.max(initial ?? work ?? 60, 0));
  const [chip, setChip] = useState<number | null>(null);

  const r = loadBar(target, bar, plates, collars);
  const below = r.perSide < 0;
  const lo = r.rest > 0 ? nearestLoadable(target, -1, bar, plates, collars) : null;
  const hi = r.rest > 0 ? nearestLoadable(target, 1, bar, plates, collars) : null;
  const grouped = useMemo(() => {
    const m = new Map<number, number>();
    r.plates.forEach((p) => m.set(p, (m.get(p) ?? 0) + 1));
    return [...m.entries()].sort((a, b) => b[0] - a[0]);
  }, [r.plates.join(",")]);

  const step = (d: number) => { setChip(null); setTarget((t) => Math.max(0, Math.round((t + d) * 100) / 100)); };
  const base = work ?? initial;

  const togglePlate = (kg: number) => {
    const next = plates.includes(kg) ? plates.filter((p) => p !== kg) : [...plates, kg];
    if (next.length === 0) return;
    save.mutate({ plate_weights: next.sort((a, b) => b - a) }, { onError: () => toast.error("No se pudo guardar tu material") });
  };

  return createPortal(
    <div className="fixed inset-0 z-[75] flex items-end" role="dialog" aria-label="Calculadora de discos">
      <button aria-label="Cerrar" onClick={onClose} className="absolute inset-0 bg-black/60 backdrop-blur-[4px]" />
      <div className="animate-fade relative mx-auto max-h-[92dvh] w-full max-w-2xl overflow-y-auto overscroll-contain rounded-t-[28px] border-t border-white/10 bg-[color:var(--level-1)] px-4 pt-3" style={{ paddingBottom: "max(env(safe-area-inset-bottom), 18px)" }}>
        <div aria-hidden className="mx-auto mb-2 h-[5px] w-10 rounded-full bg-white/20" />
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[17px] font-extrabold tracking-tight">{editing ? "Tu material" : "Discos"}</span>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => setEditing((v) => !v)} aria-label="Tu material" className="grid h-10 w-10 place-items-center rounded-full bg-white/[0.07]" style={editing ? { background: "var(--gold-tint)", color: "var(--gold)" } : undefined}>
              <Settings2 className="h-[18px] w-[18px]" />
            </button>
            <button type="button" onClick={onClose} aria-label="Cerrar" className="grid h-10 w-10 place-items-center rounded-full bg-white/[0.07]"><X className="h-[18px] w-[18px]" /></button>
          </div>
        </div>

        {editing ? (
          <div className="space-y-4 pb-2">
            <div>
              <p className="mb-2 text-[14px] font-bold">Barra</p>
              <div className="flex gap-1 rounded-[14px] bg-white/[0.05] p-1">
                {bars.map((b) => (
                  <button key={b} type="button" onClick={() => setPrefs({ ...prefs, bar: b })} className="min-h-10 flex-1 rounded-[10px] text-[13.5px] font-bold" style={bar === b ? { background: "var(--gold-tint)", color: "var(--gold)" } : { color: "var(--muted-foreground)" }}>
                    {b === 10 ? "Técnica 10" : `${formatKg(b)} kg`}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-[14px] font-bold">Discos que hay en tu box</p>
              <div className="grid grid-cols-4 gap-2">
                {ALL_PLATES.map((kg) => {
                  const on = plates.includes(kg);
                  return (
                    <button key={kg} type="button" onClick={() => togglePlate(kg)} aria-pressed={on} className="flex flex-col items-center gap-1.5 rounded-[16px] bg-white/[0.05] py-2.5 text-[14px] font-extrabold" style={{ opacity: on ? 1 : 0.35 }}>
                      <span className="block h-7 w-7 rounded-full border-2 border-white/15" style={{ background: plateLook(kg).color, filter: on ? undefined : "grayscale(1)" }} />
                      {formatKg(kg)}
                    </button>
                  );
                })}
              </div>
            </div>
            <Toggle label="Collarines de competición" hint="2,5 kg cada uno" on={prefs.collars} onChange={(v) => setPrefs({ ...prefs, collars: v })} />
            <Toggle label="Mostrar también en libras" hint="Para barras y discos en lb" on={prefs.lb} onChange={(v) => setPrefs({ ...prefs, lb: v })} />
            <p className="text-[13px] text-muted-foreground">Los discos se guardan en tu perfil; la barra y los collarines, en este móvil.</p>
            <button type="button" onClick={() => setEditing(false)} className="min-h-[52px] w-full rounded-full text-[16px] font-extrabold" style={{ background: "var(--gold)", color: "var(--gold-foreground)" }}>Listo</button>
          </div>
        ) : (
          <div className="space-y-3.5 pb-1">
            {base != null && base > 0 && (
              <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4" style={{ scrollbarWidth: "none" }}>
                {[...CHIPS, 100].map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => { setChip(p); setTarget(Math.max(bar, Math.round((base * p) / 100 / 2.5) * 2.5)); }}
                    className="min-h-9 shrink-0 rounded-full px-3 text-[13px] font-bold"
                    style={chip === p ? { background: "var(--gold-tint)", color: "var(--gold)" } : { background: "rgba(255,255,255,.07)", color: "var(--muted-foreground)" }}
                  >
                    {p === 100 ? "Trabajo" : `${p} %`}
                  </button>
                ))}
              </div>
            )}
            <div className="flex items-center justify-between gap-2">
              <button type="button" onClick={() => step(-2.5)} aria-label="Bajar 2,5 kg" className="grid h-12 w-12 place-items-center rounded-full bg-white/[0.08]"><Minus className="h-5 w-5" /></button>
              <div className="text-center">
                <span className="num text-[64px] leading-[.9] tabular">{formatKg(target)}</span>
                <span className="ml-1 text-[20px] font-semibold text-muted-foreground">kg</span>
              </div>
              <button type="button" onClick={() => step(2.5)} aria-label="Subir 2,5 kg" className="grid h-12 w-12 place-items-center rounded-full bg-white/[0.08]"><Plus className="h-5 w-5" /></button>
            </div>
            <div className="rounded-[20px] py-1" style={{ background: "radial-gradient(70% 90% at 50% 50%, #1f2410, transparent 70%)" }}>
              <BarbellDrawing plates={below ? [] : r.plates} collars={prefs.collars} />
            </div>
            <div>
              <p className="mb-2 text-center text-[13px] text-muted-foreground">En cada lado</p>
              <div className="flex flex-wrap justify-center gap-1.5">
                {below ? (
                  <span className="text-sm text-muted-foreground">Es menos que la barra sola</span>
                ) : grouped.length === 0 ? (
                  <span className="text-sm text-muted-foreground">Solo la barra</span>
                ) : (
                  grouped.map(([kg, n]) => (
                    <span key={kg} className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] py-1 pl-1.5 pr-3 text-[14px] font-bold">
                      <span className="block h-3.5 w-3.5 rounded-full border border-white/25" style={{ background: plateLook(kg).color }} />
                      {n > 1 ? `${n} × ` : ""}{formatKg(kg)}
                    </span>
                  ))
                )}
              </div>
            </div>
            {r.rest > 0 && !below && (
              <div className="space-y-2">
                <p className="rounded-[14px] px-3 py-2.5 text-[13.5px]" style={{ background: "#2A1E10", color: "#FFB35C" }}>
                  Con tus discos no sale justo: faltan <b style={{ color: "#FFD199" }}>{formatKg(r.rest)} kg</b>.
                </p>
                <div className="flex gap-2">
                  {lo != null && <button type="button" onClick={() => { setChip(null); setTarget(lo); }} className="min-h-11 flex-1 rounded-[14px] bg-white/[0.08] text-[14px] font-bold">{formatKg(lo)} kg</button>}
                  {hi != null && <button type="button" onClick={() => { setChip(null); setTarget(hi); }} className="min-h-11 flex-1 rounded-[14px] bg-white/[0.08] text-[14px] font-bold">{formatKg(hi)} kg</button>}
                </div>
              </div>
            )}
            <p className="text-center text-[13px] text-muted-foreground">
              Barra {formatKg(bar)} kg{prefs.collars ? " + collarines 5 kg" : ""}{!below ? ` + ${formatKg(Math.max(0, r.perSide))} kg por lado` : ""}
              {prefs.lb ? ` · ${formatKg(Math.round(target * 2.20462 * 10) / 10)} lb` : ""}
            </p>
            {onApply && (
              <button type="button" onClick={() => { onApply(target); onClose(); }} className="min-h-[52px] w-full rounded-full text-[16px] font-extrabold" style={{ background: "var(--gold)", color: "var(--gold-foreground)" }}>
                Apuntar {formatKg(target)} kg
              </button>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

function Toggle({ label, hint, on, onChange }: { label: string; hint: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!on)} aria-pressed={on} className="flex w-full items-center justify-between gap-3 rounded-[16px] bg-white/[0.05] px-3.5 py-3 text-left">
      <span><span className="block text-[15px] font-bold">{label}</span><span className="block text-[13px] text-muted-foreground">{hint}</span></span>
      <span className="relative h-[30px] w-[50px] shrink-0 rounded-full transition-colors" style={{ background: on ? "var(--gold)" : "rgba(255,255,255,.12)" }}>
        <span className="absolute top-[3px] h-6 w-6 rounded-full transition-all" style={{ left: on ? 23 : 3, background: on ? "#0C0C0E" : "#fff" }} />
      </span>
    </button>
  );
}

/** Línea bajo el peso: la barra montada en pequeño. Al tocarla se abre la calculadora. */
export function PlateButton({ total, work, onApply }: { total: number | null; work?: number | null; onApply?: (kg: number) => void }) {
  const { data: settings } = useSettings();
  const [prefs] = usePlatePrefs();
  const [open, setOpen] = useState(false);
  const plates = settings?.plate_weights?.length ? settings.plate_weights.map(Number) : [25, 20, 15, 10, 5, 2.5, 1.25];
  const bars = settings?.bar_weights?.length ? settings.bar_weights.map(Number) : [20, 15, 10];
  const bar = bars.includes(prefs.bar) ? prefs.bar : Math.max(...bars);
  const r = total && total > 0 ? loadBar(total, bar, plates, prefs.collars ? 5 : 0) : null;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="pressable mt-2 flex w-full items-center gap-3 rounded-[12px] bg-black/30 px-3 py-2.5 text-left">
        <span className="w-[120px] shrink-0"><BarbellDrawing plates={r && r.perSide >= 0 ? r.plates : []} collars={prefs.collars} height={40} /></span>
        <span className="min-w-0 flex-1 text-sm text-foreground/85">
          {!r ? (
            <>Calculadora de discos</>
          ) : r.perSide < 0 ? (
            <>Menos que la barra de {formatKg(bar)}</>
          ) : r.plates.length === 0 ? (
            <>Solo la barra de {formatKg(bar)}</>
          ) : (
            <><b>{r.plates.map(formatKg).join(" + ")}</b> por lado</>
          )}
          {r && r.rest > 0 && <span className="block text-xs" style={{ color: "#FFB35C" }}>Con tus discos faltan {formatKg(r.rest)} kg</span>}
        </span>
        <span className="text-[12.5px] font-bold text-gold">Ver</span>
      </button>
      {open && <PlateSheet initial={total} work={work} onApply={onApply} onClose={() => setOpen(false)} />}
    </>
  );
}
