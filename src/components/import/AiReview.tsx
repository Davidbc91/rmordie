import { useMemo, useState } from "react";
import { ChevronDown, Sparkles, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { needsStartDate, toPlanState, type AiReadResult } from "@/lib/ai-plan-reader";
import { DAY_SHORT, blockContent, toPlanning } from "@/lib/plan-builder";
import { parseISODate } from "@/lib/plan-dates";
import { mergePlanningPreservingPrevious } from "@/lib/pdf-import";
import { usePlanning, useSavePlanning } from "@/lib/store";

const font = { fontFamily: "var(--font-editorial)" };

function fmtDay(iso: string) {
  return parseISODate(iso)?.toLocaleDateString("es-ES", { day: "numeric", month: "short" }) ?? iso;
}

export function AiReview({
  result, filename, defaultStart, onCancel, onSaved, onReread, rereading,
}: {
  result: AiReadResult;
  filename: string;
  defaultStart: string;
  onCancel: () => void;
  onSaved: (openEditor: boolean) => void;
  onReread: (hint: string) => void;
  rereading: boolean;
}) {
  const { data: current } = usePlanning();
  const save = useSavePlanning();
  const [name, setName] = useState(result.plan_name || filename.replace(/\.[^.]+$/, ""));
  const [start, setStart] = useState(defaultStart);
  const [keepOthers, setKeepOthers] = useState(true);
  const [hint, setHint] = useState("");
  const [showAll, setShowAll] = useState(false);
  const askStart = needsStartDate(result);

  const plan = useMemo(() => toPlanState(result, start, name), [result, start, name]);
  const training = plan.weeks.flat().filter((d) => !d.rest);
  const first = training[0]?.date;
  const last = training[training.length - 1]?.date;
  const blockCount = training.reduce((n, d) => n + d.blocks.length, 0);
  const weeksShown = showAll ? plan.weeks : plan.weeks.slice(0, 2);
  const hasCurrent = !!current && current.data.months.length > 0;

  async function onSave(openEditor: boolean) {
    if (!training.length) {
      toast.error("No hay ningún entreno que guardar.");
      return;
    }
    const incoming = toPlanning(plan);
    const planning = hasCurrent && keepOthers ? mergePlanningPreservingPrevious(current!.data, incoming) : incoming;
    try {
      await save.mutateAsync({ planning, filename: name.trim() || filename });
    } catch (e) {
      toast.error(`No se pudo guardar: ${(e as { message?: string })?.message ?? "error desconocido"}`);
      return;
    }
    toast.success(`Planificación guardada: ${training.length} entrenos. Tus registros están intactos.`);
    onSaved(openEditor);
  }

  return (
    <div className="mt-4 space-y-4">
      <section className="rounded-[22px] border border-[color:var(--gold)]/35 bg-[color:var(--gold)]/[0.07] p-4">
        <p className="flex items-center gap-2 text-[13px] font-bold tracking-[0.1em] text-gold">
          <Sparkles className="h-4 w-4" /> LECTURA INTELIGENTE
        </p>
        <p className="mt-2 text-[32px] font-extrabold leading-none" style={font}>
          {training.length} ENTRENOS
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {first && last ? `Del ${fmtDay(first)} al ${fmtDay(last)}` : "Sin fechas"} · {plan.weeks.length} semanas · {blockCount} bloques
        </p>
      </section>

      {result.notes.length > 0 && (
        <section className="rounded-[18px] bg-white/[0.045] p-3.5">
          <p className="flex items-center gap-2 text-sm font-bold"><TriangleAlert className="h-4 w-4 text-gold" /> A revisar</p>
          <ul className="mt-1.5 list-disc space-y-1 pl-5 text-[13px] leading-relaxed text-muted-foreground">
            {result.notes.map((n) => <li key={n}>{n}</li>)}
          </ul>
        </section>
      )}

      <label className="flex flex-col gap-1.5 text-[13px] text-muted-foreground">
        Nombre del plan
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="min-h-[52px] rounded-[14px] border border-white/15 bg-white/[0.06] px-3.5 text-base text-foreground"
        />
      </label>

      {askStart && (
        <label className="flex flex-col gap-1.5 text-[13px] text-muted-foreground">
          El plan no trae fechas. ¿Cuándo empieza?
          <input
            type="date"
            value={start}
            onChange={(e) => e.target.value && setStart(e.target.value)}
            className="min-h-[52px] rounded-[14px] border border-[color:var(--gold)]/50 bg-white/[0.06] px-3.5 text-base text-foreground"
          />
          <span>La semana 1 empieza ese lunes. Luego puedes mover días en el calendario.</span>
        </label>
      )}

      <section>
        <h2 className="mb-2 text-lg font-extrabold">Así queda</h2>
        <div className="space-y-3">
          {weeksShown.map((week, wi) => (
            <div key={week[0].date}>
              <p className="mb-1.5 text-[13px] tracking-[0.12em] text-muted-foreground">SEMANA {wi + 1} · {fmtDay(week[0].date)}</p>
              <div className="space-y-1.5">
                {week.filter((d) => !d.rest).map((d) => {
                  const date = parseISODate(d.date);
                  return (
                    <details key={d.date} className="rounded-[16px] bg-white/[0.045] px-3">
                      <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3">
                        <span className="w-10 shrink-0 text-center">
                          <span className="block text-[24px] font-extrabold leading-none" style={font}>{date?.getDate()}</span>
                          <span className="text-xs text-muted-foreground">{DAY_SHORT[date ? (date.getDay() + 6) % 7 : 0]}</span>
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">
                          {blockContent(d.blocks[0]).split("\n")[0]}
                        </span>
                        <span className="shrink-0 text-[13px] text-muted-foreground">{d.blocks.length} bl.</span>
                      </summary>
                      <div className="space-y-2 pb-3">
                        {d.blocks.map((b, bi) => (
                          <pre key={b.id} className="whitespace-pre-wrap rounded-[12px] bg-black/25 p-2.5 font-sans text-[13px] leading-relaxed text-foreground/90">
                            <b className="text-gold">{String.fromCharCode(65 + bi)} · </b>{blockContent(b)}
                          </pre>
                        ))}
                      </div>
                    </details>
                  );
                })}
                {week.every((d) => d.rest) && <p className="px-1 text-[13px] text-muted-foreground">Sin entrenos esta semana</p>}
              </div>
            </div>
          ))}
        </div>
        {plan.weeks.length > 2 && (
          <button type="button" onClick={() => setShowAll((v) => !v)} className="mt-2 flex min-h-12 w-full items-center justify-center gap-1.5 text-sm text-muted-foreground">
            {showAll ? "Ver menos" : `Ver las ${plan.weeks.length} semanas`}
            <ChevronDown className={`h-4 w-4 transition-transform ${showAll ? "rotate-180" : ""}`} />
          </button>
        )}
      </section>

      <details className="rounded-[18px] bg-white/[0.045] px-3.5">
        <summary className="flex min-h-[52px] cursor-pointer items-center text-[15px] font-bold">¿Algo mal leído? Corrígelo con una frase</summary>
        <textarea
          value={hint}
          onChange={(e) => setHint(e.target.value)}
          rows={3}
          placeholder="Ej.: las columnas son semanas y las filas días; el plan es de enero 2027; ignora la hoja «Notas»"
          className="w-full rounded-[14px] border border-white/15 bg-white/[0.06] p-3 text-base"
        />
        <button
          type="button"
          disabled={!hint.trim() || rereading}
          onClick={() => onReread(hint.trim())}
          className="mb-3.5 mt-2 min-h-12 w-full rounded-[14px] bg-white/[0.08] text-sm font-bold disabled:opacity-40"
        >
          {rereading ? "Leyendo otra vez…" : "Volver a leer con esta indicación"}
        </button>
      </details>

      {hasCurrent && (
        <label className="flex min-h-12 items-start gap-3 text-sm">
          <input type="checkbox" checked={keepOthers} onChange={(e) => setKeepOthers(e.target.checked)} className="mt-1 h-5 w-5 accent-[color:var(--gold)]" />
          <span>
            Mantener los meses de mi plan actual que no aparecen aquí
            <span className="block text-[13px] text-muted-foreground">Si lo quitas, esta lectura sustituye a toda la planificación. Tus registros nunca se borran.</span>
          </span>
        </label>
      )}

      <div className="space-y-2 pb-4">
        <button
          type="button"
          disabled={save.isPending || !training.length}
          onClick={() => onSave(false)}
          className="gold-gradient min-h-14 w-full rounded-[16px] text-[22px] font-extrabold disabled:opacity-40"
          style={font}
        >
          {save.isPending ? "GUARDANDO…" : "GUARDAR PLANIFICACIÓN"}
        </button>
        <button type="button" disabled={save.isPending} onClick={() => onSave(true)} className="min-h-12 w-full rounded-[14px] bg-white/[0.08] text-[15px] font-bold">
          Guardar y retocar a mano
        </button>
        <button type="button" onClick={onCancel} className="min-h-12 w-full text-[15px] text-muted-foreground">Cancelar</button>
      </div>
    </div>
  );
}
