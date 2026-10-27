import { useMemo, useState } from "react";
import { Check, ChevronLeft, MoreHorizontal, Pencil, Trash2, X, BookOpen } from "lucide-react";
import type { PersonalRecord, PersonalRecordHistory } from "@/lib/store";
import { formatKg } from "@/lib/rm-matcher";
import { MovementDictionaryLink } from "@/components/MovementDictionaryLink";
import { historyFor, monthName, periodLabel, recordAt, trendFor, type Session } from "@/lib/progression-chart";

const PERIODS = [
  { label: "1 mes", days: 30 },
  { label: "3 meses", days: 90 },
  { label: "1 año", days: 365 },
  { label: "Todo", days: 0 },
] as const;

const font = { fontFamily: "var(--font-editorial)" } as const;
const kg = (n: number) => formatKg(Math.round(n * 100) / 100);
const shortDate = (iso: string) => new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short" }).replace(".", "");

/** Pantalla de progresión de un ejercicio: gráfico, tendencia y sesiones. */
export function ProgressionView({
  records,
  allHistory,
  sessions,
  onBack,
  onSaveEdit,
  onDelete,
}: {
  records: PersonalRecord[];
  allHistory: PersonalRecordHistory[];
  sessions: Session[];
  onBack: () => void;
  onSaveEdit: (id: string, exercise: string, weight: number) => Promise<boolean>;
  onDelete: (r: PersonalRecord) => Promise<boolean>;
}) {
  const sorted = useMemo(() => [...records].sort((a, b) => (a.rep_max ?? 1) - (b.rep_max ?? 1)), [records]);
  const [repMax, setRepMax] = useState<number>(sorted[0]?.rep_max ?? 1);
  const record = sorted.find((r) => (r.rep_max ?? 1) === repMax) ?? sorted[0];
  const [periodDays, setPeriodDays] = useState<number>(90);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editWeight, setEditWeight] = useState("");
  const [editName, setEditName] = useState("");
  const [showAll, setShowAll] = useState(false);

  const current = Number(record?.weight ?? 0);
  const history = useMemo(() => (record ? historyFor(record.exercise, repMax, allHistory) : []), [record, repMax, allHistory]);
  const now = Date.now();
  const earliest = useMemo(() => {
    const times = [...history.map((h) => new Date(h.changed_at).getTime()), ...sessions.map((s) => new Date(s.date).getTime())];
    return times.length ? Math.min(...times) : now - 90 * 86400000;
  }, [history, sessions, now]);
  const days = periodDays || Math.max(30, Math.ceil((now - earliest) / 86400000) + 3);
  const start = now - days * 86400000;
  const inPeriod = (iso: string) => new Date(iso).getTime() >= start;

  const showEst = repMax === 1;
  const periodSessions = sessions.filter((s) => inPeriod(s.date));
  const trend = record ? trendFor(current, history, sessions, days, now) : null;
  const atStart = recordAt(history, start, current);
  const delta = atStart != null ? current - atStart : null;
  const prsInPeriod = history.filter((h) => inPeriod(h.changed_at) && (h.previous_weight == null || Number(h.new_weight) > Number(h.previous_weight)));
  const heaviest = periodSessions.length ? Math.max(...periodSessions.map((s) => s.weight)) : null;
  const lastEst = showEst ? [...sessions].reverse().find((s) => s.est != null)?.est ?? null : null;

  let insight: { tone: "good" | "neutral" | "warn"; text: string } | null = null;
  if (record) {
    if (lastEst != null && lastEst > current) {
      insight = { tone: "good", text: `Tu último entreno marca un 1RM estimado de ${kg(lastEst)} kg, por encima de tu récord: buen momento para probar un 1RM nuevo.` };
    } else if (trend?.kind === "up") {
      insight = { tone: "good", text: delta && delta > 0 ? `Subiendo. Has ganado ${kg(delta)} kg ${periodLabel(days)}.` : "Subiendo. Tus cargas de entreno van a más." };
    } else if (trend?.kind === "down") {
      insight = { tone: "warn", text: "Tus últimos entrenos están por debajo de lo habitual. Revisa descanso y recuperación antes de apretar." };
    } else if (trend?.kind === "stable") {
      insight = { tone: "neutral", text: "Estable. Si llevas semanas igual, prueba a variar series y reps o a buscar un récord en otro rango (3RM o 5RM)." };
    }
  }

  // Lista: entrenos + récords, lo más reciente primero
  const events = useMemo(() => {
    const list: Array<{ key: string; date: string; kind: "pr" | "session"; s?: Session; weight?: number }> = [
      ...sessions.map((s) => ({ key: s.id, date: s.date, kind: "session" as const, s })),
      ...history.map((h) => ({ key: h.id, date: h.changed_at, kind: "pr" as const, weight: Number(h.new_weight) })),
    ];
    return list.sort((a, b) => b.date.localeCompare(a.date));
  }, [sessions, history]);
  const shownEvents = showAll ? events : events.slice(0, 5);

  if (!record) return null;

  async function save() {
    const w = Number(editWeight.replace(",", "."));
    if (await onSaveEdit(record.id, editName.trim() || record.exercise, w)) setEditing(false);
  }

  return (
    <div className="page-enter">
      <div className="flex items-center justify-between">
        <button type="button" onClick={onBack} className="flex min-h-11 items-center gap-1 pr-2 text-[15px] text-muted-foreground">
          <ChevronLeft className="h-[18px] w-[18px]" /> Récords
        </button>
        <div className="relative">
          <button type="button" aria-label="Más opciones" aria-expanded={menuOpen} onClick={() => setMenuOpen((v) => !v)} className="grid h-11 w-11 place-items-center rounded-full bg-white/[0.06]">
            <MoreHorizontal className="h-5 w-5" />
          </button>
          {menuOpen && (
            <div className="surface-sheet absolute right-0 top-12 z-30 w-60 overflow-hidden p-1.5 text-[15px]">
              <button type="button" onClick={() => { setMenuOpen(false); setEditing(true); setEditWeight(String(record.weight)); setEditName(record.exercise); }} className="flex min-h-12 w-full items-center gap-2.5 rounded-[12px] px-3 text-left hover:bg-white/[0.05]">
                <Pencil className="h-4 w-4" /> Editar {repMax}RM
              </button>
              <button type="button" onClick={async () => { setMenuOpen(false); if (await onDelete(record) && sorted.length <= 1) onBack(); }} className="flex min-h-12 w-full items-center gap-2.5 rounded-[12px] px-3 text-left text-red-300 hover:bg-white/[0.05]">
                <Trash2 className="h-4 w-4" /> Borrar {repMax}RM
              </button>
              <div className="flex min-h-12 items-center gap-2.5 rounded-[12px] px-3">
                <BookOpen className="h-4 w-4" />
                <MovementDictionaryLink exerciseName={record.exercise}>Ver en el diccionario</MovementDictionaryLink>
              </div>
            </div>
          )}
        </div>
      </div>

      <p className="eyebrow mt-2">Progresión · {repMax}RM</p>
      <h1 className="mt-1 truncate text-[56px] font-black uppercase leading-[0.9] text-[color:var(--gold-soft)]" style={font}>{record.exercise}</h1>

      {sorted.length > 1 && (
        <div role="group" aria-label="Tipo de récord" className="mt-3 flex gap-1.5">
          {sorted.map((r) => (
            <button key={r.id} type="button" aria-pressed={(r.rep_max ?? 1) === repMax} onClick={() => setRepMax(r.rep_max ?? 1)}
              className={`min-h-10 rounded-full px-3.5 text-sm font-bold ${(r.rep_max ?? 1) === repMax ? "bg-[color:var(--gold)] text-[color:var(--gold-foreground)]" : "bg-white/[0.06]"}`}>
              {r.rep_max ?? 1}RM
            </button>
          ))}
        </div>
      )}

      {editing ? (
        <div className="mt-4 space-y-2 rounded-[18px] bg-white/[0.05] p-3.5">
          <input value={editName} onChange={(e) => setEditName(e.target.value)} maxLength={60} aria-label="Nombre del ejercicio"
            className="min-h-12 w-full rounded-[14px] border border-white/[0.14] bg-white/[0.06] px-3.5 text-base outline-none focus:border-[color:var(--gold)]/60" />
          <div className="flex items-center gap-2">
            <input inputMode="decimal" value={editWeight} onChange={(e) => setEditWeight(e.target.value)} aria-label="Peso en kg"
              className="min-h-12 flex-1 rounded-[14px] border border-white/[0.14] bg-white/[0.06] px-3.5 text-2xl font-extrabold tabular outline-none focus:border-[color:var(--gold)]/60" style={font} />
            <span className="text-sm text-muted-foreground">kg</span>
            <button type="button" onClick={save} aria-label="Guardar" className="gold-gradient grid h-12 w-12 place-items-center rounded-[14px]"><Check className="h-5 w-5" /></button>
            <button type="button" onClick={() => setEditing(false)} aria-label="Cancelar" className="grid h-12 w-12 place-items-center rounded-[14px] bg-white/[0.06]"><X className="h-5 w-5" /></button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex items-end gap-3.5">
          <span className="text-[88px] font-black leading-[0.85] tabular" style={font}>
            {kg(current)}<span className="text-[30px]"> KG</span>
          </span>
          {delta != null && delta !== 0 && (
            <span className="pb-2">
              <span className={`block text-[15px] font-bold ${delta > 0 ? "text-[#8FD19E]" : "text-red-300"}`}>{delta > 0 ? "▲ +" : "▼ "}{kg(delta)} kg</span>
              <span className="text-[13px] text-muted-foreground">{periodDays ? `desde ${monthName(start)}` : "desde el principio"}</span>
            </span>
          )}
        </div>
      )}

      <div role="group" aria-label="Periodo" className="mt-4 flex gap-1 rounded-[14px] bg-white/[0.06] p-1">
        {PERIODS.map((p) => (
          <button key={p.label} type="button" aria-pressed={periodDays === p.days} onClick={() => setPeriodDays(p.days)}
            className={`min-h-10 flex-1 rounded-[10px] text-sm ${periodDays === p.days ? "bg-[color:var(--gold)] font-bold text-[color:var(--gold-foreground)]" : "font-semibold text-muted-foreground"}`}>
            {p.label}
          </button>
        ))}
      </div>

      <section className="mt-3 rounded-[22px] bg-white/[0.045] px-2.5 pb-3 pt-3.5">
        <ProgressChart
          start={start}
          end={now}
          current={current}
          history={history}
          points={showEst ? periodSessions.filter((s) => s.est != null).map((s) => ({ t: new Date(s.date).getTime(), w: s.est! })) : []}
        />
        <div className="flex flex-wrap gap-x-4 gap-y-1 px-1.5 pt-2 text-[13px] text-foreground/85">
          <span className="flex items-center gap-1.5"><span className="inline-block h-[3px] w-[18px] bg-[color:var(--gold)]" />Tu {repMax}RM</span>
          {showEst && <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full border-2 border-[color:var(--gold-soft)]" />1RM estimado de cada entreno</span>}
        </div>
      </section>

      {insight && (
        <div className={`mt-3 rounded-[16px] border px-3.5 py-3 text-sm leading-relaxed ${insight.tone === "good" ? "border-[#8FD19E]/25 bg-[#8FD19E]/[0.08]" : insight.tone === "warn" ? "border-red-300/25 bg-red-300/[0.06]" : "border-white/10 bg-white/[0.04]"}`}>
          {insight.text}
        </div>
      )}

      <div className="mt-3 grid grid-cols-3 gap-2">
        <Stat value={String(periodSessions.length)} label="sesiones" />
        <Stat value={heaviest != null ? kg(heaviest) : "—"} label="kg más pesado" />
        <Stat value={String(prsInPeriod.length)} label={prsInPeriod.length === 1 ? "récord" : "récords"} />
      </div>

      <section className="mt-5">
        <h2 className="mb-2 text-lg font-extrabold">Sesiones</h2>
        {events.length === 0 ? (
          <p className="rounded-[18px] bg-white/[0.04] p-5 text-center text-sm text-muted-foreground">
            Cuando registres cargas de este ejercicio en tus entrenos, aparecerán aquí.
          </p>
        ) : (
          <div className="overflow-hidden rounded-[18px] bg-white/[0.045]">
            {shownEvents.map((e) => (
              <div key={e.key} className="flex min-h-[60px] items-center gap-3 border-b border-white/[0.06] px-3.5 last:border-b-0">
                <span className="w-[52px] shrink-0 text-[13px] text-muted-foreground">{shortDate(e.date)}</span>
                {e.kind === "pr" ? (
                  <>
                    <span className="min-w-0 flex-1 text-[15px] font-bold text-[color:var(--gold-soft)]">Nuevo récord · {kg(e.weight!)} kg</span>
                    <span className="rounded-full bg-[color:var(--gold)] px-2 py-0.5 text-xs font-extrabold text-[color:var(--gold-foreground)]">PR</span>
                  </>
                ) : (
                  <>
                    <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">
                      {[`${kg(e.s!.weight)} kg`, e.s!.sets != null && e.s!.reps != null ? `${e.s!.sets}×${e.s!.reps}` : e.s!.reps != null ? `${e.s!.reps} reps` : null, e.s!.rpe != null ? `RPE ${kg(e.s!.rpe)}` : null].filter(Boolean).join(" · ")}
                    </span>
                    {showEst && e.s!.est != null && <span className="shrink-0 text-[13px] text-[color:var(--gold-soft)]">≈ {kg(e.s!.est)}</span>}
                  </>
                )}
              </div>
            ))}
            {events.length > 5 && (
              <button type="button" onClick={() => setShowAll((v) => !v)} className="flex min-h-12 w-full items-center justify-center text-sm text-muted-foreground">
                {showAll ? "Ver menos" : `Ver todas (${events.length})`}
              </button>
            )}
          </div>
        )}
        {showEst && <p className="mt-2 px-1 text-xs text-muted-foreground">≈ es el 1RM estimado con la carga y las reps de ese día.</p>}
      </section>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <span className="rounded-[14px] bg-white/[0.045] px-3 py-2.5">
      <span className="block text-[26px] font-extrabold leading-none tabular" style={font}>{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </span>
  );
}

const MONTH_ABBR = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** Gráfico propio en SVG: escalones dorados del récord y círculos del 1RM estimado. */
function ProgressChart({ start, end, current, history, points }: {
  start: number; end: number; current: number; history: PersonalRecordHistory[]; points: { t: number; w: number }[];
}) {
  const W = 340, H = 220, L = 30, R = 6, T = 14, B = 26;
  // Escalones del récord dentro del periodo
  const steps: { t: number; w: number; pr: boolean }[] = [];
  const startVal = recordAt(history, start, current);
  if (startVal != null) steps.push({ t: start, w: startVal, pr: false });
  for (const h of history) {
    const t = new Date(h.changed_at).getTime();
    if (t > start && t <= end) steps.push({ t, w: Number(h.new_weight), pr: true });
  }
  if (!steps.length) steps.push({ t: start, w: current, pr: false });

  const values = [...steps.map((s) => s.w), ...points.map((p) => p.w), current];
  let min = Math.min(...values), max = Math.max(...values);
  const pad = Math.max(2.5, (max - min) * 0.15);
  min = Math.floor((min - pad) / 2.5) * 2.5;
  max = Math.ceil((max + pad) / 2.5) * 2.5;
  const x = (t: number) => L + ((t - start) / Math.max(1, end - start)) * (W - L - R);
  const y = (w: number) => T + (1 - (w - min) / Math.max(1, max - min)) * (H - T - B);

  let path = `M${x(steps[0].t)},${y(steps[0].w)}`;
  for (let i = 1; i < steps.length; i++) path += ` H${x(steps[i].t)} V${y(steps[i].w)}`;
  path += ` H${x(end)}`;
  const estPath = points.length > 1 ? points.map((p, i) => `${i ? "L" : "M"}${x(p.t)},${y(p.w)}`).join(" ") : "";

  const ticks = [0, 1, 2, 3].map((i) => min + ((max - min) * i) / 3);
  const months: { t: number; label: string }[] = [];
  const d = new Date(start); d.setDate(1); d.setMonth(d.getMonth() + 1); d.setHours(0, 0, 0, 0);
  const stepMonths = Math.max(1, Math.ceil((end - start) / (86400000 * 30) / 4));
  while (d.getTime() < end) {
    months.push({ t: d.getTime(), label: MONTH_ABBR[d.getMonth()] });
    d.setMonth(d.getMonth() + stepMonths);
  }
  const lastPr = [...steps].reverse().find((s) => s.pr);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img"
      aria-label={`Gráfico: récord de ${kg(steps[0].w)} a ${kg(current)} kg${points.length ? `; 1RM estimado de los entrenos entre ${kg(Math.min(...points.map((p) => p.w)))} y ${kg(Math.max(...points.map((p) => p.w)))} kg` : ""}`}>
      {ticks.map((v) => (
        <g key={v}>
          <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="rgba(255,255,255,0.07)" />
          <text x={0} y={y(v) + 4} fontSize="11" fill="#99968E">{Math.round(v)}</text>
        </g>
      ))}
      {months.map((m) => (
        <text key={m.t} x={x(m.t)} y={H - 6} fontSize="11" fill="#99968E" textAnchor="middle">{m.label}</text>
      ))}
      {estPath && <path d={estPath} fill="none" stroke="#E8DDC8" strokeWidth="1.5" strokeDasharray="4 4" opacity="0.45" />}
      {points.map((p, i) => (
        <circle key={i} cx={x(p.t)} cy={y(p.w)} r="4" fill="#080807" stroke="#E8DDC8" strokeWidth="2" opacity="0.85" />
      ))}
      <path d={path} fill="none" stroke="#C8B38A" strokeWidth="3" strokeLinejoin="round" />
      {steps.filter((s) => s.pr).map((s, i) => (
        <circle key={i} cx={x(s.t)} cy={y(s.w)} r="6" fill="#C8B38A" />
      ))}
      {lastPr && (
        <text x={Math.min(x(lastPr.t), W - 60)} y={Math.max(12, y(lastPr.w) - 10)} fontSize="15" fontWeight="800" fill="#E8DDC8" style={font}>
          PR {kg(lastPr.w)}
        </text>
      )}
    </svg>
  );
}

/** Línea pequeña para la lista de récords. */
export function TrendSpark({ values, up }: { values: number[]; up: boolean }) {
  if (values.length < 2) return <span className="w-[70px] shrink-0" />;
  const min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
  const pts = values.map((v, i) => `${(2 + (i / (values.length - 1)) * 66).toFixed(1)},${(27 - ((v - min) / span) * 22).toFixed(1)}`).join(" ");
  return (
    <svg width="70" height="30" viewBox="0 0 70 30" aria-hidden className="shrink-0">
      <polyline points={pts} fill="none" stroke={up ? "#C8B38A" : "#99968E"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
