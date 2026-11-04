import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Copy, Minus, MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { usePlanning, useSavePlanning, usePersonalRecords } from "@/lib/store";
import { getCurrentUserId } from "@/lib/pin-gate";
import { detectExercise, loadsForPercentages, formatKg } from "@/lib/rm-matcher";
import { movements } from "@/lib/dictionary/catalog";
import { addDays, parseISODate } from "@/lib/plan-dates";
import {
  DAY_SHORT,
  addWeek,
  blockContent,
  blockLetter,
  blockSummary,
  cloneBlocks,
  copyWeekForward,
  createPlan,
  dayHasContent,
  emptyExercise,
  newBlock,
  nextMonday,
  readBuilder,
  toPlanning,
  validatePlan,
  type PBlock,
  type PDay,
  type PExercise,
  type PlanState,
  type WodFormat,
} from "@/lib/plan-builder";

export const Route = createFileRoute("/plan-builder")({
  head: () => ({
    meta: [
      { title: "Crear planificación — RM OR DIE" },
      { name: "description", content: "Crea tu planificación de CrossFit a mano: eliges fechas, rellenas cada día por bloques y copias semanas." },
    ],
  }),
  component: PlanBuilderPage,
});

const DRAFT_KEY = "rmordie_plan_builder_draft";
const font = { fontFamily: "var(--font-editorial)" } as const;
const WEEKDAY_LETTERS = ["L", "M", "X", "J", "V", "S", "D"];
const PCTS = ["65", "70", "75", "80", "85"];
const FORMATS: { id: WodFormat; label: string }[] = [
  { id: "AMRAP", label: "AMRAP" },
  { id: "EMOM", label: "EMOM" },
  { id: "FOR TIME", label: "For Time" },
  { id: "TABATA", label: "Tabata" },
];

const shortDate = (iso: string) =>
  (parseISODate(iso) ?? new Date()).toLocaleDateString("es-ES", { day: "numeric", month: "short" }).replace(".", "");
const longDate = (iso: string) =>
  (parseISODate(iso) ?? new Date()).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });

function readDraft(): PlanState | null {
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    return raw ? readBuilder(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}
function writeDraft(plan: PlanState | null) {
  try {
    if (plan) window.localStorage.setItem(DRAFT_KEY, JSON.stringify(plan));
    else window.localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* sin almacenamiento */
  }
}

function PlanBuilderPage() {
  const navigate = useNavigate();
  const { data: current, isLoading } = usePlanning();
  const save = useSavePlanning();
  const myUid = getCurrentUserId();
  const ownBuilder = current && current.user_id === myUid ? readBuilder(current.data.builder) : null;

  const [plan, setPlan] = useState<PlanState | null>(null);
  const [dirty, setDirty] = useState(false);
  const [weekIdx, setWeekIdx] = useState(0);
  const [dayIdx, setDayIdx] = useState<number | null>(null);
  const [initialized, setInitialized] = useState(false);

  // Al entrar: borrador sin guardar → plan propio del planificador → pantalla de inicio
  useEffect(() => {
    if (initialized || isLoading) return;
    const draft = readDraft();
    if (draft) {
      setPlan(draft);
      setDirty(true);
    } else if (ownBuilder) {
      setPlan(ownBuilder);
    }
    setInitialized(true);
  }, [initialized, isLoading, ownBuilder]);

  function change(next: PlanState) {
    setPlan(next);
    setDirty(true);
    writeDraft(next);
  }

  async function onSave() {
    if (!plan) return;
    const err = validatePlan(plan);
    if (err) return toast.error(err);
    try {
      await save.mutateAsync({ planning: toPlanning(plan), filename: plan.name });
      writeDraft(null);
      setDirty(false);
      toast.success("Plan guardado. Ya está en tu calendario.");
      navigate({ to: "/calendar" });
    } catch (e) {
      toast.error(`No se pudo guardar: ${(e as { message?: string })?.message ?? "error desconocido"}`);
    }
  }

  function exit() {
    if (dirty && !window.confirm("Tienes cambios sin guardar. Se quedan como borrador en este móvil. ¿Salir?")) return;
    navigate({ to: "/import" });
  }

  if (isLoading || !initialized) {
    return (
      <AppShell>
        <p className="mt-10 text-sm text-muted-foreground">Cargando…</p>
      </AppShell>
    );
  }

  if (!plan) {
    return (
      <AppShell>
        <StartScreen
          hasActive={!!current && current.data.months.length > 0}
          onBack={() => navigate({ to: "/import" })}
          onCreate={(p) => {
            change(p);
            setWeekIdx(0);
          }}
        />
      </AppShell>
    );
  }

  const week = plan.weeks[Math.min(weekIdx, plan.weeks.length - 1)];

  if (dayIdx != null) {
    return (
      <AppShell>
        <DayEditor
          plan={plan}
          weekIdx={weekIdx}
          dayIdx={dayIdx}
          onChange={change}
          onBack={() => setDayIdx(null)}
          onNext={() => {
            // Siguiente día de entreno (salta descansos); al acabar la semana, vuelve a la semana
            for (let i = dayIdx + 1; i < 7; i++) {
              if (!week[i].rest) return setDayIdx(i);
            }
            setDayIdx(null);
          }}
        />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <WeekView
        plan={plan}
        weekIdx={weekIdx}
        setWeekIdx={setWeekIdx}
        onOpenDay={setDayIdx}
        onChange={change}
        onSave={onSave}
        saving={save.isPending}
        onExit={exit}
        onDiscard={() => {
          if (!window.confirm("¿Descartar este plan sin guardar y empezar de cero?")) return;
          writeDraft(null);
          setDirty(false);
          setPlan(null);
        }}
      />
    </AppShell>
  );
}

// ---------------------------------------------------------------------------
// Paso 1: nombre, fecha, semanas y días
// ---------------------------------------------------------------------------
function StartScreen({ hasActive, onBack, onCreate }: { hasActive: boolean; onBack: () => void; onCreate: (p: PlanState) => void }) {
  const [name, setName] = useState("");
  const [start, setStart] = useState(nextMonday());
  const [weeks, setWeeks] = useState(4);
  const [days, setDays] = useState([true, true, true, false, true, true, false]);
  const monday = useMemo(() => {
    const d = parseISODate(start) ?? new Date();
    return addDays(d, -((d.getDay() + 6) % 7));
  }, [start]);
  const end = addDays(monday, weeks * 7 - 1);
  const fmt = (d: Date) => d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="page-enter space-y-5">
      <div className="flex items-center justify-between">
        <button type="button" onClick={onBack} className="flex min-h-11 items-center gap-1 pr-2 text-[15px] text-muted-foreground">
          <ChevronLeft className="h-[18px] w-[18px]" /> Planificación
        </button>
        <span className="text-[13px] text-muted-foreground">Paso 1 de 2</span>
      </div>

      <div>
        <p className="eyebrow">Crear a mano</p>
        <h1 className="page-title mt-1">Nuevo plan</h1>
      </div>

      <label className="block">
        <span className="mb-1.5 block text-[13px] text-muted-foreground">Nombre del plan</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Bloque de fuerza noviembre"
          maxLength={60}
          className="min-h-[52px] w-full rounded-[14px] border border-white/[0.14] bg-white/[0.06] px-3.5 text-base outline-none focus:border-[color:var(--gold)]/60"
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-[13px] text-muted-foreground">Empieza la semana del</span>
        <input
          type="date"
          value={start}
          onChange={(e) => e.target.value && setStart(e.target.value)}
          className="min-h-14 w-full rounded-[14px] border border-[color:var(--gold)]/50 bg-white/[0.06] px-3.5 text-lg font-bold outline-none"
        />
        <span className="mt-1.5 block text-[13px] text-muted-foreground">Primer día: {fmt(monday)}</span>
      </label>

      <div>
        <span className="mb-1.5 block text-[13px] text-muted-foreground">¿Cuántas semanas?</span>
        <div role="group" aria-label="Semanas" className="grid grid-cols-4 gap-1.5">
          {[4, 6, 8, 12].map((n) => (
            <button key={n} type="button" aria-pressed={weeks === n} onClick={() => setWeeks(n)}
              className={`h-[52px] rounded-[12px] text-2xl font-extrabold ${weeks === n ? "bg-[color:var(--gold)] text-[color:var(--gold-foreground)]" : "bg-white/[0.06]"}`} style={font}>
              {n}
            </button>
          ))}
        </div>
        <span className="mt-1.5 block text-[13px] text-muted-foreground">Hasta el {fmt(end)}</span>
      </div>

      <div>
        <span className="mb-1.5 block text-[13px] text-muted-foreground">¿Qué días entrenas?</span>
        <div role="group" aria-label="Días de entreno" className="grid grid-cols-7 gap-1.5">
          {WEEKDAY_LETTERS.map((l, i) => (
            <button key={l} type="button" aria-pressed={days[i]} aria-label={DAY_SHORT[i]} onClick={() => setDays((d) => d.map((x, j) => (j === i ? !x : x)))}
              className={`h-12 rounded-[12px] text-base font-extrabold ${days[i] ? "bg-[color:var(--gold)] text-[color:var(--gold-foreground)]" : "bg-white/[0.06] text-muted-foreground"}`}>
              {l}
            </button>
          ))}
        </div>
        <span className="mt-1.5 block text-[13px] text-muted-foreground">Los demás quedan como descanso. Lo puedes cambiar luego.</span>
      </div>

      <button
        type="button"
        disabled={!days.some(Boolean)}
        onClick={() => onCreate(createPlan(name, start, weeks, days))}
        className="pressable gold-gradient cta-display min-h-[60px] w-full rounded-[18px] disabled:opacity-40"
      >
        Crear y rellenar los días
      </button>
      {hasActive && (
        <p className="text-center text-[13px] text-muted-foreground">
          Tu plan activo no se toca hasta que guardes este. El anterior queda en «Versiones anteriores».
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Paso 2: la semana de un vistazo
// ---------------------------------------------------------------------------
function WeekView({
  plan, weekIdx, setWeekIdx, onOpenDay, onChange, onSave, saving, onExit, onDiscard,
}: {
  plan: PlanState; weekIdx: number; setWeekIdx: (i: number) => void; onOpenDay: (i: number) => void;
  onChange: (p: PlanState) => void; onSave: () => void; saving: boolean; onExit: () => void; onDiscard: () => void;
}) {
  const w = Math.min(weekIdx, plan.weeks.length - 1);
  const week = plan.weeks[w];
  const train = week.filter((d) => !d.rest);
  const filled = train.filter(dayHasContent).length;
  const [menu, setMenu] = useState(false);

  function setRest(i: number, rest: boolean) {
    const weeks = plan.weeks.map((wk, wi) => (wi === w ? wk.map((d, di) => (di === i ? { ...d, rest } : d)) : wk));
    onChange({ ...plan, weeks });
  }
  function copyForward(bump: number) {
    const next = plan.weeks[w + 1];
    if (next && next.some(dayHasContent) && !window.confirm(`La semana ${w + 2} ya tiene días rellenos. ¿Sustituirla por una copia de esta?`)) return;
    onChange(copyWeekForward(plan, w, bump));
    setWeekIdx(w + 1);
    toast.success(bump ? `Semana ${w + 2} creada con +${String(bump).replace(".", ",")} %` : `Semana ${w + 2} copiada`);
  }
  function removeWeek() {
    if (plan.weeks.length <= 1) return;
    if (!window.confirm(`¿Quitar la semana ${w + 1}? Las siguientes se mueven una semana antes.`)) return;
    // Las fechas se recalculan desde el inicio para que no queden huecos
    const remaining = plan.weeks.filter((_, i) => i !== w);
    const start = parseISODate(plan.start)!;
    const weeks = remaining.map((wk, wi) => wk.map((d, di) => ({ ...d, date: dateIso(addDays(start, wi * 7 + di)) })));
    onChange({ ...plan, weeks });
    setWeekIdx(Math.max(0, w - 1));
    setMenu(false);
  }

  return (
    <div className="page-enter">
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={onExit} className="flex min-h-11 items-center gap-1 pr-2 text-[15px] text-muted-foreground">
          <ChevronLeft className="h-[18px] w-[18px]" /> Salir
        </button>
        <div className="flex items-center gap-1.5">
          <div className="relative">
            <button type="button" aria-label="Más opciones" onClick={() => setMenu((v) => !v)} className="grid h-11 w-11 place-items-center rounded-full bg-white/[0.06]">
              <MoreHorizontal className="h-5 w-5" />
            </button>
            {menu && (
              <div className="surface-sheet absolute right-0 top-12 z-30 w-64 p-1.5 text-[15px]">
                <button type="button" onClick={() => { onChange(addWeek(plan)); setMenu(false); setWeekIdx(plan.weeks.length); }} className="flex min-h-12 w-full items-center gap-2.5 rounded-[12px] px-3 text-left hover:bg-white/[0.05]">
                  <Plus className="h-4 w-4" /> Añadir una semana vacía
                </button>
                <button type="button" disabled={plan.weeks.length <= 1} onClick={removeWeek} className="flex min-h-12 w-full items-center gap-2.5 rounded-[12px] px-3 text-left text-red-300 hover:bg-white/[0.05] disabled:opacity-40">
                  <Trash2 className="h-4 w-4" /> Quitar la semana {w + 1}
                </button>
                <button type="button" onClick={() => { setMenu(false); onDiscard(); }} className="flex min-h-12 w-full items-center gap-2.5 rounded-[12px] px-3 text-left text-muted-foreground hover:bg-white/[0.05]">
                  <Trash2 className="h-4 w-4" /> Descartar y empezar de cero
                </button>
              </div>
            )}
          </div>
          <button type="button" onClick={onSave} disabled={saving} className="pressable gold-gradient min-h-11 rounded-[14px] px-4 text-[15px] font-extrabold disabled:opacity-50">
            {saving ? "Guardando…" : "Guardar plan"}
          </button>
        </div>
      </div>

      <p className="eyebrow mt-3 truncate">{plan.name}</p>
      <h1 className="page-title mt-1">Semana {w + 1}</h1>
      <p className="mt-0.5 text-sm text-muted-foreground">
        {shortDate(week[0].date)} – {shortDate(week[6].date)} · {filled} de {train.length} días rellenos
      </p>

      <div role="tablist" aria-label="Semanas" className="no-scrollbar -mx-1 mt-3 flex gap-1.5 overflow-x-auto px-1">
        {plan.weeks.map((wk, i) => {
          const done = wk.filter((d) => !d.rest).length > 0 && wk.filter((d) => !d.rest).every(dayHasContent);
          return (
            <button key={i} role="tab" aria-selected={i === w} onClick={() => setWeekIdx(i)}
              className={`h-10 min-w-[52px] shrink-0 rounded-[10px] px-2 text-sm font-bold ${i === w ? "bg-[color:var(--gold)] text-[color:var(--gold-foreground)]" : done ? "bg-[#8FD19E]/15 text-[#8FD19E]" : "bg-white/[0.06] text-muted-foreground"}`}>
              S{i + 1}{done && i !== w ? " ✓" : ""}
            </button>
          );
        })}
      </div>

      <div className="mt-3 space-y-2">
        {week.map((d, i) => {
          const date = parseISODate(d.date);
          const dateBox = (
            <span className="w-11 shrink-0 text-center">
              <span className="block text-[28px] font-extrabold leading-none" style={font}>{date?.getDate()}</span>
              <span className="text-xs text-muted-foreground">{DAY_SHORT[i]}</span>
            </span>
          );
          if (d.rest) {
            return (
              <div key={i} className="flex min-h-[52px] items-center gap-3.5 px-3.5 text-muted-foreground">
                {dateBox}
                <span className="flex-1 text-[15px]">Descanso</span>
                <button type="button" onClick={() => setRest(i, false)} className="min-h-11 px-1 text-sm font-bold text-gold">Entrenar</button>
              </div>
            );
          }
          const has = dayHasContent(d);
          const lines = d.blocks.filter((b) => blockContent(b).trim()).map((b, bi) => `${blockLetter(bi)} · ${blockSummary(b)}`);
          return (
            <div key={i} className={`flex min-h-[72px] items-center gap-3.5 rounded-[18px] px-3.5 ${has ? "bg-white/[0.045]" : "border-[1.5px] border-dashed border-[color:var(--gold)]/50"}`}>
              <button type="button" onClick={() => onOpenDay(i)} className="flex min-h-[72px] min-w-0 flex-1 items-center gap-3.5 text-left">
                {dateBox}
                {has ? (
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-bold">{lines[0]}</span>
                    {lines.length > 1 && <span className="block truncate text-[13px] text-muted-foreground">{lines.slice(1).join(" · ")}</span>}
                  </span>
                ) : (
                  <span className="flex-1 text-[15px] font-bold text-gold">+ Rellenar este día</span>
                )}
                {has && <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
              </button>
              {!has && (
                <button type="button" onClick={() => setRest(i, true)} className="min-h-11 shrink-0 text-[13px] text-muted-foreground">Descanso</button>
              )}
            </div>
          );
        })}
      </div>

      <section className="mt-4 rounded-[18px] border border-[color:var(--gold)]/30 bg-[color:var(--gold)]/[0.08] px-4 py-3.5">
        <p className="text-[15px] font-extrabold">Copiar esta semana a la {w + 1 < plan.weeks.length ? "siguiente" : "nueva semana " + (w + 2)}</p>
        <p className="text-[13px] text-muted-foreground">Para no escribir lo mismo varias veces. El % de los ejercicios de fuerza sube lo que elijas.</p>
        <div className="mt-2.5 grid grid-cols-3 gap-1.5">
          {[0, 2.5, 5].map((b) => (
            <button key={b} type="button" onClick={() => copyForward(b)} className="pressable h-11 rounded-[12px] bg-white/[0.08] text-sm font-bold">
              {b ? `+${String(b).replace(".", ",")} %` : "Igual"}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function dateIso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Editar un día
// ---------------------------------------------------------------------------
function DayEditor({ plan, weekIdx, dayIdx, onChange, onBack, onNext }: {
  plan: PlanState; weekIdx: number; dayIdx: number; onChange: (p: PlanState) => void; onBack: () => void; onNext: () => void;
}) {
  const { data: records = [] } = usePersonalRecords();
  const day = plan.weeks[weekIdx][dayIdx];
  const [copyOpen, setCopyOpen] = useState(false);

  function setDay(fn: (d: PDay) => PDay) {
    const weeks = plan.weeks.map((wk, wi) => (wi === weekIdx ? wk.map((d, di) => (di === dayIdx ? fn(d) : d)) : wk));
    onChange({ ...plan, weeks });
  }
  const setBlocks = (fn: (b: PBlock[]) => PBlock[]) => setDay((d) => ({ ...d, blocks: fn(d.blocks) }));
  const patchBlock = (id: string, patch: Partial<PBlock>) => setBlocks((bs) => bs.map((b) => (b.id === id ? ({ ...b, ...patch } as PBlock) : b)));

  function copyTo(targetWeek: number, targetDay: number) {
    const target = plan.weeks[targetWeek][targetDay];
    if (dayHasContent(target) && !window.confirm("Ese día ya tiene contenido. ¿Sustituirlo?")) return;
    const weeks = plan.weeks.map((wk, wi) => wk.map((d, di) => (wi === targetWeek && di === targetDay ? { ...d, rest: false, blocks: cloneBlocks(day.blocks) } : d)));
    onChange({ ...plan, weeks });
    setCopyOpen(false);
    toast.success(`Copiado al ${longDate(plan.weeks[targetWeek][targetDay].date)}`);
  }

  const rmNames = useMemo(
    () => Array.from(new Set(records.filter((r) => (r.rep_max ?? 1) === 1).map((r) => r.exercise))).slice(0, 8),
    [records],
  );
  const preview = day.blocks
    .map((b, i) => ({ letter: blockLetter(i), text: blockContent(b) }))
    .filter((b) => b.text.trim());

  return (
    <div className="page-enter space-y-3">
      <datalist id="pb-movements">
        {movements.map((m) => <option key={m.id} value={m.name} />)}
      </datalist>

      <div className="flex items-center justify-between">
        <button type="button" onClick={onBack} className="flex min-h-11 items-center gap-1 pr-2 text-[15px] text-muted-foreground">
          <ChevronLeft className="h-[18px] w-[18px]" /> Semana {weekIdx + 1}
        </button>
        <button type="button" onClick={() => setCopyOpen((v) => !v)} disabled={!dayHasContent(day)} className="flex min-h-11 items-center gap-1.5 rounded-[14px] bg-white/[0.06] px-3.5 text-sm font-bold disabled:opacity-40">
          <Copy className="h-4 w-4" /> Copiar día a…
        </button>
      </div>

      {copyOpen && (
        <div className="surface-sheet p-3">
          <p className="mb-2 text-sm font-bold">¿A qué día lo copias?</p>
          <div className="max-h-72 space-y-2 overflow-y-auto">
            {plan.weeks.map((wk, wi) => (
              <div key={wi}>
                <p className="mb-1 text-xs text-muted-foreground">Semana {wi + 1}</p>
                <div className="grid grid-cols-7 gap-1">
                  {wk.map((d, di) => {
                    const self = wi === weekIdx && di === dayIdx;
                    return (
                      <button key={di} type="button" disabled={self} onClick={() => copyTo(wi, di)}
                        className={`h-11 rounded-[10px] text-xs font-bold disabled:opacity-30 ${dayHasContent(d) ? "bg-white/[0.1]" : d.rest ? "bg-transparent text-muted-foreground" : "border border-dashed border-[color:var(--gold)]/50"}`}>
                        {DAY_SHORT[di].slice(0, 1)}{parseISODate(d.date)?.getDate()}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="eyebrow">{shortDate(day.date)} · Semana {weekIdx + 1}</p>
        <h1 className="mt-1 text-[64px] font-black uppercase leading-[0.85] text-[color:var(--gold-soft)]" style={font}>
          {(parseISODate(day.date) ?? new Date()).toLocaleDateString("es-ES", { weekday: "long" })}
        </h1>
      </div>

      {day.blocks.map((b, bi) => (
        <section key={b.id} className={`space-y-3 rounded-[22px] border bg-white/[0.05] p-4 ${bi === 0 ? "border-[color:var(--gold)]/35" : "border-white/10"}`}>
          <div className="flex items-center gap-2.5">
            <span className="gold-gradient grid h-9 w-9 place-items-center rounded-[12px] text-xl font-black" style={font}>{blockLetter(bi)}</span>
            <span className="flex-1 text-base font-extrabold">{b.kind === "fuerza" ? "Fuerza" : b.kind === "wod" ? "WOD" : "Texto libre"}</span>
            <button type="button" aria-label="Subir bloque" disabled={bi === 0} onClick={() => setBlocks((bs) => swap(bs, bi, bi - 1))} className="grid h-10 w-10 place-items-center rounded-full text-muted-foreground disabled:opacity-25"><ChevronLeft className="h-4 w-4 rotate-90" /></button>
            <button type="button" aria-label="Bajar bloque" disabled={bi === day.blocks.length - 1} onClick={() => setBlocks((bs) => swap(bs, bi, bi + 1))} className="grid h-10 w-10 place-items-center rounded-full text-muted-foreground disabled:opacity-25"><ChevronLeft className="h-4 w-4 -rotate-90" /></button>
            <button type="button" aria-label="Quitar bloque" onClick={() => { if (!blockContent(b).trim() || window.confirm(`¿Quitar el bloque ${blockLetter(bi)}?`)) setBlocks((bs) => bs.filter((x) => x.id !== b.id)); }} className="grid h-10 w-10 place-items-center rounded-full text-muted-foreground"><Trash2 className="h-4 w-4" /></button>
          </div>

          {b.kind === "fuerza" && (
            <>
              {b.exercises.map((e, ei) => (
                <ExerciseEditor
                  key={e.id}
                  ex={e}
                  index={ei}
                  canRemove={b.exercises.length > 1}
                  rmNames={rmNames}
                  rmWeight={e.name.trim() ? detectExercise(e.name, records)?.weight ?? null : null}
                  onChange={(patch) => patchBlock(b.id, { exercises: b.exercises.map((x) => (x.id === e.id ? { ...x, ...patch } : x)) })}
                  onRemove={() => patchBlock(b.id, { exercises: b.exercises.filter((x) => x.id !== e.id) })}
                />
              ))}
              <button type="button" onClick={() => patchBlock(b.id, { exercises: [...b.exercises, emptyExercise()] })} className="flex min-h-11 items-center text-sm font-bold text-gold">
                + Otro ejercicio en este bloque
              </button>
            </>
          )}

          {b.kind === "wod" && (
            <>
              <div role="group" aria-label="Formato" className="grid grid-cols-4 gap-1.5">
                {FORMATS.map((f) => (
                  <button key={f.id} type="button" aria-pressed={b.format === f.id} onClick={() => patchBlock(b.id, { format: f.id })}
                    className={`h-11 rounded-[12px] text-[13px] font-bold ${b.format === f.id ? "bg-[color:var(--gold)] text-[color:var(--gold-foreground)]" : "bg-white/[0.06]"}`}>
                    {f.label}
                  </button>
                ))}
              </div>
              {b.format !== "TABATA" && (
                <div className="flex items-center gap-3">
                  <span className="w-24 text-[13px] text-muted-foreground">{b.format === "FOR TIME" ? "Time cap (min)" : "Minutos"}</span>
                  <Stepper value={b.minutes} onChange={(v) => patchBlock(b.id, { minutes: v })} min={0} label="Minutos" />
                </div>
              )}
              <label className="block">
                <span className="mb-1.5 block text-[13px] text-muted-foreground">Movimientos (uno por línea)</span>
                <textarea
                  rows={4}
                  value={b.text}
                  onChange={(e) => patchBlock(b.id, { text: e.target.value })}
                  placeholder={"10 Wall Ball 9/6\n10 Box Jump Over\n10 Toes to Bar"}
                  className="w-full rounded-[14px] border border-white/[0.14] bg-white/[0.06] px-3.5 py-3 text-base leading-relaxed outline-none focus:border-[color:var(--gold)]/60"
                />
              </label>
            </>
          )}

          {b.kind === "texto" && (
            <>
              <input
                value={b.title}
                onChange={(e) => patchBlock(b.id, { title: e.target.value })}
                placeholder="Título (Calentamiento, Movilidad, Accesorios…)"
                className="min-h-12 w-full rounded-[14px] border border-white/[0.14] bg-white/[0.06] px-3.5 text-base outline-none focus:border-[color:var(--gold)]/60"
              />
              <textarea
                rows={4}
                value={b.text}
                onChange={(e) => patchBlock(b.id, { text: e.target.value })}
                placeholder={"3 rondas:\n10 Banded Lat Walk\n10 Air Squat"}
                className="w-full rounded-[14px] border border-white/[0.14] bg-white/[0.06] px-3.5 py-3 text-base leading-relaxed outline-none focus:border-[color:var(--gold)]/60"
              />
            </>
          )}
        </section>
      ))}

      <div>
        <p className="mb-2 text-[13px] text-muted-foreground">{day.blocks.length ? "Añadir bloque" : "Empieza añadiendo un bloque"}</p>
        <div className="grid grid-cols-3 gap-1.5">
          {([["fuerza", "+ Fuerza"], ["wod", "+ WOD"], ["texto", "+ Texto libre"]] as const).map(([k, label]) => (
            <button key={k} type="button" onClick={() => setBlocks((bs) => [...bs, newBlock(k)])}
              className="pressable h-[52px] rounded-[14px] border-[1.5px] border-dashed border-[color:var(--gold)]/50 text-sm font-bold text-gold">
              {label}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">Texto libre sirve para calentamiento, movilidad, accesorios…</p>
      </div>

      {preview.length > 0 && (
        <section className="rounded-[18px] bg-black/30 px-4 py-3.5">
          <p className="text-xs font-bold tracking-[0.14em] text-muted-foreground">ASÍ LO VERÁS EN EL ENTRENO</p>
          <div className="mt-2 space-y-2 text-sm leading-relaxed text-foreground/85">
            {preview.map((p) => (
              <p key={p.letter} className="whitespace-pre-wrap"><b className="text-[color:var(--gold-soft)]">{p.letter}</b> · {p.text}</p>
            ))}
          </div>
        </section>
      )}

      <button type="button" onClick={onNext} className="pressable gold-gradient cta-display min-h-14 w-full rounded-[16px]">
        Listo · siguiente día ›
      </button>
      <button type="button" onClick={() => { setDay((d) => ({ ...d, rest: true })); onBack(); }} className="min-h-11 w-full text-sm text-muted-foreground">
        Marcar este día como descanso
      </button>
    </div>
  );
}

function swap<T>(arr: T[], a: number, b: number): T[] {
  if (b < 0 || b >= arr.length) return arr;
  const c = arr.slice();
  [c[a], c[b]] = [c[b], c[a]];
  return c;
}

function ExerciseEditor({ ex, index, canRemove, rmNames, rmWeight, onChange, onRemove }: {
  ex: PExercise; index: number; canRemove: boolean; rmNames: string[]; rmWeight: number | null;
  onChange: (p: Partial<PExercise>) => void; onRemove: () => void;
}) {
  const pct = Number(ex.pct.replace(",", "."));
  const kg = rmWeight && pct > 0 ? loadsForPercentages(rmWeight, [pct])[0]?.suggested : null;
  const custom = ex.pct.trim() !== "" && !PCTS.includes(ex.pct.trim());
  const [otherOpen, setOtherOpen] = useState(custom);

  return (
    <div className={`space-y-3 ${index > 0 ? "border-t border-white/[0.08] pt-3" : ""}`}>
      <label className="block">
        <span className="mb-1.5 flex items-center justify-between text-[13px] text-muted-foreground">
          Ejercicio{index > 0 ? ` ${index + 1}` : ""}
          {canRemove && <button type="button" onClick={onRemove} className="min-h-8 px-1 text-[13px] text-muted-foreground">Quitar</button>}
        </span>
        <input
          list="pb-movements"
          value={ex.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="Back Squat"
          className="min-h-[52px] w-full rounded-[14px] border border-[color:var(--gold)]/50 bg-white/[0.06] px-3.5 text-base outline-none"
        />
      </label>
      {!ex.name.trim() && rmNames.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Tus RM:</span>
          {rmNames.map((n) => (
            <button key={n} type="button" onClick={() => onChange({ name: n })} className="min-h-9 rounded-full bg-white/[0.06] px-3 text-[13px]">{n}</button>
          ))}
        </div>
      )}
      <div className="grid grid-cols-2 gap-2.5">
        <div>
          <span className="mb-1.5 block text-[13px] text-muted-foreground">Series</span>
          <Stepper value={ex.sets} onChange={(v) => onChange({ sets: v })} min={0} label="Series" />
        </div>
        <div>
          <span className="mb-1.5 block text-[13px] text-muted-foreground">Reps</span>
          <Stepper value={ex.reps} onChange={(v) => onChange({ reps: v })} min={0} label="Reps" />
        </div>
      </div>
      <div>
        <span className="mb-1.5 block text-[13px] text-muted-foreground">% de tu RM (opcional)</span>
        <div role="group" aria-label="Porcentaje del RM" className="grid grid-cols-6 gap-1.5">
          {PCTS.map((p) => (
            <button key={p} type="button" aria-pressed={ex.pct === p} onClick={() => { setOtherOpen(false); onChange({ pct: ex.pct === p ? "" : p }); }}
              className={`h-11 rounded-[12px] text-sm font-bold ${ex.pct === p ? "bg-[color:var(--gold)] text-[color:var(--gold-foreground)]" : "bg-white/[0.06]"}`}>
              {p}
            </button>
          ))}
          <button type="button" aria-pressed={otherOpen} onClick={() => setOtherOpen((v) => !v)}
            className={`h-11 rounded-[12px] text-sm font-bold ${custom ? "bg-[color:var(--gold)] text-[color:var(--gold-foreground)]" : "bg-white/[0.06]"}`}>
            {custom ? ex.pct : "Otro"}
          </button>
        </div>
        {otherOpen && (
          <input
            inputMode="decimal"
            autoFocus={!custom}
            value={custom ? ex.pct : ""}
            onChange={(e) => onChange({ pct: e.target.value.replace(/[^0-9.,]/g, "") })}
            placeholder="Escribe el %: 72,5"
            className="mt-2 min-h-12 w-full rounded-[14px] border border-white/[0.14] bg-white/[0.06] px-3.5 text-base outline-none focus:border-[color:var(--gold)]/60"
          />
        )}
        {pct > 0 && (
          <p className="mt-2 text-[13px] text-foreground/85">
            {rmWeight ? <>Tu 1RM {formatKg(rmWeight)} kg → <b className="text-[color:var(--gold-soft)]">{formatKg(kg ?? 0)} kg</b></> : "Aún no tienes RM de este ejercicio: el % se mostrará cuando lo añadas."}
          </p>
        )}
      </div>
    </div>
  );
}

function Stepper({ value, onChange, min = 0, label }: { value: string; onChange: (v: string) => void; min?: number; label: string }) {
  const n = Number(value.replace(",", ".")) || 0;
  return (
    <div className="flex h-[52px] flex-1 items-center rounded-[14px] border border-white/[0.14] bg-white/[0.06]">
      <button type="button" aria-label={`${label}: uno menos`} onClick={() => onChange(String(Math.max(min, n - 1)))} className="grid h-[52px] w-12 shrink-0 place-items-center"><Minus className="h-5 w-5" /></button>
      <input
        inputMode="numeric"
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, ""))}
        className="w-full min-w-0 bg-transparent text-center text-[28px] font-extrabold outline-none"
        style={font}
      />
      <button type="button" aria-label={`${label}: uno más`} onClick={() => onChange(String(n + 1))} className="grid h-[52px] w-12 shrink-0 place-items-center"><Plus className="h-5 w-5" /></button>
    </div>
  );
}
