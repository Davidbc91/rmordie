import { useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronRight, Pencil, Plus, Undo2, X } from "lucide-react";
import { toast } from "sonner";
import { localDay } from "@/lib/analytics";
import {
  flagMovements, LEVEL_HINT, useCheckin, useCoachAthleteInjuries, useDaySwaps, useDeleteInjury, useHealInjury, useInjuries, useSaveInjury, useSaveSwap,
  zoneLabel, ZONES, type Injury, type Side, type Zone,
} from "@/lib/injuries";

const ORANGE = "#FF8A3D";
const levelColor = (l: number) => (l >= 5 ? "#FF5A4E" : l >= 3 ? ORANGE : "#FFC35C");

function Sheet({ children, onClose, label }: { children: ReactNode; onClose: () => void; label: string }) {
  return createPortal(
    <div className="fixed inset-0 z-[74] flex items-end" role="dialog" aria-label={label}>
      <button aria-label="Cerrar" onClick={onClose} className="absolute inset-0 bg-black/60 backdrop-blur-[4px]" />
      <div className="animate-fade relative mx-auto max-h-[92dvh] w-full max-w-2xl overflow-y-auto overscroll-contain rounded-t-[28px] border-t border-white/10 bg-[color:var(--level-1)] px-4 pt-3" style={{ paddingBottom: "max(env(safe-area-inset-bottom), 18px)" }}>
        <div aria-hidden className="mx-auto mb-2 h-[5px] w-10 rounded-full bg-white/20" />
        {children}
      </div>
    </div>,
    document.body,
  );
}

/* ---------------- Cuerpo para elegir la zona ---------------- */

// Vista de frente: el lado derecho de la persona queda a la izquierda del dibujo
const SPOTS: { zone: Zone; side: Side; x: number; y: number }[] = [
  { zone: "cuello", side: "none", x: 50, y: 34 },
  { zone: "hombro", side: "right", x: 27, y: 46 }, { zone: "hombro", side: "left", x: 73, y: 46 },
  { zone: "codo", side: "right", x: 17, y: 72 }, { zone: "codo", side: "left", x: 83, y: 72 },
  { zone: "muneca", side: "right", x: 12, y: 96 }, { zone: "muneca", side: "left", x: 88, y: 96 },
  { zone: "lumbar", side: "none", x: 50, y: 88 },
  { zone: "cadera", side: "right", x: 38, y: 104 }, { zone: "cadera", side: "left", x: 62, y: 104 },
  { zone: "rodilla", side: "right", x: 39, y: 150 }, { zone: "rodilla", side: "left", x: 61, y: 150 },
  { zone: "tobillo", side: "right", x: 39, y: 192 }, { zone: "tobillo", side: "left", x: 61, y: 192 },
];

function BodyPicker({ zone, side, onPick }: { zone: Zone | null; side: Side; onPick: (z: Zone, s: Side) => void }) {
  return (
    <svg viewBox="0 0 100 210" className="h-[230px]" role="group" aria-label="Elige la zona">
      <g fill="#2C2C2F">
        <circle cx="50" cy="16" r="12" /><rect x="44" y="27" width="12" height="9" rx="3" />
        <path d="M29 38h42l4 62H25z" />
        <rect x="11" y="40" width="12" height="60" rx="6" transform="rotate(7 17 40)" /><rect x="77" y="40" width="12" height="60" rx="6" transform="rotate(-7 83 40)" />
        <rect x="31" y="100" width="16" height="100" rx="8" /><rect x="53" y="100" width="16" height="100" rx="8" />
      </g>
      {SPOTS.map((s) => {
        const on = zone === s.zone && (s.side === "none" || side === s.side || side === "both");
        return (
          <g key={`${s.zone}-${s.side}`} onClick={() => onPick(s.zone, s.side)} style={{ cursor: "pointer" }}>
            <circle cx={s.x} cy={s.y} r="11" fill="transparent" />
            {on && <circle cx={s.x} cy={s.y} r="12" fill={ORANGE} opacity=".2" />}
            <circle cx={s.x} cy={s.y} r={on ? 7 : 5} fill={on ? ORANGE : "rgba(255,255,255,.22)"} />
          </g>
        );
      })}
    </svg>
  );
}

/* ---------------- Apuntar o editar una molestia ---------------- */

export function InjuryEditor({ injury, onClose }: { injury?: Injury | null; onClose: () => void }) {
  const save = useSaveInjury();
  const [zone, setZone] = useState<Zone | null>(injury?.zone ?? null);
  const [side, setSide] = useState<Side>(injury?.side ?? "right");
  const [level, setLevel] = useState(injury?.level ?? 3);
  const [when, setWhen] = useState<"hoy" | "semana" | "mas">("hoy");
  const [note, setNote] = useState(injury?.note ?? "");
  const sided = ZONES.find((z) => z.key === zone)?.sided ?? false;

  const submit = () => {
    if (!zone) return toast.error("Elige dónde te molesta");
    const started = injury?.started_on ?? (when === "hoy" ? localDay() : when === "semana" ? localDay(new Date(Date.now() - 3 * 864e5)) : localDay(new Date(Date.now() - 14 * 864e5)));
    save.mutate({ id: injury?.id, zone, side: sided ? side : "none", level, started_on: started, note: note.trim() || null, status: "active" }, {
      onSuccess: () => { toast.success(injury ? "Molestia actualizada" : "Molestia apuntada. La tendré en cuenta en tus entrenos"); onClose(); },
      onError: (e: any) => toast.error(/injur/i.test(e?.message ?? "") ? "Falta aplicar la migración de molestias en Lovable" : e?.message ?? "No se pudo guardar"),
    });
  };
  const chip = (on: boolean) => (on ? { background: "#2A1E10", color: ORANGE, boxShadow: "inset 0 0 0 1px rgba(255,138,61,.4)" } : { background: "rgba(255,255,255,.07)", color: "var(--muted-foreground)" });

  return (
    <Sheet onClose={onClose} label="Molestia">
      <div className="flex items-center justify-between">
        <h2 className="text-[19px] font-extrabold">{injury ? "Editar molestia" : "Nueva molestia"}</h2>
        <button type="button" onClick={onClose} aria-label="Cerrar" className="grid h-10 w-10 place-items-center rounded-full bg-white/[0.07]"><X className="h-[18px] w-[18px]" /></button>
      </div>
      <div className="mt-2 flex flex-col gap-3.5 pb-1">
        <div className="flex items-center justify-center gap-5">
          <BodyPicker zone={zone} side={side} onPick={(z, s) => { setZone(z); if (s !== "none") setSide(s); }} />
          <div className="flex flex-col gap-1 text-[12.5px] text-muted-foreground">
            <span>Toca la zona</span>
            {zone && <span className="text-[14px] font-extrabold" style={{ color: ORANGE }}>{zoneLabel(zone, sided ? side : "none")}</span>}
            <span className="mt-2 text-[11.5px]">Vista de frente</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {ZONES.map((z) => <button key={z.key} type="button" onClick={() => setZone(z.key)} className="min-h-9 rounded-full px-3 text-[13px] font-bold" style={chip(zone === z.key)}>{z.label}</button>)}
        </div>
        {sided && (
          <div className="flex gap-1 rounded-[12px] bg-white/[0.05] p-1">
            {([["right", "Derecho"], ["left", "Izquierdo"], ["both", "Los dos"]] as const).map(([k, l]) => (
              <button key={k} type="button" onClick={() => setSide(k)} className="min-h-10 flex-1 rounded-[9px] text-[13px] font-bold" style={side === k ? { background: "var(--gold-tint)", color: "var(--gold)" } : { color: "var(--muted-foreground)" }}>{l}</button>
            ))}
          </div>
        )}
        <div>
          <p className="mb-2 text-[13px] font-bold text-muted-foreground">¿Cuánto molesta?</p>
          <div className="grid grid-cols-5 gap-1.5">
            {[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" onClick={() => setLevel(n)} className="h-11 rounded-[12px] text-[16px] font-extrabold" style={level === n ? { background: levelColor(n), color: "#0C0C0E" } : { background: "rgba(255,255,255,.07)", color: "var(--muted-foreground)" }}>{n}</button>)}
          </div>
          <p className="mt-1.5 text-[13px] text-muted-foreground">{level} · {LEVEL_HINT[level]}</p>
        </div>
        {!injury && (
          <div>
            <p className="mb-2 text-[13px] font-bold text-muted-foreground">¿Cuándo empezó?</p>
            <div className="flex gap-1 rounded-[12px] bg-white/[0.05] p-1">
              {([["hoy", "Hoy"], ["semana", "Esta semana"], ["mas", "Hace más"]] as const).map(([k, l]) => (
                <button key={k} type="button" onClick={() => setWhen(k)} className="min-h-10 flex-1 rounded-[9px] text-[13px] font-bold" style={when === k ? { background: "var(--gold-tint)", color: "var(--gold)" } : { color: "var(--muted-foreground)" }}>{l}</button>
              ))}
            </div>
          </div>
        )}
        <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="Nota (opcional): «Al bajar en el press»" className="min-h-12 rounded-[14px] border border-white/10 bg-white/[0.05] px-3.5 text-[15px] outline-none focus:border-[color:var(--gold)]/55" />
        {level >= 4 && <p className="rounded-[14px] px-3 py-2.5 text-[13px]" style={{ background: "#2A1414", color: "#FF9E96" }}>Si duele de verdad, para y consúltalo con un fisio o un médico. Esto solo te ayuda a adaptar el entreno.</p>}
        <button type="button" disabled={save.isPending} onClick={submit} className="min-h-[52px] rounded-full text-[16px] font-extrabold disabled:opacity-60" style={{ background: "var(--gold)", color: "var(--gold-foreground)" }}>{save.isPending ? "Guardando…" : "Guardar"}</button>
      </div>
    </Sheet>
  );
}

/* ---------------- Seguimiento (perfil) ---------------- */

function Spark({ points }: { points: { day: string; level: number }[] }) {
  const days = Array.from({ length: 7 }, (_, i) => localDay(new Date(Date.now() - (6 - i) * 864e5)));
  const by = new Map(points.map((p) => [p.day, p.level]));
  let last: number | null = null;
  return (
    <div className="flex h-10 items-end gap-1" aria-label="Evolución de los últimos 7 días">
      {days.map((d) => {
        const v = by.get(d) ?? null;
        if (v != null) last = v;
        const shown = v ?? last;
        return <span key={d} className="block flex-1 rounded-[4px_4px_2px_2px]" style={{ height: shown ? `${shown * 20}%` : 4, background: shown ? levelColor(shown) : "rgba(255,255,255,.08)", opacity: v == null && shown ? 0.4 : 1 }} />;
      })}
    </div>
  );
}

export function InjuriesCard() {
  const { data, isError } = useInjuries();
  const checkin = useCheckin();
  const heal = useHealInjury();
  const del = useDeleteInjury();
  const [editing, setEditing] = useState<Injury | null | "new">(null);
  const [showHealed, setShowHealed] = useState(false);
  if (isError) return null;
  const today = localDay();
  const active = (data?.injuries ?? []).filter((i) => i.status === "active");
  const healed = (data?.injuries ?? []).filter((i) => i.status === "healed");
  const cks = data?.checkins ?? [];

  return (
    <section className="rise rise-3 mt-4 flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between px-1">
        <h2 className="text-[17px] font-extrabold tracking-tight">Molestias</h2>
        {active.length > 0 && <button type="button" onClick={() => setEditing("new")} className="text-[13px] font-bold text-gold">+ Apuntar</button>}
      </div>
      {active.length === 0 && (
        <button type="button" onClick={() => setEditing("new")} className="pressable flex min-h-[58px] items-center gap-3 rounded-[18px] border border-white/[0.09] bg-white/[0.045] px-4 text-left">
          <span className="min-w-0 flex-1"><span className="block text-[15px] font-semibold">¿Te molesta algo?</span><span className="block text-[13px] text-muted-foreground">Apúntalo y adapto tus entrenos</span></span>
          <Plus className="h-4 w-4 text-muted-foreground" />
        </button>
      )}
      {active.map((i) => {
        const pts = cks.filter((c) => c.injury_id === i.id);
        const todayLevel = pts.find((c) => c.day === today)?.level ?? null;
        const first = pts[0]?.level ?? i.level;
        const trend = pts.length > 1 ? (i.level < first ? "mejorando" : i.level > first ? "empeorando" : "igual") : null;
        return (
          <div key={i.id} className="flex flex-col gap-2.5 rounded-[22px] bg-card p-3.5">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] text-[18px]" style={{ background: "#2A1E10" }}>🩹</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-bold">{zoneLabel(i.zone, i.side)}</span>
                <span className="block truncate text-[12.5px] text-muted-foreground">Desde el {new Date(`${i.started_on}T12:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}{i.note ? ` · «${i.note}»` : ""}</span>
              </span>
              <span className="shrink-0 rounded-full px-2.5 py-1 text-[12.5px] font-extrabold" style={{ background: "#2A1E10", color: levelColor(i.level) }}>{i.level}/5</span>
              <button type="button" onClick={() => setEditing(i)} aria-label="Editar" className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted-foreground"><Pencil className="h-4 w-4" /></button>
            </div>
            <Spark points={pts} />
            {trend && <p className="-mt-1 text-[12.5px]" style={{ color: trend === "mejorando" ? "var(--gold)" : trend === "empeorando" ? ORANGE : "var(--muted-foreground)" }}>Últimos días · {trend}{trend !== "igual" ? ` (de ${first} a ${i.level})` : ""}</p>}
            <p className="text-[13px] font-bold text-muted-foreground">¿Cómo está hoy?</p>
            <div className="grid grid-cols-5 gap-1.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" onClick={() => checkin.mutate({ injury: i, level: n })} className="h-11 rounded-[12px] text-[16px] font-extrabold" style={todayLevel === n ? { background: levelColor(n), color: "#0C0C0E" } : { background: "rgba(255,255,255,.07)", color: "var(--muted-foreground)" }}>{n}</button>
              ))}
            </div>
            <button type="button" onClick={() => heal.mutate({ id: i.id, healed: true }, { onSuccess: () => toast.success("¡Bien! Marcada como curada") })} className="flex min-h-11 items-center justify-center gap-1.5 rounded-full bg-white/[0.07] text-[14px] font-bold"><Check className="h-4 w-4" />Ya está curada</button>
          </div>
        );
      })}
      {healed.length > 0 && (
        <>
          <button type="button" onClick={() => setShowHealed((v) => !v)} className="flex min-h-9 items-center gap-1 px-1 text-left text-[13px] font-semibold text-muted-foreground">Curadas ({healed.length}) <ChevronRight className={`h-4 w-4 transition-transform ${showHealed ? "rotate-90" : ""}`} /></button>
          {showHealed && healed.map((i) => (
            <div key={i.id} className="flex items-center gap-3 rounded-[16px] bg-card px-3.5 py-2.5">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px]" style={{ background: "var(--gold-tint-2)", color: "var(--gold)" }}><Check className="h-4 w-4" /></span>
              <span className="min-w-0 flex-1"><span className="block text-[14px] font-bold">{zoneLabel(i.zone, i.side)}</span><span className="block text-[12.5px] text-muted-foreground">{i.healed_on ? `Curada el ${new Date(`${i.healed_on}T12:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}` : "Curada"}</span></span>
              <button type="button" onClick={() => heal.mutate({ id: i.id, healed: false })} className="min-h-9 text-[12.5px] font-semibold text-muted-foreground">Vuelve a molestar</button>
              <button type="button" onClick={() => { if (window.confirm("¿Borrar esta molestia del historial?")) del.mutate(i.id); }} aria-label="Borrar" className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground"><X className="h-4 w-4" /></button>
            </div>
          ))}
        </>
      )}
      {editing && <InjuryEditor injury={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </section>
  );
}

/* ---------------- En el entreno ---------------- */

export function WorkoutInjuryBanner({ month, week, day, blocks }: { month: string; week: number; day: string; blocks: { key: string; content: string }[] }) {
  const { data } = useInjuries();
  const { data: swaps = [] } = useDaySwaps(month, week, day);
  const saveSwap = useSaveSwap();
  const checkin = useCheckin();
  const [open, setOpen] = useState<{ block: string; mov: ReturnType<typeof flagMovements>[number]["mov"]; zones: Zone[] } | null>(null);
  const active = (data?.injuries ?? []).filter((i) => i.status === "active");
  const zones = useMemo(() => new Set(active.map((i) => i.zone)), [active]);
  const flags = useMemo(() => blocks.flatMap((b) => flagMovements(b.content, zones).map((f) => ({ block: b.key, ...f }))), [blocks, zones]);
  if (!active.length) return null;
  const today = localDay();
  const unchecked = active.filter((i) => !(data?.checkins ?? []).some((c) => c.injury_id === i.id && c.day === today));
  const injFor = (zs: Zone[]) => active.filter((i) => zs.includes(i.zone));

  return (
    <section className="mb-4 flex flex-col gap-2 rounded-[20px] border p-3.5" style={{ background: "#1E1710", borderColor: "rgba(255,138,61,.3)" }}>
      <p className="text-[14px]" style={{ color: "#FFB989" }}>
        🩹 Tienes <b className="text-foreground">{active.map((i) => `${zoneLabel(i.zone, i.side).toLowerCase()} (${i.level}/5)`).join(", ")}</b>.
        {flags.length ? ` He marcado ${flags.length} ${flags.length === 1 ? "movimiento que lo carga" : "movimientos que lo cargan"}.` : " Hoy no veo movimientos que lo carguen."}
      </p>
      {flags.map((f) => {
        const sw = swaps.find((s) => s.block_key === f.block && s.original === f.mov.name);
        return (
          <div key={`${f.block}-${f.mov.name}`} className="flex items-center gap-2.5 rounded-[14px] bg-black/25 px-3 py-2">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-[9px] text-[12.5px] font-extrabold bg-white/[0.08]">{f.block}</span>
            <span className="min-w-0 flex-1">
              <span className={`block truncate text-[14px] font-bold ${sw ? "text-muted-foreground line-through" : ""}`}>{f.mov.name}</span>
              {sw ? <span className="block truncate text-[13px] font-bold text-gold">→ {sw.replacement}</span> : <span className="block truncate text-[12px]" style={{ color: ORANGE }}>Carga: {f.zones.map((z) => ZONES.find((x) => x.key === z)?.label.toLowerCase()).join(", ")}</span>}
            </span>
            {sw ? (
              <button type="button" onClick={() => saveSwap.mutate({ month_key: month, week, day_key: day, block_key: f.block, original: f.mov.name, replacement: null })} aria-label="Deshacer cambio" className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted-foreground"><Undo2 className="h-4 w-4" /></button>
            ) : (
              <button type="button" onClick={() => setOpen({ block: f.block, mov: f.mov, zones: f.zones })} className="min-h-9 shrink-0 rounded-[10px] px-3 text-[12.5px] font-extrabold" style={{ background: "var(--gold)", color: "var(--gold-foreground)" }}>Alternativas</button>
            )}
          </div>
        );
      })}
      {unchecked.map((i) => (
        <div key={i.id} className="flex items-center gap-2">
          <span className="min-w-0 flex-1 text-[13px] text-muted-foreground">¿Cómo está hoy tu {zoneLabel(i.zone, i.side).toLowerCase()}?</span>
          {[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" onClick={() => checkin.mutate({ injury: i, level: n })} className="h-9 w-9 rounded-[10px] bg-white/[0.08] text-[14px] font-extrabold">{n}</button>)}
        </div>
      ))}
      {open && (
        <Sheet onClose={() => setOpen(null)} label="Alternativas">
          <div className="flex items-center justify-between">
            <h2 className="text-[18px] font-extrabold">Alternativas para tu {injFor(open.zones).map((i) => ZONES.find((z) => z.key === i.zone)?.label.toLowerCase()).join(" y ")}</h2>
            <button type="button" onClick={() => setOpen(null)} aria-label="Cerrar" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/[0.07]"><X className="h-[18px] w-[18px]" /></button>
          </div>
          <p className="text-[13px] text-muted-foreground">Para «{open.mov.name}» en el bloque {open.block}</p>
          <div className="mt-3 flex flex-col gap-1.5">
            {[...open.mov.alts, { name: "Mismo movimiento, bajando la carga un 15 %", why: "Si no duele con menos peso" }].map((a) => (
              <div key={a.name} className="flex items-center gap-3 rounded-[14px] bg-white/[0.05] px-3 py-2.5">
                <span className="min-w-0 flex-1"><span className="block text-[15px] font-bold">{a.name}</span><span className="block text-[12.5px] text-muted-foreground">{a.why}</span></span>
                <button type="button" onClick={() => saveSwap.mutate({ month_key: month, week, day_key: day, block_key: open.block, original: open.mov.name, replacement: a.name.slice(0, 120) }, {
                  onSuccess: () => { toast.success("Cambio apuntado en tu entreno"); setOpen(null); },
                  onError: () => toast.error("No se pudo guardar el cambio"),
                })} className="min-h-9 shrink-0 rounded-[10px] px-3 text-[12.5px] font-extrabold" style={{ background: "var(--gold)", color: "var(--gold-foreground)" }}>Cambiar</button>
              </div>
            ))}
          </div>
          <p className="mt-3 text-center text-[12.5px] text-muted-foreground">El cambio queda solo en tu entreno. Si compartes tus entrenos con tu entrenador, lo verá.</p>
        </Sheet>
      )}
    </section>
  );
}

/* ---------------- Para el entrenador ---------------- */

export function CoachInjuriesCard({ athleteId }: { athleteId: string }) {
  const { data } = useCoachAthleteInjuries(athleteId);
  if (!data || (!data.injuries.length && !data.swaps.length)) return null;
  return (
    <section className="flex flex-col gap-2 rounded-[22px] border p-3.5" style={{ background: "#1E1710", borderColor: "rgba(255,138,61,.3)" }}>
      <span className="text-[15px] font-bold">Molestias</span>
      {data.injuries.map((i) => {
        const pts = i.checkins;
        const first = pts[0]?.level ?? i.level;
        return (
          <div key={i.id} className="flex items-center gap-2 text-[13.5px]">
            <span className="rounded-full px-2.5 py-1 text-[12.5px] font-extrabold" style={i.status === "active" ? { background: "#2A1E10", color: levelColor(i.level) } : { background: "var(--gold-tint-2)", color: "var(--gold)" }}>
              {i.status === "active" ? `🩹 ${zoneLabel(i.zone, i.side, true)} ${i.level}/5` : `✓ ${zoneLabel(i.zone, i.side, true)}`}
            </span>
            <span className="text-muted-foreground">{i.status === "healed" ? "curada" : pts.length > 1 ? (i.level < first ? "mejorando" : i.level > first ? "empeorando" : "igual") : `desde el ${new Date(`${i.started_on}T12:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}`}</span>
          </div>
        );
      })}
      {data.swaps.slice(0, 4).map((s, k) => (
        <p key={k} className="text-[13px] text-muted-foreground">Cambió <b className="text-foreground">{s.original}</b> por <b className="text-gold">{s.replacement}</b> el {new Date(s.created_at).toLocaleDateString("es-ES", { weekday: "long", day: "numeric" })}.</p>
      ))}
    </section>
  );
}
