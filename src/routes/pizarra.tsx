import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, ImageIcon, Type, X, Plus, Trash2, AlertTriangle, Check } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { AiReaderUnavailable, extractChunks, readPlanWithAi } from "@/lib/ai-plan-reader";
import { DAY_KEYS, mondayOf, pid, toPlanning, type PDay, type PlanState } from "@/lib/plan-builder";
import { mergePlanningKeepingHistory, resultKeySet } from "@/lib/plan-merge";
import { addDays, buildPlanDateIndex, isoKey, parseISODate, weekdayOf } from "@/lib/plan-dates";
import { useAllResults, useOwnPlanning, usePersonalRecords, useSavePlanning } from "@/lib/store";
import { detectExercise, formatKg, loadsForPercentages } from "@/lib/rm-matcher";
import { extractPercentages } from "@/lib/plates";
import { BENCHMARKS } from "@/lib/wod";

export const Route = createFileRoute("/pizarra")({
  head: () => ({ meta: [{ title: "Escanear pizarra — RM OR DIE" }] }),
  component: BoardScanPage,
});

type Step = "capture" | "reading" | "review";
type EditBlock = { id: string; title: string; text: string };

const LETTERS = "ABCDEFGHIJKLMNOP";
const dayName = (iso: string) => { const w = weekdayOf(iso).toLowerCase(); return w.charAt(0).toUpperCase() + w.slice(1); };

function findBenchmark(text: string): string | null {
  const t = text.toLowerCase();
  for (const b of BENCHMARKS) {
    const re = new RegExp(`(^|[^a-záéíóúñ])${b.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-záéíóúñ]|$)`, "i");
    if (re.test(t)) return b;
  }
  return null;
}

function BoardScanPage() {
  const navigate = useNavigate();
  const today = isoKey(new Date());
  const [step, setStep] = useState<Step>("capture");
  const [photo, setPhoto] = useState<string | null>(null);
  const [pasting, setPasting] = useState(false);
  const [pasted, setPasted] = useState("");
  const [blocks, setBlocks] = useState<EditBlock[]>([]);
  const [notes, setNotes] = useState<string[]>([]);
  const [date, setDate] = useState(today);
  const [mode, setMode] = useState<"replace" | "append">("replace");
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const { data: own } = useOwnPlanning();
  const { data: results = [] } = useAllResults();
  const { data: records = [] } = usePersonalRecords();
  const save = useSavePlanning();

  useEffect(() => () => { if (photo) URL.revokeObjectURL(photo); }, [photo]);

  // Lo que ya hay ese día en tu planificación
  const existing = useMemo(() => {
    if (!own?.data) return null;
    const hit = buildPlanDateIndex(own.data.months).get(date);
    if (!hit || hit.day.isRest || hit.day.blocks.length === 0) return null;
    const trained = results.some((r) => r.month_key === hit.month.key && r.week === hit.week && r.day_key === hit.day.key);
    return { ...hit, trained };
  }, [own?.data, date, results]);

  async function read(files: File[], text = "") {
    setStep("reading");
    try {
      const chunks = await extractChunks(files, text);
      const r = await readPlanWithAi(chunks, {
        filename: files[0]?.name ?? "pizarra",
        hint: `Es la pizarra de un box de CrossFit (foto o captura) con el entreno de UN SOLO DÍA. Devuelve una única sesión con fecha ${today} y sus bloques en orden (A, B, C…). Corrige abreviaturas obvias de movimientos y conserva series, repeticiones, porcentajes (@), pesos (43/30), formato (AMRAP, For time, EMOM) y time cap. Si alguna palabra no se lee clara, dilo en notes.`,
      });
      const all = r.sessions.flatMap((s) => (s.rest ? [] : s.blocks)).filter((b) => b.content?.trim());
      if (all.length === 0) throw new Error("No he encontrado un entreno en la imagen. Prueba con otra foto más cerca y con luz.");
      setBlocks(all.map((b) => ({ id: pid(), title: /^[A-Z][).:-]?$/i.test((b.label ?? "").trim()) ? "" : (b.label ?? "").trim(), text: b.content.trim() })));
      setNotes(r.notes ?? []);
      setStep("review");
    } catch (e: any) {
      toast.error(e instanceof AiReaderUnavailable ? "El lector con IA no está disponible ahora mismo." : e?.message ?? "No se pudo leer la pizarra");
      setStep("capture");
    }
  }

  function onFile(f: File | undefined) {
    if (!f) return;
    if (photo) URL.revokeObjectURL(photo);
    setPhoto(URL.createObjectURL(f));
    void read([f]);
  }

  async function saveDay() {
    const clean = blocks.filter((b) => b.text.trim() || b.title.trim());
    if (clean.length === 0) return toast.error("No hay ningún bloque que guardar");
    const day = parseISODate(date);
    if (!day) return toast.error("Fecha no válida");
    if (date < today) return toast.error("Elige hoy o un día que esté por venir");
    if (existing?.trained) return toast.error("Ese día ya tiene entreno registrado; elige otro día");

    const keep = mode === "append" && existing ? existing.day.blocks.map((b) => ({ id: pid(), kind: "texto" as const, title: "", text: b.content })) : [];
    const pday: PDay = { date, rest: false, blocks: [...keep, ...clean.map((b) => ({ id: pid(), kind: "texto" as const, title: b.title.trim(), text: b.text.trim() }))] };
    const monday = mondayOf(day);
    const week: PDay[] = DAY_KEYS.map((_, i) => {
      const iso = isoKey(addDays(monday, i));
      return iso === date ? pday : { date: iso, rest: true, blocks: [] };
    });
    const state: PlanState = { v: 1, name: "Pizarra", start: isoKey(monday), weeks: [week] };
    const incoming = toPlanning(state);
    // Solo se añade el día de la pizarra, nunca los descansos vacíos de alrededor
    incoming.months.forEach((m) => m.weeks.forEach((w) => (w.days = w.days.filter((d) => d.date === date))));
    incoming.months = incoming.months.filter((m) => m.weeks.some((w) => w.days.length));
    delete incoming.builder;

    const planning = own?.data ? mergePlanningKeepingHistory(own.data, incoming, resultKeySet(results), today).planning : incoming;
    try {
      const saved = await save.mutateAsync({ planning, filename: own?.source_filename ?? "Pizarra" });
      const hit = buildPlanDateIndex((saved?.data ?? planning).months).get(date);
      toast.success(date === today ? "Añadido a hoy" : `Añadido al ${dayName(date).toLowerCase()} ${Number(date.slice(8))}`);
      if (hit) navigate({ to: "/workout/$month/$week/$day", params: { month: hit.month.key, week: String(hit.week), day: hit.day.key } });
      else navigate({ to: "/calendar" });
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo guardar el entreno");
    }
  }

  const inputs = (
    <>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />
      <input ref={galleryRef} type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />
    </>
  );

  if (step === "capture" || step === "reading") {
    return (
      <AppShell>
        {inputs}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h1 className="text-[28px] font-extrabold tracking-tight">Escanear pizarra</h1>
            <button type="button" onClick={() => navigate({ to: "/" })} aria-label="Cerrar" className="grid h-10 w-10 place-items-center rounded-full bg-white/[0.07]"><X className="h-[18px] w-[18px]" /></button>
          </div>
          <div className="relative aspect-[3/4] w-full overflow-hidden rounded-[26px] bg-[#1B1B1D]">
            {photo ? <img src={photo} alt="Pizarra" className="absolute inset-0 h-full w-full object-cover" /> : (
              <div className="absolute inset-0 grid place-items-center p-8 text-center text-[15px] text-muted-foreground">
                Haz una foto a la pizarra del box o elige una captura del WhatsApp o Instagram del box.
              </div>
            )}
            <div aria-hidden className="absolute inset-5">
              {["left-0 top-0 border-l-4 border-t-4 rounded-tl-[18px]", "right-0 top-0 border-r-4 border-t-4 rounded-tr-[18px]", "left-0 bottom-0 border-l-4 border-b-4 rounded-bl-[18px]", "right-0 bottom-0 border-r-4 border-b-4 rounded-br-[18px]"].map((c) => (
                <span key={c} className={`absolute h-10 w-10 ${c}`} style={{ borderColor: "var(--gold)" }} />
              ))}
              {step === "reading" && <span className="board-scan absolute left-2 right-2 h-[3px] rounded-full" style={{ background: "var(--gold)", boxShadow: "0 0 18px 4px rgba(198,255,0,.5)" }} />}
            </div>
            {step === "reading" && (
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-5 pt-12 text-center text-[15px] font-bold">Leyendo la pizarra…</div>
            )}
          </div>
          {step === "capture" && !pasting && (
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
              <button type="button" onClick={() => galleryRef.current?.click()} className="pressable flex min-h-14 flex-col items-center justify-center gap-1 rounded-[16px] bg-white/[0.06] text-[13px] font-bold"><ImageIcon className="h-5 w-5" />Galería</button>
              <button type="button" onClick={() => cameraRef.current?.click()} aria-label="Hacer foto" className="pressable grid h-[78px] w-[78px] place-items-center rounded-full border-4 border-white">
                <span className="grid h-[60px] w-[60px] place-items-center rounded-full" style={{ background: "var(--gold)", color: "var(--gold-foreground)" }}><Camera className="h-6 w-6" /></span>
              </button>
              <button type="button" onClick={() => setPasting(true)} className="pressable flex min-h-14 flex-col items-center justify-center gap-1 rounded-[16px] bg-white/[0.06] text-[13px] font-bold"><Type className="h-5 w-5" />Pegar texto</button>
            </div>
          )}
          {step === "capture" && pasting && (
            <div className="flex flex-col gap-2">
              <textarea autoFocus value={pasted} onChange={(e) => setPasted(e.target.value)} rows={7} placeholder={"A) Back squat 5x3 @80%\nB) Fran 21-15-9 thrusters 43/30, pull-ups. TC 8'"} className="w-full rounded-[16px] border border-white/10 bg-white/[0.05] p-3.5 text-[15px] outline-none focus:border-[color:var(--gold)]/55" />
              <div className="flex gap-2">
                <button type="button" onClick={() => setPasting(false)} className="min-h-12 rounded-full bg-white/[0.08] px-5 font-bold">Volver</button>
                <button type="button" disabled={!pasted.trim()} onClick={() => read([], pasted)} className="min-h-12 flex-1 rounded-full font-extrabold disabled:opacity-50" style={{ background: "var(--gold)", color: "var(--gold-foreground)" }}>Leer texto</button>
              </div>
            </div>
          )}
        </div>
      </AppShell>
    );
  }

  // ---------- Revisión ----------
  return (
    <AppShell>
      {inputs}
      <div className="flex flex-col gap-3 pb-4">
        <div className="flex items-center justify-between">
          <h1 className="text-[22px] font-extrabold tracking-tight">Revisa lo que he leído</h1>
          <button type="button" onClick={() => { setStep("capture"); setBlocks([]); }} className="min-h-10 rounded-full bg-white/[0.07] px-3.5 text-[13px] font-bold">Repetir</button>
        </div>
        {photo && <img src={photo} alt="" className="h-24 w-full rounded-[16px] object-cover" />}

        {notes.map((n, i) => (
          <p key={i} className="flex gap-2 rounded-[14px] px-3 py-2.5 text-[13.5px]" style={{ background: "#2A1E10", color: "#FFB35C" }}><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{n}</p>
        ))}

        {blocks.map((b, i) => {
          const full = `${b.title}\n${b.text}`;
          const bench = findBenchmark(full);
          const rec = detectExercise(full, records);
          const pcts = extractPercentages(full);
          const loads = rec && pcts.length ? loadsForPercentages(rec.weight, pcts) : [];
          return (
            <div key={b.id} className="flex flex-col gap-2 rounded-[20px] bg-card p-3.5">
              <div className="flex items-center gap-2.5">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] font-extrabold" style={i === 0 ? { background: "var(--gold)", color: "var(--gold-foreground)" } : { background: "rgba(255,255,255,.08)" }}>{LETTERS[i] ?? i + 1}</span>
                <input value={b.title} onChange={(e) => setBlocks((bs) => bs.map((x) => (x.id === b.id ? { ...x, title: e.target.value } : x)))} placeholder="Título (opcional)" className="min-h-10 min-w-0 flex-1 bg-transparent text-[15.5px] font-bold outline-none placeholder:font-semibold placeholder:text-muted-foreground" />
                <button type="button" onClick={() => setBlocks((bs) => bs.filter((x) => x.id !== b.id))} aria-label="Quitar bloque" className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground"><Trash2 className="h-4 w-4" /></button>
              </div>
              <textarea value={b.text} onChange={(e) => setBlocks((bs) => bs.map((x) => (x.id === b.id ? { ...x, text: e.target.value } : x)))} rows={Math.max(2, b.text.split("\n").length)} className="w-full rounded-[12px] border border-dashed border-white/15 bg-white/[0.03] px-3 py-2 text-[14px] leading-relaxed outline-none focus:border-[color:var(--gold)]/55" />
              {(bench || loads.length > 0) && (
                <div className="flex flex-wrap gap-1.5">
                  {loads.map((l) => <span key={l.pct} className="rounded-[8px] px-2 py-1 text-[12px] font-bold" style={{ background: "#333B18", color: "var(--gold)" }}>{l.pct} % de tu RM ({formatKg(rec!.weight)}) → {formatKg(l.suggested)} kg</span>)}
                  {bench && <span className="rounded-[8px] px-2 py-1 text-[12px] font-bold" style={{ background: "#1F3442", color: "#3BB8F5" }}>Benchmark: {bench}</span>}
                </div>
              )}
            </div>
          );
        })}
        <button type="button" onClick={() => setBlocks((bs) => [...bs, { id: pid(), title: "", text: "" }])} className="flex min-h-11 items-center justify-center gap-1.5 rounded-[16px] border border-dashed border-white/15 text-[14px] font-bold text-muted-foreground"><Plus className="h-4 w-4" />Añadir bloque</button>

        <div className="mt-2 flex flex-col gap-2">
          <p className="text-[13px] font-bold text-muted-foreground">¿Para qué día?</p>
          <div className="flex gap-1 rounded-[14px] bg-white/[0.05] p-1">
            <button type="button" onClick={() => setDate(today)} className="min-h-10 flex-1 rounded-[10px] text-[13px] font-bold" style={date === today ? { background: "#333B18", color: "var(--gold)" } : { color: "var(--muted-foreground)" }}>Hoy · {dayName(today).toLowerCase()}</button>
            <label className="relative flex min-h-10 flex-1 cursor-pointer items-center justify-center rounded-[10px] text-[13px] font-bold" style={date !== today ? { background: "#333B18", color: "var(--gold)" } : { color: "var(--muted-foreground)" }}>
              {date !== today ? `${dayName(date)} ${Number(date.slice(8))}` : "Otro día"}
              <input type="date" min={today} value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="absolute inset-0 opacity-0" />
            </label>
          </div>
          {existing && !existing.trained && (
            <div className="flex flex-col gap-2 rounded-[16px] bg-white/[0.04] p-3">
              <p className="text-[13.5px]">Ese día ya tiene entreno en tu plan ({existing.day.blocks.length} {existing.day.blocks.length === 1 ? "bloque" : "bloques"}).</p>
              <div className="flex gap-1 rounded-[12px] bg-white/[0.05] p-1">
                <button type="button" onClick={() => setMode("replace")} className="min-h-10 flex-1 rounded-[9px] text-[13px] font-bold" style={mode === "replace" ? { background: "#333B18", color: "var(--gold)" } : { color: "var(--muted-foreground)" }}>Sustituirlo</button>
                <button type="button" onClick={() => setMode("append")} className="min-h-10 flex-1 rounded-[9px] text-[13px] font-bold" style={mode === "append" ? { background: "#333B18", color: "var(--gold)" } : { color: "var(--muted-foreground)" }}>Añadir como bloques extra</button>
              </div>
            </div>
          )}
          {existing?.trained && <p className="rounded-[14px] px-3 py-2.5 text-[13.5px]" style={{ background: "#2A1E10", color: "#FFB35C" }}>Ese día ya tiene resultados apuntados y no se cambia. Elige otro día.</p>}
          <p className="text-[12.5px] text-muted-foreground">El resto de tu planificación no se toca.</p>
          <button type="button" disabled={save.isPending} onClick={saveDay} className="pressable mt-1 flex min-h-[54px] items-center justify-center gap-2 rounded-full text-[16px] font-extrabold disabled:opacity-60" style={{ background: "var(--gold)", color: "var(--gold-foreground)" }}>
            <Check className="h-5 w-5" />{save.isPending ? "Guardando…" : "Guardar entreno"}
          </button>
        </div>
      </div>
    </AppShell>
  );
}
