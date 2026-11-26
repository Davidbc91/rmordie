import { useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Bookmark, Check, ChevronRight, Plus, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import {
  applyProgression, blockContent, blockLetter, dayHasContent, generateSteps, pid, strengthExercises,
  type PBlock, type PlanState, type PlanStateWithProg, type Progression, type ProgScheme, type ProgStep,
} from "@/lib/plan-builder";
import { BUILTIN, instantiate, useAthleteRms, useDeleteFromLibrary, useMyLibrary, useSaveToLibrary, type LibCategory } from "@/lib/block-library";
import { parseISODate } from "@/lib/plan-dates";
import { getCurrentUserId } from "@/lib/pin-gate";
import { useMyPlanningShares, useProfiles, useSetPlanningShares } from "@/lib/store";
import { useCoachAthletes } from "@/lib/coach";
import { detectExercise, formatKg, loadsForPercentages } from "@/lib/rm-matcher";
import { extractPercentages } from "@/lib/plates";

const LIME_BG = { background: "#333B18", color: "var(--gold)" };
const OFF_BG = { background: "rgba(255,255,255,.07)", color: "var(--muted-foreground)" };

function Sheet({ children, onClose, label, tall }: { children: ReactNode; onClose: () => void; label: string; tall?: boolean }) {
  return createPortal(
    <div className="fixed inset-0 z-[72] flex items-end" role="dialog" aria-label={label}>
      <button aria-label="Cerrar" onClick={onClose} className="absolute inset-0 bg-black/60 backdrop-blur-[4px]" />
      <div className={`animate-fade relative mx-auto flex w-full max-w-2xl flex-col rounded-t-[28px] border-t border-white/10 bg-[#141416] px-4 pt-3 ${tall ? "h-[86dvh]" : "max-h-[90dvh]"}`} style={{ paddingBottom: "max(env(safe-area-inset-bottom), 16px)" }}>
        <div aria-hidden className="mx-auto mb-2 h-[5px] w-10 shrink-0 rounded-full bg-white/20" />
        {children}
      </div>
    </div>,
    document.body,
  );
}

/* ---------------- Mapa de todo el plan ---------------- */

export function PlanMap({ plan, weekIdx, onOpen }: { plan: PlanState; weekIdx: number; onOpen: (w: number, d: number) => void }) {
  return (
    <section className="mt-3 rounded-[20px] bg-card p-3">
      <div className="grid grid-cols-[30px_repeat(7,1fr)] gap-1 text-[11px]">
        <span />
        {"LMXJVSD".split("").map((l) => <span key={l} className="text-center font-bold text-muted-foreground">{l}</span>)}
        {plan.weeks.map((wk, wi) => (
          <Row key={wi} wk={wk} wi={wi} active={wi === weekIdx} onOpen={onOpen} />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-[11.5px] text-muted-foreground">
        <span className="flex items-center gap-1"><i className="block h-1 w-2.5 rounded-sm" style={{ background: "var(--gold)" }} />Fuerza</span>
        <span className="flex items-center gap-1"><i className="block h-1 w-2.5 rounded-sm" style={{ background: "#3BB8F5" }} />WOD</span>
        <span className="flex items-center gap-1"><i className="block h-1 w-2.5 rounded-sm bg-white/40" />Texto</span>
        <span className="ml-auto">Toca un día para editarlo</span>
      </div>
    </section>
  );
}

function Row({ wk, wi, active, onOpen }: { wk: PlanState["weeks"][number]; wi: number; active: boolean; onOpen: (w: number, d: number) => void }) {
  return (
    <>
      <span className={`flex items-center font-extrabold ${active ? "text-gold" : "text-muted-foreground"}`}>S{wi + 1}</span>
      {wk.map((d, di) => {
        const filled = dayHasContent(d);
        return (
          <button
            key={di}
            type="button"
            onClick={() => onOpen(wi, di)}
            aria-label={`Semana ${wi + 1}, ${parseISODate(d.date)?.toLocaleDateString("es-ES", { weekday: "long", day: "numeric" })}`}
            className="flex h-9 flex-col items-center justify-center gap-[3px] rounded-[8px]"
            style={d.rest ? { border: "1px dashed rgba(255,255,255,.1)" } : filled ? { background: "rgba(255,255,255,.06)" } : { border: "1px dashed rgba(198,255,0,.4)" }}
          >
            {!d.rest && d.blocks.filter((b) => blockContent(b).trim()).slice(0, 3).map((b) => (
              <i key={b.id} className="block h-1 w-[70%] rounded-sm" style={{ background: b.kind === "fuerza" ? "var(--gold)" : b.kind === "wod" ? "#3BB8F5" : "rgba(255,255,255,.4)" }} />
            ))}
          </button>
        );
      })}
    </>
  );
}

/* ---------------- Progresiones ---------------- */

const SCHEMES: { key: ProgScheme; label: string; hint: string }[] = [
  { key: "lineal", label: "Lineal", hint: "+2,5 % cada semana" },
  { key: "descarga", label: "Con descarga", hint: "Sube 3 semanas, baja la 4ª" },
  { key: "ondulante", label: "Ondulante", hint: "Alterna pesado y ligero" },
  { key: "manual", label: "A mano", hint: "Tú pones cada semana" },
];

export function ProgressionsSection({ plan, onChange }: { plan: PlanStateWithProg; onChange: (p: PlanStateWithProg) => void }) {
  const [editing, setEditing] = useState<Progression | null>(null);
  const exercises = useMemo(() => strengthExercises(plan), [plan]);
  const progs = plan.progressions ?? [];
  return (
    <section className="mt-4 rounded-[20px] bg-card p-4">
      <div className="flex items-baseline justify-between">
        <p className="text-[15px] font-extrabold">Progresiones</p>
        <span className="text-[12.5px] text-muted-foreground">{progs.length ? `${progs.length} ${progs.length === 1 ? "ejercicio" : "ejercicios"}` : "Sube cargas semana a semana"}</span>
      </div>
      <div className="mt-2 flex flex-col gap-1.5">
        {progs.map((p) => (
          <button key={p.id} type="button" onClick={() => setEditing(p)} className="flex min-h-12 items-center gap-2 rounded-[14px] bg-white/[0.04] px-3 text-left">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14.5px] font-bold">{p.exercise}</span>
              <span className="block truncate text-[12.5px] text-muted-foreground">{p.steps.map((s) => `${s.pct}%`).join(" → ")}</span>
            </span>
            <span className="shrink-0 rounded-full px-2 py-0.5 text-[11.5px] font-bold" style={LIME_BG}>{SCHEMES.find((s) => s.key === p.scheme)?.label}</span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>
        ))}
        {exercises.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">Añade un ejercicio de fuerza a algún día y aquí podrás programar cómo sube semana a semana.</p>
        ) : (
          <button type="button" onClick={() => {
            const free = exercises.find((e) => !progs.some((p) => p.exercise.toLowerCase() === e.name.toLowerCase())) ?? exercises[0];
            const base: ProgStep = { pct: free.first.pct || "70", sets: free.first.sets || "5", reps: free.first.reps || "5" };
            setEditing({ id: pid(), exercise: free.name, scheme: "lineal", steps: generateSteps("lineal", plan.weeks.length, base) });
          }} className="flex min-h-11 items-center gap-1.5 text-[14px] font-bold text-gold"><Plus className="h-4 w-4" />Añadir progresión</button>
        )}
      </div>
      {editing && (
        <ProgressionSheet
          plan={plan}
          prog={editing}
          exercises={exercises.map((e) => e.name)}
          onClose={() => setEditing(null)}
          onSave={(p) => {
            const list = [...progs.filter((x) => x.id !== p.id && x.exercise.toLowerCase() !== p.exercise.toLowerCase()), p];
            onChange({ ...applyProgression(plan, p), progressions: list });
            setEditing(null);
            toast.success(`Progresión de ${p.exercise} aplicada a las ${plan.weeks.length} semanas`);
          }}
          onRemove={() => { onChange({ ...plan, progressions: progs.filter((x) => x.id !== editing.id) }); setEditing(null); }}
        />
      )}
    </section>
  );
}

function ProgressionSheet({ plan, prog, exercises, onClose, onSave, onRemove }: {
  plan: PlanState; prog: Progression; exercises: string[]; onClose: () => void; onSave: (p: Progression) => void; onRemove: () => void;
}) {
  const [p, setP] = useState<Progression>(prog);
  const regen = (scheme: ProgScheme, exercise = p.exercise) => {
    if (scheme === "manual") return setP({ ...p, scheme, exercise });
    setP({ ...p, exercise, scheme, steps: generateSteps(scheme, plan.weeks.length, p.steps[0] ?? { pct: "70", sets: "5", reps: "5" }) });
  };
  const setStep = (i: number, patch: Partial<ProgStep>) => setP({ ...p, scheme: "manual", steps: p.steps.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  const first = p.steps[0] ?? { pct: "70", sets: "5", reps: "5" };
  return (
    <Sheet onClose={onClose} label="Progresión" tall>
      <div className="flex items-center justify-between">
        <h2 className="text-[19px] font-extrabold">Progresión</h2>
        <button type="button" onClick={onClose} aria-label="Cerrar" className="grid h-10 w-10 place-items-center rounded-full bg-white/[0.07]"><X className="h-[18px] w-[18px]" /></button>
      </div>
      <div className="mt-2 flex-1 space-y-4 overflow-y-auto pb-2">
        <div>
          <p className="mb-2 text-[13px] font-bold text-muted-foreground">Ejercicio</p>
          <div className="flex flex-wrap gap-1.5">
            {exercises.map((e) => (
              <button key={e} type="button" onClick={() => regen(p.scheme, e)} className="min-h-9 rounded-full px-3 text-[13px] font-bold" style={p.exercise === e ? LIME_BG : OFF_BG}>{e}</button>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-[13px] font-bold text-muted-foreground">Semana 1</p>
          <div className="grid grid-cols-3 gap-2">
            {([["pct", "% del RM"], ["sets", "Series"], ["reps", "Reps"]] as const).map(([k, l]) => (
              <label key={k} className="flex flex-col gap-1 text-[12px] text-muted-foreground">{l}
                <input inputMode="decimal" value={first[k]} onChange={(e) => {
                  const steps = [{ ...first, [k]: e.target.value }, ...p.steps.slice(1)];
                  const next = { ...p, steps };
                  setP(p.scheme === "manual" ? next : { ...next, steps: generateSteps(p.scheme, plan.weeks.length, steps[0]) });
                }} className="min-h-12 rounded-[12px] border border-white/10 bg-white/[0.05] px-3 text-[18px] font-bold text-foreground outline-none focus:border-[color:var(--gold)]/55" />
              </label>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-[13px] font-bold text-muted-foreground">Cómo sube</p>
          <div className="grid grid-cols-2 gap-1.5">
            {SCHEMES.map((s) => (
              <button key={s.key} type="button" onClick={() => regen(s.key)} className="flex min-h-14 flex-col items-start justify-center rounded-[14px] border px-3 text-left" style={p.scheme === s.key ? { background: "#262C12", borderColor: "rgba(198,255,0,.35)" } : { background: "rgba(255,255,255,.04)", borderColor: "transparent" }}>
                <span className="text-[14px] font-bold">{s.label}</span><span className="text-[12px] text-muted-foreground">{s.hint}</span>
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-[13px] font-bold text-muted-foreground">Semana a semana (puedes tocar cualquier casilla)</p>
          <div className="grid grid-cols-4 gap-1.5">
            {p.steps.map((s, i) => {
              const deload = i > 0 && Number(s.pct.replace(",", ".")) < Number(p.steps[i - 1].pct.replace(",", "."));
              return (
                <div key={i} className="flex flex-col items-center gap-1 rounded-[14px] p-2" style={{ background: deload ? "#1F3442" : "rgba(255,255,255,.05)" }}>
                  <span className="text-[11.5px] text-muted-foreground">S{i + 1}{deload ? " · descarga" : ""}</span>
                  <input aria-label={`Porcentaje semana ${i + 1}`} inputMode="decimal" value={s.pct} onChange={(e) => setStep(i, { pct: e.target.value })} className="w-full bg-transparent text-center text-[22px] font-extrabold outline-none" style={{ fontFamily: "var(--font-num)", color: deload ? "#3BB8F5" : undefined }} />
                  <span className="flex items-center gap-0.5 text-[12px] text-muted-foreground">
                    <input aria-label={`Series semana ${i + 1}`} inputMode="numeric" value={s.sets} onChange={(e) => setStep(i, { sets: e.target.value })} className="w-5 bg-transparent text-center outline-none" />×
                    <input aria-label={`Reps semana ${i + 1}`} inputMode="numeric" value={s.reps} onChange={(e) => setStep(i, { reps: e.target.value })} className="w-5 bg-transparent text-center outline-none" />
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-2 pt-2">
        <button type="button" onClick={() => onSave(p)} className="min-h-[52px] rounded-full text-[16px] font-extrabold" style={{ background: "var(--gold)", color: "var(--gold-foreground)" }}>Aplicar a todas las semanas</button>
        {(prog.steps.length > 0 && prog.exercise) && <button type="button" onClick={onRemove} className="min-h-10 text-[13.5px] font-semibold text-muted-foreground">Quitar progresión (los días se quedan como están)</button>}
      </div>
    </Sheet>
  );
}

/* ---------------- Biblioteca ---------------- */

const CATS: { key: LibCategory; label: string }[] = [
  { key: "mine", label: "Mis bloques" },
  { key: "benchmarks", label: "Benchmarks" },
  { key: "warmups", label: "Calentamientos" },
  { key: "accessories", label: "Accesorios" },
];

export function LibrarySheet({ onAdd, onClose }: { onAdd: (b: PBlock) => void; onClose: () => void }) {
  const { data: mine = [], isError } = useMyLibrary();
  const del = useDeleteFromLibrary();
  const [cat, setCat] = useState<LibCategory>("benchmarks");
  const [q, setQ] = useState("");
  const blocks = mine.filter((m) => m.kind === "block");
  const items = useMemo(() => {
    const all = cat === "mine"
      ? blocks.map((m) => ({ id: m.id, cat: "mine" as const, title: m.title, subtitle: blockContent(m.payload as PBlock).split("\n").slice(0, 3).join(" · "), block: m.payload as PBlock, saved: true }))
      : BUILTIN.filter((b) => b.cat === cat).map((b) => ({ ...b, saved: false }));
    const t = q.trim().toLowerCase();
    return t ? [...all, ...(cat === "mine" ? [] : [])].filter((x) => `${x.title} ${x.subtitle}`.toLowerCase().includes(t)) : all;
  }, [cat, q, blocks]);
  // Al buscar, busca en todo
  const searchAll = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return null;
    const own = blocks.map((m) => ({ id: m.id, cat: "mine" as const, title: m.title, subtitle: blockContent(m.payload as PBlock).split("\n").slice(0, 3).join(" · "), block: m.payload as PBlock, saved: true }));
    return [...own, ...BUILTIN.map((b) => ({ ...b, saved: false }))].filter((x) => `${x.title} ${x.subtitle}`.toLowerCase().includes(t));
  }, [q, blocks]);
  const list = searchAll ?? items;
  return (
    <Sheet onClose={onClose} label="Biblioteca" tall>
      <div className="flex items-center justify-between">
        <h2 className="text-[19px] font-extrabold">Biblioteca</h2>
        <button type="button" onClick={onClose} aria-label="Cerrar" className="grid h-10 w-10 place-items-center rounded-full bg-white/[0.07]"><X className="h-[18px] w-[18px]" /></button>
      </div>
      <label className="mt-2 flex min-h-11 items-center gap-2 rounded-[12px] bg-white/[0.06] px-3">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar «fran», «movilidad»…" className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground" />
      </label>
      {!searchAll && (
        <div className="-mx-4 mt-2.5 flex gap-1.5 overflow-x-auto px-4" style={{ scrollbarWidth: "none" }}>
          {CATS.map((c) => <button key={c.key} type="button" onClick={() => setCat(c.key)} className="min-h-9 shrink-0 rounded-full px-3 text-[13px] font-bold" style={cat === c.key ? LIME_BG : OFF_BG}>{c.label}</button>)}
        </div>
      )}
      <div className="mt-3 flex-1 space-y-1.5 overflow-y-auto pb-2">
        {cat === "mine" && !searchAll && (isError
          ? <p className="rounded-[14px] bg-white/[0.04] p-3 text-[13.5px] text-muted-foreground">Tus bloques guardados estarán aquí cuando se aplique la migración de la biblioteca en Lovable.</p>
          : blocks.length === 0 && <p className="rounded-[14px] bg-white/[0.04] p-3 text-[13.5px] text-muted-foreground">Aún no has guardado bloques. En cualquier bloque de un día, pulsa el icono 🔖 para guardarlo aquí.</p>)}
        {list.map((it) => (
          <div key={it.id} className="flex items-center gap-2.5 rounded-[14px] bg-white/[0.04] px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-bold">{it.title}</p>
              <p className="line-clamp-2 text-[12.5px] text-muted-foreground">{it.subtitle}</p>
            </div>
            {it.saved && <button type="button" onClick={() => { if (window.confirm(`¿Quitar «${it.title}» de tu biblioteca?`)) del.mutate(it.id); }} aria-label="Quitar de la biblioteca" className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted-foreground"><Trash2 className="h-4 w-4" /></button>}
            <button type="button" onClick={() => { onAdd(instantiate({ ...it, cat: it.cat } as any)); toast.success(`«${it.title}» añadido`); onClose(); }} aria-label={`Añadir ${it.title}`} className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px]" style={{ background: "var(--gold)", color: "var(--gold-foreground)" }}><Plus className="h-5 w-5" strokeWidth={3} /></button>
          </div>
        ))}
        {searchAll && list.length === 0 && <p className="p-3 text-center text-[13.5px] text-muted-foreground">Nada con «{q}».</p>}
      </div>
    </Sheet>
  );
}

export function SaveBlockButton({ block }: { block: PBlock }) {
  const save = useSaveToLibrary();
  return (
    <button
      type="button"
      aria-label="Guardar en mi biblioteca"
      disabled={!blockContent(block).trim() || save.isPending}
      onClick={() => {
        const def = block.kind === "texto" ? block.title.trim() : blockContent(block).split("\n")[0];
        const title = window.prompt("Nombre para tu biblioteca", def || "Mi bloque");
        if (title === null) return;
        save.mutate({ kind: "block", title: title.trim() || def || "Mi bloque", payload: block }, {
          onSuccess: () => toast.success("Guardado en tu biblioteca"),
          onError: () => toast.error("No se pudo guardar. ¿Falta aplicar la migración de la biblioteca?"),
        });
      }}
      className="grid h-10 w-10 place-items-center rounded-full text-muted-foreground disabled:opacity-25"
    >
      <Bookmark className="h-4 w-4" />
    </button>
  );
}

/* ---------------- Plantillas ---------------- */

export function TemplatesList({ onPick }: { onPick: (p: PlanState, name: string) => void }) {
  const { data: mine = [] } = useMyLibrary();
  const del = useDeleteFromLibrary();
  const plans = mine.filter((m) => m.kind === "plan");
  if (!plans.length) return null;
  return (
    <section className="rounded-[18px] bg-card p-4">
      <p className="text-[15px] font-extrabold">Empezar desde una plantilla</p>
      <p className="text-[13px] text-muted-foreground">Se copia con las fechas que elijas arriba.</p>
      <div className="mt-2 flex flex-col gap-1.5">
        {plans.map((t) => {
          const s = t.payload as PlanState;
          return (
            <div key={t.id} className="flex items-center gap-2 rounded-[14px] bg-white/[0.04] px-3 py-2">
              <button type="button" onClick={() => onPick(s, t.title)} className="min-h-11 min-w-0 flex-1 text-left">
                <span className="block truncate text-[14.5px] font-bold">{t.title}</span>
                <span className="block text-[12.5px] text-muted-foreground">{s.weeks.length} semanas</span>
              </button>
              <button type="button" onClick={() => { if (window.confirm(`¿Borrar la plantilla «${t.title}»?`)) del.mutate(t.id); }} aria-label="Borrar plantilla" className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground"><Trash2 className="h-4 w-4" /></button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ---------------- Revisar y compartir ---------------- */

export function ShareStep({ plan, planKey, onDone }: { plan: PlanState; planKey: string | null; onDone: () => void }) {
  const me = getCurrentUserId();
  const { data: profiles = [] } = useProfiles();
  const { data: shares = [] } = useMyPlanningShares();
  const setShares = useSetPlanningShares();
  const saveTpl = useSaveToLibrary();
  const others = profiles.filter((p) => p.id !== me);
  const previous = useMemo(() => shares.filter((s: any) => s.plan_key === planKey).map((s: any) => s.recipient_id as string), [shares, planKey]);
  const [picked, setPicked] = useState<string[] | null>(null);
  const sel = picked ?? previous;
  const [asTemplate, setAsTemplate] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const { data: allowed = [] } = useCoachAthletes(today, today);
  const viewable = allowed.filter((a) => a.allowed);
  const [viewAs, setViewAs] = useState<string | null>(null);
  const { data: rms = [] } = useAthleteRms(viewAs);

  // Primer día con contenido desde hoy (o el primero del plan)
  const sample = useMemo(() => {
    const days = plan.weeks.flatMap((wk, wi) => wk.map((d) => ({ d, wi }))).filter(({ d }) => !d.rest && dayHasContent(d));
    return days.find(({ d }) => d.date >= today) ?? days[0] ?? null;
  }, [plan, today]);

  const finish = async () => {
    try {
      if (planKey && (sel.length || previous.length)) await setShares.mutateAsync({ planKey, recipientIds: sel, previous });
      if (asTemplate) await saveTpl.mutateAsync({ kind: "plan", title: plan.name, payload: { ...plan } });
      toast.success(sel.length ? `Compartido con ${sel.length} ${sel.length === 1 ? "atleta" : "atletas"}` : "Plan guardado");
      onDone();
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo compartir");
    }
  };

  return (
    <div className="page-enter space-y-4">
      <div>
        <p className="eyebrow">{plan.name} · guardado ✓</p>
        <h1 className="page-title mt-1">Revisar y compartir</h1>
      </div>

      {sample && (
        <section className="space-y-2.5 rounded-[20px] bg-card p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[15px] font-bold">Ver como</span>
            <div className="flex flex-wrap justify-end gap-1">
              <button type="button" onClick={() => setViewAs(null)} className="min-h-8 rounded-full px-2.5 text-[12.5px] font-bold" style={!viewAs ? LIME_BG : OFF_BG}>Yo</button>
              {viewable.map((a) => <button key={a.athlete_id} type="button" onClick={() => setViewAs(a.athlete_id)} className="min-h-8 rounded-full px-2.5 text-[12.5px] font-bold" style={viewAs === a.athlete_id ? LIME_BG : OFF_BG}>{a.name}</button>)}
            </div>
          </div>
          <div className="space-y-1.5 rounded-[16px] border border-white/10 bg-[#0C0C0E] p-3">
            <p className="text-[12.5px] font-extrabold text-gold">{parseISODate(sample.d.date)?.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "short" })} · semana {sample.wi + 1}</p>
            {sample.d.blocks.filter((b) => blockContent(b).trim()).map((b, i) => {
              const content = blockContent(b);
              const pcts = extractPercentages(content);
              const rec = viewAs ? detectExercise(content, rms.map((r) => ({ exercise: r.exercise, weight: r.weight, rep_max: r.rep_max ?? 1 })) as any) : null;
              const kg = rec && pcts.length ? loadsForPercentages(rec.weight, pcts)[0]?.suggested : null;
              return (
                <div key={b.id} className="flex items-center gap-2 rounded-[12px] bg-white/[0.04] px-2.5 py-2 text-[13.5px] font-bold">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-[7px] text-[11px]" style={i === 0 ? { background: "var(--gold)", color: "var(--gold-foreground)" } : { background: "rgba(255,255,255,.08)" }}>{blockLetter(i)}</span>
                  <span className="min-w-0 flex-1 truncate">{content.split("\n")[0]}</span>
                  {kg != null && <span className="shrink-0 text-gold">{formatKg(kg)} kg</span>}
                </div>
              );
            })}
          </div>
          <p className="text-[12.5px] text-muted-foreground">
            {viewAs ? (rms.length ? `Con los RM de ${viewable.find((a) => a.athlete_id === viewAs)?.name}.` : "Este atleta no tiene RM apuntados: verá solo el %.") : viewable.length ? "Elige un atleta para ver sus kilos." : "Cuando tus atletas te den permiso, podrás ver el plan con sus kilos."}
          </p>
        </section>
      )}

      {planKey && others.length > 0 && (
        <section className="rounded-[20px] bg-card px-4 py-2">
          <div className="flex items-center justify-between py-2">
            <span className="text-[15px] font-bold">Compartir con</span>
            <button type="button" onClick={() => setPicked(sel.length === others.length ? [] : others.map((o) => o.id))} className="min-h-9 text-[13px] font-bold text-gold">{sel.length === others.length ? "Nadie" : "Todos"}</button>
          </div>
          {others.map((o, i) => {
            const on = sel.includes(o.id);
            return (
              <button key={o.id} type="button" aria-pressed={on} onClick={() => setPicked(on ? sel.filter((x) => x !== o.id) : [...sel, o.id])} className={`flex min-h-12 w-full items-center gap-3 text-left ${i > 0 ? "border-t border-white/[0.06]" : ""}`}>
                <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{o.name}</span>
                <span className="grid h-6 w-6 place-items-center rounded-[8px] border-2" style={on ? { background: "var(--gold)", borderColor: "var(--gold)", color: "var(--gold-foreground)" } : { borderColor: "rgba(255,255,255,.25)" }}>{on && <Check className="h-3.5 w-3.5" strokeWidth={3} />}</span>
              </button>
            );
          })}
        </section>
      )}

      <button type="button" aria-pressed={asTemplate} onClick={() => setAsTemplate((v) => !v)} className="flex min-h-12 w-full items-center gap-3 rounded-[16px] bg-white/[0.04] px-3.5 text-left">
        <span className="grid h-6 w-6 place-items-center rounded-[8px] border-2" style={asTemplate ? { background: "var(--gold)", borderColor: "var(--gold)", color: "var(--gold-foreground)" } : { borderColor: "rgba(255,255,255,.25)" }}>{asTemplate && <Check className="h-3.5 w-3.5" strokeWidth={3} />}</span>
        <span><span className="block text-[15px] font-semibold">Guardar también como plantilla</span><span className="block text-[12.5px] text-muted-foreground">Para empezar el siguiente bloque desde este</span></span>
      </button>

      <button type="button" disabled={setShares.isPending || saveTpl.isPending} onClick={finish} className="pressable min-h-[56px] w-full rounded-full text-[16px] font-extrabold disabled:opacity-60" style={{ background: "var(--gold)", color: "var(--gold-foreground)" }}>
        {setShares.isPending || saveTpl.isPending ? "Guardando…" : sel.length ? `Compartir con ${sel.length}` : "Terminar"}
      </button>
    </div>
  );
}
