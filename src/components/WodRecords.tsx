import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Timer,
  Plus,
  X,
  ChevronRight,
  Trash2,
  Share2,
  Trophy,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import {
  useWodResults,
  useSaveWodResult,
  useDeleteWodResult,
  summarizeWods,
  type WodResult,
  type WodSummary,
} from "@/lib/wod-store";
import {
  fmtSeconds,
  formatScore,
  formatDelta,
  parseClockInput,
  scoreValue,
  slugifyWod,
  SCALE_LABEL,
  WOD_TYPE_LABEL,
  type WodScale,
  type WodType,
} from "@/lib/wod";
import { useCreatePost } from "@/lib/social";

const TYPES: WodType[] = ["for_time", "amrap", "emom", "max_reps", "max_calories", "max_distance"];
const SCALES: WodScale[] = ["rx", "scaled", "custom"];

export function WodRecords({ focusSlug }: { focusSlug?: string }) {
  const { data: results = [], isLoading } = useWodResults();
  const summaries = useMemo(() => summarizeWods(results), [results]);
  const [q, setQ] = useState("");
  const [openSlug, setOpenSlug] = useState<string | null>(focusSlug ?? null);
  const [showAdd, setShowAdd] = useState(false);

  const visible = summaries.filter((s) =>
    q.trim() ? s.name.toLowerCase().includes(q.trim().toLowerCase()) : true,
  );
  const detail = summaries.find((s) => s.slug === openSlug) ?? null;

  return (
    <>
      <div className="rise rise-2 mb-4 flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar WOD…"
          className="flex-1 rounded-2xl border border-border bg-surface-2 px-3.5 py-2.5 text-sm outline-none focus:border-foreground/40"
        />
        <button
          onClick={() => setShowAdd(true)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-2xl bg-foreground px-4 py-2.5 text-sm font-medium text-background"
        >
          <Plus className="h-4 w-4" /> Registrar
        </button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : visible.length === 0 ? (
        <div className="card-elevated p-10 text-center">
          <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-border">
            <Timer className="h-5 w-5" strokeWidth={1.5} />
          </div>
          <h2 className="text-lg font-semibold">Sin WOD PRs todavía</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Los WODs por tiempo que completes en tu entreno se registran aquí automáticamente.
          </p>
        </div>
      ) : (
        <ul className="rise rise-3 card-elevated divide-y divide-border overflow-hidden p-0">
          {visible.map((s) => (
            <li key={s.slug}>
              <button
                onClick={() => setOpenSlug(s.slug)}
                className="flex w-full items-center gap-3 px-5 py-4 text-left"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                    {s.name}
                  </div>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-2xl font-semibold leading-none tabular">
                      {s.best ? formatScore(s.best) : "—"}
                    </span>
                    <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold tracking-wide">
                      {WOD_TYPE_LABEL[s.type]}
                    </span>
                    {s.best && (
                      <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold tracking-wide">
                        {SCALE_LABEL[s.best.scale]}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    {s.attempts} {s.attempts === 1 ? "intento" : "intentos"} ·{" "}
                    {new Date(s.last!.performed_on).toLocaleDateString(undefined, {
                      day: "numeric",
                      month: "long",
                    })}
                  </div>
                </div>
                <WodSparkline summary={s} />
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.5} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {detail && <WodDetailModal summary={detail} onClose={() => setOpenSlug(null)} />}
      {showAdd && <ManualWodForm onClose={() => setShowAdd(false)} />}
    </>
  );
}

function WodSparkline({ summary }: { summary: WodSummary }) {
  const points = summary.results
    .map((r) => scoreValue(r))
    .filter((v): v is number => v != null);
  if (points.length < 2) return <div className="h-8 w-16 shrink-0" />;
  const invert = summary.type === "for_time";
  const vals = invert ? points.map((p) => -p) : points;
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const w = 64;
  const h = 28;
  const d = vals
    .map((p, i) => {
      const x = (i / (vals.length - 1)) * (w - 4) + 2;
      const y = h - 3 - ((p - min) / span) * (h - 6);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg width={w} height={h} className="shrink-0" aria-hidden="true">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.85" />
    </svg>
  );
}

function WodDetailModal({ summary, onClose }: { summary: WodSummary; onClose: () => void }) {
  const del = useDeleteWodResult();
  const createPost = useCreatePost();
  const history = [...summary.results].reverse();
  const improvement =
    summary.best && summary.first && summary.best.id !== summary.first.id
      ? formatDelta(summary.type, summary.best, summary.first)
      : null;

  const chartData = summary.results
    .map((r) => ({ r, v: scoreValue(r) }))
    .filter((x) => x.v != null)
    .map((x) => ({
      date: new Date(x.r.performed_on).toLocaleDateString(undefined, {
        day: "2-digit",
        month: "short",
      }),
      value: summary.type === "for_time" ? x.v! : x.v! / (summary.type === "amrap" || summary.type === "emom" ? 1000 : 1),
      label: formatScore(x.r),
    }));

  async function share() {
    if (!summary.best) return;
    try {
      await createPost.mutateAsync({
        kind: "wod",
        caption: `Nuevo PR en ${summary.name} · ${formatScore(summary.best)} ${SCALE_LABEL[summary.best.scale]} #wodpr`,
        data: {
          wod_name: summary.name,
          wod_type: summary.type,
          scale: summary.best.scale,
          score: formatScore(summary.best),
          time_seconds: summary.best.time_seconds,
          rounds: summary.best.rounds,
          reps: summary.best.reps,
          is_pr: true,
        },
      });
      toast.success("Compartido en tu feed");
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo compartir");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 sm:items-center" onClick={onClose}>
      <div
        className="card-elevated animate-fade max-h-[88vh] w-full max-w-md overflow-auto rounded-b-none p-5 sm:rounded-b-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
              {WOD_TYPE_LABEL[summary.type]} · Evolución
            </p>
            <h2 className="mt-1.5 truncate text-xl font-semibold tracking-tight">{summary.name}</h2>
          </div>
          <button onClick={onClose} className="shrink-0 rounded-full border border-border p-2 text-muted-foreground" aria-label="Cerrar">
            <X className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>

        <div className="mb-5 grid grid-cols-3 gap-2">
          <Stat label="Mejor" value={summary.best ? formatScore(summary.best) : "—"} />
          <Stat label="Último" value={summary.last ? formatScore(summary.last) : "—"} />
          <Stat label="Intentos" value={String(summary.attempts)} />
        </div>
        {(summary.bestRx || summary.bestScaled) && (
          <div className="mb-5 grid grid-cols-2 gap-2">
            <Stat label="Mejor RX" value={summary.bestRx ? formatScore(summary.bestRx) : "—"} />
            <Stat label="Mejor Scaled" value={summary.bestScaled ? formatScore(summary.bestScaled) : "—"} />
          </div>
        )}
        {improvement && (
          <p className="mb-5 text-xs text-muted-foreground">
            Mejora desde el primer intento: <span className="font-semibold text-foreground">{improvement}</span>
          </p>
        )}

        {chartData.length >= 2 && (
          <div className="mb-5 rounded-2xl border border-border p-4">
            <p className="mb-3 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Progresión</p>
            <div className="h-40 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" stroke="var(--muted-foreground)" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
                  <YAxis
                    reversed={summary.type === "for_time"}
                    stroke="var(--muted-foreground)"
                    tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                    tickLine={false}
                    axisLine={false}
                    width={44}
                    tickFormatter={(v: number) => (summary.type === "for_time" ? fmtSeconds(v) : String(Math.round(v * 10) / 10))}
                  />
                  <Tooltip
                    contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12, color: "var(--foreground)" }}
                    labelStyle={{ color: "var(--muted-foreground)" }}
                    formatter={(_v: number, _n, item: any) => [item?.payload?.label ?? "", "Score"]}
                  />
                  <Line type="monotone" dataKey="value" stroke="currentColor" strokeWidth={2} dot={{ r: 2.5, fill: "currentColor", strokeWidth: 0 }} activeDot={{ r: 4.5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        <button
          onClick={share}
          disabled={createPost.isPending || !summary.best}
          className="mb-5 flex w-full items-center justify-center gap-2 rounded-2xl border border-border py-3 text-sm font-medium disabled:opacity-50"
        >
          <Share2 className="h-4 w-4" /> Compartir mejor marca
        </button>

        <ul className="space-y-2">
          {history.map((r) => (
            <li key={r.id} className="rounded-2xl border border-border p-3.5">
              <div className="flex items-center justify-between gap-3">
                <div className="text-[11px] text-muted-foreground">
                  {new Date(r.performed_on).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" })}
                  {r.month_key ? ` · ${r.month_key} S${r.week} ${r.day_key}` : " · Manual"}
                </div>
                <button
                  onClick={async () => {
                    if (!window.confirm("¿Eliminar este registro?")) return;
                    await del.mutateAsync(r.id);
                    toast.success("Eliminado");
                  }}
                  className="rounded-lg p-1.5 text-muted-foreground hover:text-destructive"
                  aria-label="Eliminar"
                >
                  <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                </button>
              </div>
              <div className="mt-2 flex items-center gap-2 text-sm">
                <span className="font-semibold tabular">{formatScore(r)}</span>
                <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold">{SCALE_LABEL[r.scale]}</span>
                {r.is_pr && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide">
                    <Trophy className="h-3 w-3" /> PR
                  </span>
                )}
              </div>
              {r.notes && <p className="mt-2 text-xs text-muted-foreground">{r.notes}</p>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border p-3 text-center">
      <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold tabular">{value}</p>
    </div>
  );
}

function ManualWodForm({ onClose }: { onClose: () => void }) {
  const save = useSaveWodResult();
  const [name, setName] = useState("");
  const [type, setType] = useState<WodType>("for_time");
  const [scale, setScale] = useState<WodScale>("rx");
  const [cap, setCap] = useState(false);
  const [time, setTime] = useState("");
  const [rounds, setRounds] = useState("");
  const [reps, setReps] = useState("");
  const [notes, setNotes] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return toast.error("Escribe el nombre del WOD");
    try {
      const out = await save.mutateAsync({
        wod_slug: slugifyWod(`${name.trim()}-${type}`),
        wod_name: name.trim(),
        wod_type: type,
        scale,
        status: cap ? "cap" : "completed",
        time_seconds: parseClockInput(time),
        rounds: rounds ? Number(rounds) : null,
        reps: type === "max_calories" || type === "max_distance" ? null : reps ? Number(reps) : null,
        calories: type === "max_calories" && reps ? Number(reps) : null,
        distance: type === "max_distance" && reps ? Number(reps) : null,
        notes: notes || null,
        source: "manual",
      });
      toast.success(out.kind === "pr" ? "¡Nuevo PR de WOD!" : "Resultado guardado");
      onClose();
    } catch (err: any) {
      toast.error(err?.message ?? "Error al guardar");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 sm:items-center" onClick={onClose}>
      <form
        onSubmit={submit}
        className="card-elevated animate-fade max-h-[88vh] w-full max-w-md space-y-4 overflow-auto rounded-b-none p-5 sm:rounded-b-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold">Registrar resultado de WOD</h2>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nombre del WOD (ej. Fran)"
          maxLength={60}
          className="w-full rounded-xl border border-border bg-surface-2 px-3.5 py-2.5 text-sm outline-none focus:border-foreground/40"
        />
        <div className="flex flex-wrap gap-2">
          {TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`rounded-xl border px-3 py-1.5 text-[11px] font-semibold transition ${
                type === t ? "border-transparent bg-foreground text-background" : "border-border text-muted-foreground"
              }`}
            >
              {WOD_TYPE_LABEL[t]}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          {SCALES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setScale(s)}
              className={`flex-1 rounded-xl border px-2 py-2 text-xs font-semibold transition ${
                scale === s ? "border-transparent bg-foreground text-background" : "border-border text-muted-foreground"
              }`}
            >
              {SCALE_LABEL[s]}
            </button>
          ))}
        </div>
        <WodScoreFields
          type={type}
          cap={cap}
          setCap={setCap}
          time={time}
          setTime={setTime}
          rounds={rounds}
          setRounds={setRounds}
          reps={reps}
          setReps={setReps}
        />
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Notas…"
          className="w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-foreground/40"
        />
        <div className="flex gap-2">
          <button type="submit" disabled={save.isPending} className="flex-1 rounded-2xl bg-foreground py-3 text-sm font-medium text-background">
            Guardar
          </button>
          <button type="button" onClick={onClose} className="rounded-2xl border border-border px-5 py-3 text-sm">
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}

/** Campos de score compartidos entre el entreno y el registro manual. */
export function WodScoreFields({
  type, cap, setCap, time, setTime, rounds, setRounds, reps, setReps,
}: {
  type: WodType;
  cap: boolean;
  setCap: (v: boolean) => void;
  time: string;
  setTime: (v: string) => void;
  rounds: string;
  setRounds: (v: string) => void;
  reps: string;
  setReps: (v: string) => void;
}) {
  const isTime = type === "for_time";
  const isRounds = type === "amrap" || type === "emom";
  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input type="checkbox" checked={cap} onChange={(e) => setCap(e.target.checked)} />
        No terminado (Time Cap / DNF)
      </label>
      <div className="grid grid-cols-2 gap-3">
        {(isTime || cap) && (
          <SmallField label={cap ? "Tiempo alcanzado" : "Tiempo (mm:ss)"} value={time} onChange={setTime} placeholder="9:42" />
        )}
        {(isRounds || cap) && (
          <SmallField label="Rondas" value={rounds} onChange={setRounds} placeholder="8" />
        )}
        {(isRounds || cap || type === "max_reps") && (
          <SmallField label="Reps" value={reps} onChange={setReps} placeholder="12" />
        )}
        {type === "max_calories" && <SmallField label="Calorías" value={reps} onChange={setReps} placeholder="120" />}
        {type === "max_distance" && <SmallField label="Metros" value={reps} onChange={setReps} placeholder="1200" />}
      </div>
    </div>
  );
}

function SmallField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <input
        value={value}
        inputMode="numeric"
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm tabular outline-none focus:border-foreground/40"
      />
    </label>
  );
}
