import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import type { Planning } from "@/lib/excel-parser";
import { addDays, buildPlanDateIndex, isoKey, parseISODate } from "@/lib/plan-dates";
import { LinkedText } from "@/components/LinkedText";

/**
 * Editar un plan ya subido (Excel, PDF, foto…) sin romper nada: cada día se
 * edita bloque a bloque y se conservan el mes, la semana, el día y la clave
 * de cada bloque, que es a lo que van ligados tus registros de entreno.
 */

const DRAFT_KEY = "rmordie_raw_plan_draft";
const font = { fontFamily: "var(--font-editorial)" } as const;
const SHORT = ["DOM", "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB"];

type Ref = { monthKey: string; week: number; dayKey: string };
type Slot = Ref & { date: string };

function readDraft(planningId: string): Planning | null {
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { id: string; data: Planning };
    return parsed.id === planningId ? parsed.data : null;
  } catch {
    return null;
  }
}
function writeDraft(planningId: string, data: Planning | null) {
  try {
    if (data) window.localStorage.setItem(DRAFT_KEY, JSON.stringify({ id: planningId, data }));
    else window.localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* sin almacenamiento */
  }
}

function findDay(p: Planning, r: Ref) {
  const m = p.months.find((x) => x.key === r.monthKey);
  const w = m?.weeks.find((x) => x.index === r.week);
  return w?.days.find((x) => x.key === r.dayKey) ?? null;
}

const nextKey = (used: string[]) => {
  for (let i = 0; i < 26; i++) {
    const k = String.fromCharCode(65 + i);
    if (!used.includes(k)) return k;
  }
  return `BLOQUE ${used.length + 1}`;
};

export function RawPlanEditor({
  planningId,
  data,
  name,
  saving,
  focus,
  onSave,
  onExit,
  onCreateNew,
}: {
  planningId: string;
  data: Planning;
  name: string;
  saving: boolean;
  focus?: Ref | null;
  onSave: (planning: Planning) => Promise<boolean>;
  onExit: () => void;
  onCreateNew: () => void;
}) {
  const [draft, setDraft] = useState<Planning>(() => readDraft(planningId) ?? structuredClone(data));
  const [dirty, setDirty] = useState(() => !!readDraft(planningId));
  const [open, setOpen] = useState<Slot | null>(null);

  // Semanas reales (lunes a domingo) a partir de las fechas del plan
  const weeks = useMemo(() => {
    const index = buildPlanDateIndex(draft.months);
    const byMonday = new Map<string, (Slot | null)[]>();
    for (const [iso, pd] of index) {
      const date = parseISODate(iso)!;
      const monday = isoKey(addDays(date, -((date.getDay() + 6) % 7)));
      const row = byMonday.get(monday) ?? Array<Slot | null>(7).fill(null);
      row[(date.getDay() + 6) % 7] = { monthKey: pd.month.key, week: pd.week, dayKey: pd.day.key, date: iso };
      byMonday.set(monday, row);
    }
    return [...byMonday.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([monday, days]) => ({ monday, days }));
  }, [draft]);

  const todayMonday = isoKey(addDays(new Date(), -((new Date().getDay() + 6) % 7)));
  const [weekIdx, setWeekIdx] = useState(() => {
    const i = weeks.findIndex((w) => w.monday === todayMonday);
    return i >= 0 ? i : 0;
  });

  // Abrir directamente un día (desde «Editar este día» del entreno)
  useEffect(() => {
    if (!focus) return;
    for (let wi = 0; wi < weeks.length; wi++) {
      const slot = weeks[wi].days.find((s) => s && s.monthKey === focus.monthKey && s.week === focus.week && s.dayKey === focus.dayKey);
      if (slot) {
        setWeekIdx(wi);
        setOpen(slot);
        return;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.monthKey, focus?.week, focus?.dayKey]);

  function change(fn: (p: Planning) => void) {
    const next = structuredClone(draft);
    fn(next);
    setDraft(next);
    setDirty(true);
    writeDraft(planningId, next);
  }

  async function save() {
    const ok = await onSave({ ...draft, importedAt: new Date().toISOString() });
    if (ok) {
      writeDraft(planningId, null);
      setDirty(false);
    }
  }

  function exit() {
    if (dirty && !window.confirm("Tienes cambios sin guardar. Se quedan como borrador en este móvil. ¿Salir?")) return;
    onExit();
  }

  if (open) {
    const day = findDay(draft, open);
    if (!day) return null;
    return (
      <RawDayEditor
        key={`${open.monthKey}|${open.week}|${open.dayKey}`}
        date={open.date}
        blocks={day.blocks}
        onBack={() => setOpen(null)}
        onChange={(blocks) =>
          change((p) => {
            const d = findDay(p, open)!;
            d.blocks = blocks;
            d.isRest = blocks.every((b) => !b.content.trim());
          })
        }
      />
    );
  }

  const w = weeks[Math.min(weekIdx, weeks.length - 1)];
  const fmt = (iso: string) => (parseISODate(iso) ?? new Date()).toLocaleDateString("es-ES", { day: "numeric", month: "short" }).replace(".", "");

  return (
    <div className="page-enter">
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={exit} className="flex min-h-11 items-center gap-1 pr-2 text-[15px] text-muted-foreground">
          <ChevronLeft className="h-[18px] w-[18px]" /> Salir
        </button>
        <button type="button" onClick={save} disabled={saving || !dirty} className="pressable gold-gradient min-h-11 rounded-[14px] px-4 text-[15px] font-extrabold disabled:opacity-40">
          {saving ? "Guardando…" : dirty ? "Guardar cambios" : "Sin cambios"}
        </button>
      </div>

      <p className="eyebrow mt-3 truncate">Editar plan · {name}</p>
      <h1 className="page-title mt-1">{w ? `${fmt(w.monday)} – ${fmt(isoKey(addDays(parseISODate(w.monday)!, 6)))}` : "Sin fechas"}</h1>
      <p className="mt-1 text-[13px] text-muted-foreground">Tus pesos y resultados ya registrados se mantienen.</p>

      {weeks.length > 0 && (
        <div className="mt-3 flex items-center justify-between gap-2">
          <button type="button" aria-label="Semana anterior" disabled={weekIdx === 0} onClick={() => setWeekIdx((i) => Math.max(0, i - 1))} className="grid h-11 w-11 place-items-center rounded-full bg-white/[0.06] disabled:opacity-30">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <span className="text-sm text-muted-foreground">Semana {weekIdx + 1} de {weeks.length}</span>
          <button type="button" aria-label="Semana siguiente" disabled={weekIdx >= weeks.length - 1} onClick={() => setWeekIdx((i) => Math.min(weeks.length - 1, i + 1))} className="grid h-11 w-11 place-items-center rounded-full bg-white/[0.06] disabled:opacity-30">
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      )}
      {weeks.length > 0 && w && w.monday !== todayMonday && weeks.some((x) => x.monday === todayMonday) && (
        <button type="button" onClick={() => setWeekIdx(weeks.findIndex((x) => x.monday === todayMonday))} className="mt-2 w-full text-center text-sm font-bold text-gold">
          Ir a esta semana
        </button>
      )}

      <div className="mt-3 space-y-2">
        {w?.days.map((slot, i) => {
          if (!slot) return null;
          const day = findDay(draft, slot);
          if (!day) return null;
          const date = parseISODate(slot.date)!;
          const filled = day.blocks.filter((b) => b.content.trim());
          return (
            <button key={slot.date} type="button" onClick={() => setOpen(slot)}
              className={`flex min-h-[72px] w-full items-center gap-3.5 rounded-[18px] px-3.5 text-left ${filled.length ? "bg-white/[0.045]" : "border-[1.5px] border-dashed border-white/15"}`}>
              <span className="w-11 shrink-0 text-center">
                <span className="block text-[28px] font-extrabold leading-none" style={font}>{date.getDate()}</span>
                <span className="text-xs text-muted-foreground">{SHORT[date.getDay()]}</span>
              </span>
              <span className="min-w-0 flex-1">
                {filled.length ? (
                  <>
                    <span className="block truncate text-[15px] font-bold">{filled.map((b) => b.key).join(" · ")}</span>
                    <span className="block truncate text-[13px] text-muted-foreground">{firstUseful(filled)}</span>
                  </>
                ) : (
                  <span className="text-[15px] text-muted-foreground">Descanso · toca para añadir</span>
                )}
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          );
        })}
        {weeks.length === 0 && <p className="text-sm text-muted-foreground">Este plan no tiene fechas que se puedan colocar en el calendario.</p>}
      </div>

      <button type="button" onClick={onCreateNew} className="mt-6 min-h-12 w-full rounded-[16px] bg-white/[0.06] text-[15px] font-bold">
        + Crear un plan nuevo desde cero
      </button>
    </div>
  );
}

function firstUseful(blocks: { key: string; content: string }[]) {
  const main = blocks.find((b) => /^[A-D]$/.test(b.key)) ?? blocks[0];
  return main ? `${main.key}: ${main.content.split("\n").map((l) => l.trim()).find(Boolean) ?? ""}` : "";
}

function RawDayEditor({ date, blocks, onBack, onChange }: {
  date: string;
  blocks: { key: string; content: string }[];
  onBack: () => void;
  onChange: (b: { key: string; content: string }[]) => void;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const d = parseISODate(date) ?? new Date();
  const used = blocks.map((b) => b.key);
  const [newKey, setNewKey] = useState(() => nextKey(used));

  function set(i: number, content: string) {
    onChange(blocks.map((b, j) => (j === i ? { ...b, content } : b)));
  }
  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= blocks.length) return;
    const c = blocks.slice();
    [c[i], c[j]] = [c[j], c[i]];
    onChange(c);
  }
  function add() {
    const key = newKey.trim().toUpperCase();
    if (!key) return;
    if (used.includes(key)) return toast.error(`Ya hay un bloque «${key}» ese día.`);
    onChange([...blocks, { key, content: "" }]);
    setNewKey(nextKey([...used, key]));
  }

  return (
    <div className="page-enter space-y-3">
      <button type="button" onClick={onBack} className="flex min-h-11 items-center gap-1 pr-2 text-[15px] text-muted-foreground">
        <ChevronLeft className="h-[18px] w-[18px]" /> Semana
      </button>
      <div>
        <p className="eyebrow">{d.toLocaleDateString("es-ES", { day: "numeric", month: "long" })}</p>
        <h1 className="mt-1 text-[60px] font-black uppercase leading-[0.85] text-[color:var(--gold-soft)]" style={font}>
          {d.toLocaleDateString("es-ES", { weekday: "long" })}
        </h1>
      </div>

      {blocks.length === 0 && <p className="text-sm text-muted-foreground">Día de descanso. Añade un bloque para convertirlo en día de entreno.</p>}

      {blocks.map((b, i) => (
        <section key={b.key} className="space-y-2.5 rounded-[20px] border border-white/10 bg-white/[0.05] p-3.5">
          <div className="flex items-center gap-2">
            <span className="min-w-9 rounded-[10px] bg-[color:var(--gold)] px-2 py-1 text-center text-base font-black text-[color:var(--gold-foreground)]" style={font}>{b.key}</span>
            <span className="flex-1" />
            <button type="button" onClick={() => setPreview(preview === b.key ? null : b.key)} className="min-h-10 px-2 text-[13px] font-bold text-gold">
              {preview === b.key ? "Editar" : "Ver"}
            </button>
            <button type="button" aria-label="Subir bloque" disabled={i === 0} onClick={() => move(i, -1)} className="grid h-10 w-10 place-items-center rounded-full text-muted-foreground disabled:opacity-25"><ChevronLeft className="h-4 w-4 rotate-90" /></button>
            <button type="button" aria-label="Bajar bloque" disabled={i === blocks.length - 1} onClick={() => move(i, 1)} className="grid h-10 w-10 place-items-center rounded-full text-muted-foreground disabled:opacity-25"><ChevronLeft className="h-4 w-4 -rotate-90" /></button>
            <button type="button" aria-label={`Quitar bloque ${b.key}`} onClick={() => { if (!b.content.trim() || window.confirm(`¿Quitar el bloque ${b.key}? Si ya lo registraste, ese registro deja de verse en este día.`)) onChange(blocks.filter((_, j) => j !== i)); }} className="grid h-10 w-10 place-items-center rounded-full text-muted-foreground"><Trash2 className="h-4 w-4" /></button>
          </div>
          {preview === b.key ? (
            <LinkedText text={b.content} className="text-[15px] leading-relaxed text-foreground/85" />
          ) : (
            <textarea
              value={b.content}
              onChange={(e) => set(i, e.target.value)}
              rows={Math.min(14, Math.max(3, b.content.split("\n").length + 1))}
              className="w-full rounded-[14px] border border-white/[0.14] bg-white/[0.06] px-3.5 py-3 text-base leading-relaxed outline-none focus:border-[color:var(--gold)]/60"
            />
          )}
        </section>
      ))}

      <div className="flex items-end gap-2">
        <label className="w-28">
          <span className="mb-1.5 block text-[13px] text-muted-foreground">Nuevo bloque</span>
          <input value={newKey} onChange={(e) => setNewKey(e.target.value.slice(0, 20))} aria-label="Nombre del bloque nuevo"
            className="min-h-12 w-full rounded-[14px] border border-white/[0.14] bg-white/[0.06] px-3 text-base font-bold uppercase outline-none focus:border-[color:var(--gold)]/60" />
        </label>
        <button type="button" onClick={add} className="pressable flex min-h-12 flex-1 items-center justify-center gap-1.5 rounded-[14px] border-[1.5px] border-dashed border-[color:var(--gold)]/50 text-sm font-bold text-gold">
          <Plus className="h-4 w-4" /> Añadir bloque
        </button>
      </div>
      <p className="text-xs text-muted-foreground">Escribe como en tu Excel: «5x5 Back Squat (75%)», «AMRAP 12'», «@80%»… La app lo entiende igual.</p>

      <button type="button" onClick={onBack} className="pressable gold-gradient cta-display min-h-14 w-full rounded-[16px]">
        Listo
      </button>
    </div>
  );
}
