import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useMemo, useState, useEffect, useRef } from "react";
import { toast } from "sonner";
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
  User,
  Ruler,
  Activity,
  Dumbbell,
  CalendarCheck,
  HeartPulse,
  Target,
  Award,
  FileText,
  Shield,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Trash2,
  Plus,
  Camera,
} from "lucide-react";
import { usePlanning, useAllResults, usePersonalRecords } from "@/lib/store";
import {
  useAthleteProfile,
  useSaveAthleteProfile,
  useBodyMetrics,
  useAddBodyMetric,
  useDeleteBodyMetric,
  useWellnessLogs,
  useSaveWellness,
  useDeleteWellness,
  useGoals,
  useSaveGoal,
  useDeleteGoal,
  useMilestones,
  useSyncMilestones,
  useAllPrHistory,
  exportAllData,
  wipeAllHistory,
  type AthleteGoal,
} from "@/lib/profile-store";
import {
  RANGES,
  type RangeKey,
  windowStats,
  streaks,
  sessionDays,
  plannedTrainingDays,

  exerciseStats,
  progressionInsights,
  bodyChange,
  wellnessAverages,
  monthlyReport,
  computeMilestones,
  trendOf,
  fmtKg,
  fmtNum,
  type Trend,
} from "@/lib/analytics";

import { planningCompletion } from "@/lib/session-progress";
import { sameExercise } from "@/lib/rm-matcher";
export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Mi perfil de atleta — RM OR DIE" },
      {
        name: "description",
        content:
          "Perfil, datos corporales, progreso, fuerza, constancia, objetivos e informes mensuales calculados con tus entrenamientos reales.",
      },
      { property: "og:title", content: "Mi perfil de atleta — RM OR DIE" },
      {
        property: "og:description",
        content: "Seguimiento inteligente del atleta con datos reales de entrenamiento.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProfilePage,
});

const SECTIONS = [
  { key: "profile", label: "Perfil", icon: User },
  { key: "body", label: "Cuerpo", icon: Ruler },
  { key: "progress", label: "Progreso", icon: Activity },
  { key: "performance", label: "Rendimiento", icon: Activity },
  { key: "strength", label: "Fuerza", icon: Dumbbell },
  { key: "consistency", label: "Constancia", icon: CalendarCheck },
  { key: "recovery", label: "Recovery", icon: HeartPulse },
  { key: "goals", label: "Objetivos", icon: Target },
  { key: "milestones", label: "Hitos", icon: Award },
  { key: "report", label: "Informe", icon: FileText },
  { key: "data", label: "Datos", icon: Shield },
] as const;

type SectionKey = (typeof SECTIONS)[number]["key"];

const GOAL_OPTIONS = [
  "Fuerza",
  "Rendimiento",
  "CrossFit general",
  "Competición",
  "Hipertrofia",
  "Pérdida de grasa",
  "Resistencia",
  "Técnica",
  "Movilidad",
];

const LEVELS = ["Principiante", "Intermedio", "Avanzado", "Competidor"];

function ProfilePage() {
  const [section, setSection] = useState<SectionKey>("profile");
  const [range, setRange] = useState<RangeKey>("12w");

  const { data: planning } = usePlanning();
  const { data: results = [] } = useAllResults();
  const { data: records = [] } = usePersonalRecords();
  const { data: history = [] } = useAllPrHistory();
  const { data: profile } = useAthleteProfile();
  const { data: metrics = [] } = useBodyMetrics();
  const { data: wellness = [] } = useWellnessLogs();

  const days = RANGES.find((r) => r.key === range)!.days;
  const rangeLabel = RANGES.find((r) => r.key === range)!.label;

  return (
    <AppShell>
      <header className="rise rise-1 mb-5">
        <p className="eyebrow">Mi perfil</p>
        <h1 className="mt-2 text-[32px] font-semibold leading-none tracking-tight">
          {profile?.display_name || "Atleta"}
        </h1>
      </header>

      <div className="rise rise-2 -mx-5 mb-6 overflow-x-auto px-5 no-scrollbar">
        <div className="flex gap-2">
          {SECTIONS.map((s) => {
            const active = section === s.key;
            return (
              <button
                key={s.key}
                onClick={() => setSection(s.key)}
                className={`whitespace-nowrap rounded-2xl border px-4 py-2 text-xs font-semibold transition ${
                  active
                    ? "border-transparent gold-gradient"
                    : "border-border text-muted-foreground"
                }`}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      {section === "profile" && <ProfileForm />}
      {section === "body" && <BodySection />}
      {section === "progress" && (
        <ProgressSection
          results={results}
          history={history}
          metrics={metrics}
          plannedDays={plannedTrainingDays(planning?.data)}
          completedSessions={planningCompletion(planning?.data, results).completed}

        />
      )}
      {(section === "performance" || section === "strength" || section === "recovery") && (
        <RangePicker range={range} setRange={setRange} />
      )}
      {section === "performance" && (
        <PerformanceSection
          results={results}
          history={history}
          records={records}
          bodyWeight={profile?.current_weight_kg ?? null}
          days={days}
          rangeLabel={rangeLabel}
        />
      )}
      {section === "strength" && (
        <StrengthSection
          records={records}
          history={history}
          days={days}
          bodyWeight={profile?.current_weight_kg ?? null}
        />
      )}
      {section === "consistency" && (
        <ConsistencySection results={results} plannedDays={plannedTrainingDays(planning?.data)} completedSessions={planningCompletion(planning?.data, results).completed} weeklyTarget={profile?.weekly_target ?? null} />
      )}
      {section === "recovery" && <RecoverySection logs={wellness} results={results} days={days} />}
      {section === "goals" && <GoalsSection records={records} results={results} metrics={metrics} />}
      {section === "milestones" && <MilestonesSection results={results} history={history} />}
      {section === "report" && <ReportSection results={results} history={history} metrics={metrics} records={records} />}
      {section === "data" && <DataSection />}
    </AppShell>
  );
}

/* ---------------- shared UI ---------------- */

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`card-elevated p-5 ${className}`}>{children}</section>;
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-[22px] border border-border bg-surface p-4">
      <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
      <div className="mt-2 text-2xl font-semibold tabular tracking-tight">{value}</div>
      {sub && <div className="mt-1 text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

function Empty({ text = "Aún no hay suficientes datos." }: { text?: string }) {
  return (
    <div className="rounded-[22px] border border-dashed border-border p-6 text-center">
      <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Not enough data</p>
      <p className="mt-2 text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

function TrendIcon({ trend }: { trend: Trend }) {
  if (trend === "up") return <ArrowUpRight className="h-4 w-4" />;
  if (trend === "down") return <ArrowDownRight className="h-4 w-4" />;
  return <Minus className="h-4 w-4" />;
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

const inputCls =
  "w-full rounded-xl border border-border bg-surface-2 px-3.5 py-2.5 text-sm text-foreground outline-none focus:border-foreground/40";

function RangePicker({ range, setRange }: { range: RangeKey; setRange: (r: RangeKey) => void }) {
  return (
    <div className="mb-4 flex gap-1 overflow-x-auto rounded-2xl border border-border bg-surface p-1">
      {RANGES.map((r) => (
        <button
          key={r.key}
          onClick={() => setRange(r.key)}
          className={`flex-1 whitespace-nowrap rounded-xl px-3 py-2 text-xs font-semibold transition ${
            range === r.key ? "gold-gradient" : "text-muted-foreground"
          }`}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}

function MonoChart({ data, dataKey = "value" }: { data: { label: string; value: number }[]; dataKey?: string }) {
  if (data.length < 2) return <Empty text="Necesitas al menos dos registros para ver la evolución." />;
  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid stroke="#E4E4E4" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#6F6F6F" }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 10, fill: "#6F6F6F" }} tickLine={false} axisLine={false} width={44} domain={["auto", "auto"]} />
          <Tooltip
            contentStyle={{ background: "#101114", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 14, color: "#FFFFFF", fontSize: 12 }}
            labelStyle={{ color: "#B8B8B8" }}
          />
          <Line type="monotone" dataKey={dataKey} stroke="var(--gold)" strokeWidth={2} dot={{ r: 2.5, fill: "var(--gold)" }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ---------------- 1. Profile ---------------- */

function ProfileForm() {
  const { data: profile } = useAthleteProfile();
  const save = useSaveAthleteProfile();
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<Record<string, any>>({});

  useEffect(() => {
    if (profile) setForm({ ...profile, goals: profile.goals ?? [] });
  }, [profile?.id, profile?.updated_at]);

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));
  const goals: string[] = form.goals ?? [];

  async function onAvatar(file: File) {
    if (!file.type.startsWith("image/") && !/\.(jpe?g|png|webp|heic|heif|gif)$/i.test(file.name)) {
      return toast.error("Selecciona una imagen");
    }
    let dataUrl: string;
    try {
      dataUrl = await resizeImage(file, 320);
    } catch {
      return toast.error("No se ha podido leer la imagen. Prueba con una foto JPG o PNG.");
    }
    set("avatar_url", dataUrl);
    try {
      await save.mutateAsync({ avatar_url: dataUrl } as any);
      toast.success("Foto actualizada");
    } catch (e: any) {
      toast.error(e?.message ?? "No se ha podido guardar la foto");
    }
  }

  async function onSave() {
    try {
      await save.mutateAsync({
        display_name: form.display_name ?? null,
        avatar_url: form.avatar_url ?? null,
        birth_date: form.birth_date || null,
        sex: form.sex || null,
        height_cm: num(form.height_cm),
        current_weight_kg: num(form.current_weight_kg),
        target_weight_kg: num(form.target_weight_kg),
        crossfit_start_date: form.crossfit_start_date || null,
        box_name: form.box_name || null,
        level: form.level || null,
        weekly_target: num(form.weekly_target),
        goals,
      } as any);
      toast.success("Perfil guardado");
    } catch (e: any) {
      toast.error(e?.message ?? "Error al guardar");
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-center gap-4">
          <button
            onClick={() => fileRef.current?.click()}
            className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-[24px]"
            style={{ background: "linear-gradient(140deg,#EBD6A6,#D8B46B)", color: "#0A0A0B" }}
          >
            {form.avatar_url ? (
              <img src={form.avatar_url} alt="Foto de perfil" className="h-full w-full object-cover" />
            ) : (
              <Camera className="h-5 w-5" />
            )}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && onAvatar(e.target.files[0])}
          />
          <div className="min-w-0 flex-1">
            <Field label="Nombre">
              <input className={inputCls} value={form.display_name ?? ""} onChange={(e) => set("display_name", e.target.value)} maxLength={60} />
            </Field>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <Field label="Nacimiento">
            <input type="date" className={inputCls} value={form.birth_date ?? ""} onChange={(e) => set("birth_date", e.target.value)} />
          </Field>
          <Field label="Sexo">
            <select className={inputCls} value={form.sex ?? ""} onChange={(e) => set("sex", e.target.value)}>
              <option value="">—</option>
              <option value="M">Hombre</option>
              <option value="F">Mujer</option>
              <option value="X">Otro</option>
            </select>
          </Field>
          <Field label="Altura (cm)">
            <input inputMode="decimal" className={inputCls} value={form.height_cm ?? ""} onChange={(e) => set("height_cm", e.target.value)} />
          </Field>
          <Field label="Peso actual (kg)">
            <input inputMode="decimal" className={inputCls} value={form.current_weight_kg ?? ""} onChange={(e) => set("current_weight_kg", e.target.value)} />
          </Field>
          <Field label="Peso objetivo (kg)">
            <input inputMode="decimal" className={inputCls} value={form.target_weight_kg ?? ""} onChange={(e) => set("target_weight_kg", e.target.value)} />
          </Field>
          <Field label="Inicio en CrossFit">
            <input type="date" className={inputCls} value={form.crossfit_start_date ?? ""} onChange={(e) => set("crossfit_start_date", e.target.value)} />
          </Field>
          <Field label="Box">
            <input className={inputCls} value={form.box_name ?? ""} onChange={(e) => set("box_name", e.target.value)} maxLength={60} />
          </Field>
          <Field label="Nivel">
            <select className={inputCls} value={form.level ?? ""} onChange={(e) => set("level", e.target.value)}>
              <option value="">—</option>
              {LEVELS.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </Field>
          <Field label="Sesiones/semana">
            <input inputMode="numeric" className={inputCls} value={form.weekly_target ?? ""} onChange={(e) => set("weekly_target", e.target.value)} />
          </Field>
        </div>

        <div className="mt-5">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Objetivos principales</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {GOAL_OPTIONS.map((g) => {
              const active = goals.includes(g);
              return (
                <button
                  key={g}
                  onClick={() => set("goals", active ? goals.filter((x) => x !== g) : [...goals, g])}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                    active ? "border-transparent gold-gradient" : "border-border text-muted-foreground"
                  }`}
                >
                  {g}
                </button>
              );
            })}
          </div>
        </div>

        <button
          onClick={onSave}
          disabled={save.isPending}
          className="mt-6 w-full rounded-[18px] gold-gradient py-3 text-sm font-semibold transition active:scale-[0.99]"
        >
          {save.isPending ? "Guardando…" : "Guardar perfil"}
        </button>
      </Card>
    </div>
  );
}

function num(v: any): number | null {
  if (v === "" || v == null) return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

async function decodeImage(file: File): Promise<{ width: number; height: number; source: CanvasImageSource }> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" } as any);
      return { width: bitmap.width, height: bitmap.height, source: bitmap };
    } catch {
      /* algunos formatos (HEIC, progresivos) fallan aquí: usamos <img> */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("decode_failed"));
      el.src = url;
    });
    return { width: img.naturalWidth, height: img.naturalHeight, source: img };
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

async function resizeImage(file: File, max: number): Promise<string> {
  const { width, height, source } = await decodeImage(file);
  if (!width || !height) throw new Error("decode_failed");
  const scale = Math.min(1, max / Math.max(width, height));
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(source, 0, 0, w, h);
  let quality = 0.82;
  let out = canvas.toDataURL("image/jpeg", quality);
  while (out.length > 300_000 && quality > 0.4) {
    quality -= 0.12;
    out = canvas.toDataURL("image/jpeg", quality);
  }
  if (!out.startsWith("data:image/")) throw new Error("encode_failed");
  return out;
}

/* ---------------- 2. Body data ---------------- */

const BODY_FIELDS: { key: string; label: string; unit: string }[] = [
  { key: "weight_kg", label: "Peso", unit: "kg" },
  { key: "body_fat_pct", label: "% grasa", unit: "%" },
  { key: "muscle_mass_kg", label: "Masa muscular", unit: "kg" },
  { key: "waist_cm", label: "Cintura", unit: "cm" },
  { key: "chest_cm", label: "Pecho", unit: "cm" },
  { key: "hip_cm", label: "Cadera", unit: "cm" },
  { key: "arm_cm", label: "Brazo", unit: "cm" },
  { key: "thigh_cm", label: "Muslo", unit: "cm" },
];

function BodySection() {
  const { data: metrics = [] } = useBodyMetrics();
  const add = useAddBodyMetric();
  const del = useDeleteBodyMetric();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({ measured_on: new Date().toISOString().slice(0, 10) });
  const [metricKey, setMetricKey] = useState("weight_kg");

  const chartData = metrics
    .filter((m) => (m as any)[metricKey] != null)
    .map((m) => ({
      label: new Date(m.measured_on).toLocaleDateString("es-ES", { day: "2-digit", month: "short" }),
      value: Number((m as any)[metricKey]),
    }));

  async function submit() {
    const payload: any = { measured_on: form.measured_on, notes: form.notes || null };
    let any = false;
    for (const f of BODY_FIELDS) {
      const v = num(form[f.key]);
      if (v != null) {
        payload[f.key] = v;
        any = true;
      }
    }
    if (!any) return toast.error("Introduce al menos un valor");
    try {
      await add.mutateAsync(payload);
      setForm({ measured_on: new Date().toISOString().slice(0, 10) });
      setOpen(false);
      toast.success("Registro guardado");
    } catch (e: any) {
      toast.error(e?.message ?? "Error");
    }
  }

  return (
    <div className="space-y-4">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-center gap-2 rounded-[18px] gold-gradient py-3 text-sm font-semibold"
      >
        <Plus className="h-4 w-4" /> Nuevo registro corporal
      </button>

      {open && (
        <Card>
          <Field label="Fecha">
            <input type="date" className={inputCls} value={form.measured_on} onChange={(e) => setForm({ ...form, measured_on: e.target.value })} />
          </Field>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {BODY_FIELDS.map((f) => (
              <Field key={f.key} label={`${f.label} (${f.unit})`}>
                <input inputMode="decimal" className={inputCls} value={form[f.key] ?? ""} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
              </Field>
            ))}
          </div>
          <div className="mt-3">
            <Field label="Notas">
              <input className={inputCls} value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} maxLength={200} />
            </Field>
          </div>
          <button onClick={submit} className="mt-5 w-full rounded-[18px] gold-gradient py-3 text-sm font-semibold">
            Guardar
          </button>
        </Card>
      )}

      <Card>
        <div className="-mx-1 mb-4 flex gap-1 overflow-x-auto no-scrollbar">
          {BODY_FIELDS.map((f) => (
            <button
              key={f.key}
              onClick={() => setMetricKey(f.key)}
              className="whitespace-nowrap rounded-full px-3 py-1.5 text-[11px] font-semibold transition"
              style={
                metricKey === f.key
                  ? { background: "linear-gradient(140deg,#EBD6A6,#D8B46B)", color: "#0A0A0B" }
                  : { background: "#F1F1F1", color: "#6F6F6F" }
              }
            >
              {f.label}
            </button>
          ))}
        </div>
        <MonoChart data={chartData} />
      </Card>

      <div className="space-y-2">
        {metrics.length === 0 && <Empty text="Registra tu primer dato corporal para ver la evolución." />}
        {[...metrics].reverse().map((m) => (
          <div key={m.id} className="flex items-center gap-3 rounded-[22px] border border-border bg-surface p-4">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">
                {new Date(m.measured_on).toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" })}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {BODY_FIELDS.filter((f) => (m as any)[f.key] != null)
                  .map((f) => `${f.label} ${(m as any)[f.key]}${f.unit}`)
                  .join(" · ") || "—"}
              </div>
              {m.notes && <div className="mt-1 text-xs text-muted-foreground">{m.notes}</div>}
            </div>
            <button
              onClick={() => {
                if (window.confirm("¿Eliminar este registro?")) del.mutate(m.id);
              }}
              className="rounded-xl border border-border p-2 text-muted-foreground"
              aria-label="Eliminar registro"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- 3. Progress dashboard ---------------- */

function ProgressSection({ results, history, metrics, plannedDays, completedSessions }: any) {
  const all = windowStats(results, history, null);
  const last4 = windowStats(results, history, 28);
  const s = streaks(results);
  const body = bodyChange(metrics);
  const completion = plannedDays ? Math.min(100, Math.round((completedSessions / plannedDays) * 100)) : null;

  if (all.sessions === 0 && metrics.length === 0) {
    return <Empty text="Registra entrenamientos y datos corporales para activar tu dashboard." />;
  }

  return (
    <div className="space-y-3">
      <Card>
        <p className="text-[11px] uppercase tracking-[0.24em]" style={{ color: "#6F6F6F" }}>
          Peso actual
        </p>
        <div className="mt-2 text-[54px] font-semibold leading-none tabular tracking-tight">
          {body.current != null ? fmtNum(body.current) : "—"}
          <span className="text-lg"> kg</span>
        </div>
        <p className="mt-2 text-xs" style={{ color: "#6F6F6F" }}>
          {body.change != null
            ? `${body.change >= 0 ? "+" : ""}${fmtNum(body.change)} kg desde tu primer registro`
            : "Sin cambios registrados todavía"}
        </p>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Stat label="Sesiones completas" value={String(completedSessions)} sub={`${all.blocks} bloques`} />
        <Stat label="Cumplimiento" value={completion != null ? `${completion}%` : "—"} sub={plannedDays ? `de ${plannedDays} días` : undefined} />
        <Stat label="Racha actual" value={`${s.current} d`} />
        <Stat label="Racha máxima" value={`${s.best} d`} />
        <Stat label="PRs" value={String(history.length)} />
        <Stat label="Volumen total" value={all.volume ? `${Math.round(all.volume).toLocaleString("es-ES")} kg` : "—"} />
        <Stat label="Vol. 4 sem" value={last4.volume ? `${Math.round(last4.volume).toLocaleString("es-ES")} kg` : "—"} />
        <Stat label="Horas" value={all.hours ? fmtNum(all.hours) : "—"} />
        <Stat label="RPE medio" value={all.avgRpe != null ? fmtNum(all.avgRpe) : "—"} />
        <Stat label="Frec. semanal" value={all.weeklyFreq != null ? fmtNum(all.weeklyFreq) : "—"} sub="sesiones/sem" />
      </div>
    </div>
  );
}

/* ---------------- 4. Performance + Athlete status + Progression ---------------- */

function PerformanceSection({ results, history, records, bodyWeight, days, rangeLabel }: any) {
  const cur = windowStats(results, history, days);
  const prev = windowStats(results, history, days, true);
  const insights = useMemo(
    () => progressionInsights(results, history, records, bodyWeight, days, rangeLabel),
    [results, history, records, bodyWeight, days, rangeLabel],
  );

  const strengthTrend: Trend = (() => {
    const stats = exerciseStats(records, history, days).filter((s) => s.changePct != null);
    if (!stats.length) return "unknown";
    const avg = stats.reduce((a, b) => a + (b.changePct ?? 0), 0) / stats.length;
    return avg > 1 ? "up" : avg < -1 ? "down" : "stable";
  })();

  const statuses: { label: string; trend: Trend; detail: string }[] = [
    { label: "Fuerza", trend: strengthTrend, detail: "Basado en la evolución de tus RM" },
    { label: "Volumen", trend: trendOf(cur.volume, prev.volume, 5), detail: `${Math.round(cur.volume).toLocaleString("es-ES")} kg` },
    { label: "Frecuencia", trend: trendOf(cur.weeklyFreq, prev.weeklyFreq, 8), detail: cur.weeklyFreq != null ? `${fmtNum(cur.weeklyFreq)} ses/sem` : "—" },
    {
      label: "RPE",
      trend: invert(trendOf(cur.avgRpe, prev.avgRpe, 5)),
      detail: cur.avgRpe != null ? fmtNum(cur.avgRpe) : "—",
    },
    { label: "PRs", trend: trendOf(cur.prs, prev.prs, 0), detail: `${cur.prs} en ${rangeLabel}` },
  ];

  if (cur.sessions === 0 && history.length === 0) {
    return <Empty text="Sin entrenamientos registrados en este periodo." />;
  }

  return (
    <div className="space-y-4">
      <Card>
        <p className="text-[11px] uppercase tracking-[0.24em]" style={{ color: "#6F6F6F" }}>
          Athlete status
        </p>
        <div className="mt-4 space-y-3">
          {statuses.map((s) => (
            <div key={s.label} className="flex items-center justify-between gap-3 border-b pb-3 last:border-0 last:pb-0" style={{ borderColor: "rgba(255,255,255,0.10)" }}>
              <div>
                <div className="text-sm font-semibold uppercase tracking-[0.1em]">{s.label}</div>
                <div className="text-[11px]" style={{ color: "#6F6F6F" }}>{s.detail}</div>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-semibold">
                <TrendIcon trend={s.trend} />
                {trendWord(s.trend)}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Stat label="Sesiones" value={String(cur.sessions)} sub={`antes: ${prev.sessions}`} />
        <Stat label="Volumen" value={`${Math.round(cur.volume).toLocaleString("es-ES")} kg`} sub={`antes: ${Math.round(prev.volume).toLocaleString("es-ES")} kg`} />
        <Stat label="RPE medio" value={cur.avgRpe != null ? fmtNum(cur.avgRpe) : "—"} sub={prev.avgRpe != null ? `antes: ${fmtNum(prev.avgRpe)}` : undefined} />
        <Stat label="Horas" value={fmtNum(cur.hours)} />
      </div>

      <div>
        <p className="mb-2 text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Progression</p>
        {insights.length === 0 ? (
          <Empty text="Necesitas más historial para detectar tendencias." />
        ) : (
          <div className="space-y-2">
            {insights.map((i, idx) => (
              <div key={idx} className="flex items-start gap-3 rounded-[22px] border border-border bg-surface p-4">
                <span className="mt-0.5 text-foreground"><TrendIcon trend={i.trend} /></span>
                <p className="text-sm">{i.text}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function invert(t: Trend): Trend {
  return t === "up" ? "down" : t === "down" ? "up" : t;
}
function trendWord(t: Trend) {
  return t === "up" ? "Improving" : t === "down" ? "Down" : t === "stable" ? "Stable" : "No data";
}

/* ---------------- 5-7. Strength ---------------- */

function StrengthSection({ records, history, days, bodyWeight }: any) {
  const stats = useMemo(() => exerciseStats(records, history, days), [records, history, days]);
  const [openEx, setOpenEx] = useState<string | null>(null);

  if (stats.length === 0) return <Empty text="Registra tus RM para ver el análisis de fuerza." />;

  return (
    <div className="space-y-3">
      {stats.map((s) => {
        const open = openEx === s.exercise;
        const rel = bodyWeight && s.currentPr ? s.currentPr / bodyWeight : null;
        return (
          <Card key={s.exercise}>
            <button className="w-full text-left" onClick={() => setOpenEx(open ? null : s.exercise)}>
              <div className="flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-[0.2em]" style={{ color: "#6F6F6F" }}>
                    {s.exercise}
                  </p>
                  <p className="mt-1 text-[40px] font-semibold leading-none tabular tracking-tight">
                    {s.currentPr != null ? fmtNum(s.currentPr, 1) : "—"}
                    <span className="text-base"> kg</span>
                  </p>
                </div>
                <div className="text-right text-[11px]" style={{ color: "#6F6F6F" }}>
                  {s.changePct != null && <div>{s.changePct >= 0 ? "+" : ""}{s.changePct.toFixed(1)}%</div>}
                  <div>{s.updates} registros</div>
                </div>
              </div>
            </button>

            <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-xs" style={{ color: "#6F6F6F" }}>
              <Row label="1RM real" value={s.realOneRm != null ? fmtKg(s.realOneRm) : "—"} />
              <Row
                label="1RM estimado"
                value={s.realOneRm != null ? "—" : s.estimatedOneRm != null ? `≈ ${fmtKg(s.estimatedOneRm, 1)}` : "—"}
              />
              <Row label="Mejor peso" value={fmtKg(s.bestWeight)} />
              <Row label="Último peso" value={fmtKg(s.lastWeight)} />
              <Row
                label="Fuerza relativa"
                value={rel ? `${rel.toFixed(2)}x BW` : "—"}
              />
              <Row
                label="Último PR"
                value={s.lastPrDate ? new Date(s.lastPrDate).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "2-digit" }) : "—"}
              />
            </div>
            {s.realOneRm == null && s.estimatedOneRm != null && (
              <p className="mt-3 text-[11px]" style={{ color: "#6F6F6F" }}>
                Estimado (Epley) a partir de {s.estimatedFrom}. No es un récord real.
              </p>
            )}

            {open && (
              <div className="mt-4">
                <MonoChart
                  data={s.series.map((p) => ({
                    label: new Date(p.date).toLocaleDateString("es-ES", { day: "2-digit", month: "short" }),
                    value: p.weight,
                  }))}
                />
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span>{label}</span>
      <span className="font-semibold" style={{ color: "var(--foreground)" }}>{value}</span>
    </div>
  );
}

/* ---------------- 11. Consistency ---------------- */

function ConsistencySection({ results, plannedDays, completedSessions, weeklyTarget }: any) {
  const days = sessionDays(results);
  const s = streaks(results);
  const stats = windowStats(results, [], null);
  const completion = plannedDays ? Math.min(100, Math.round((completedSessions / plannedDays) * 100)) : null;

  const grid = useMemo(() => {
    const set = new Set(days);
    const cells: { date: string; done: boolean }[] = [];
    for (let i = 83; i >= 0; i--) {
      const d = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10);
      cells.push({ date: d, done: set.has(d) });
    }
    return cells;
  }, [days.join(",")]);

  if (days.length === 0) return <Empty text="Marca entrenamientos como completados para medir tu constancia." />;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Planificados" value={plannedDays ? String(plannedDays) : "—"} />
        <Stat label="Completados" value={String(completedSessions)} />
        <Stat label="Perdidos" value={plannedDays ? String(Math.max(0, plannedDays - completedSessions)) : "—"} />
        <Stat label="Cumplimiento" value={completion != null ? `${completion}%` : "—"} />
        <Stat label="Racha actual" value={`${s.current} d`} />
        <Stat label="Racha máxima" value={`${s.best} d`} />
      </div>
      <Card>
        <p className="text-[11px] uppercase tracking-[0.24em]" style={{ color: "#6F6F6F" }}>
          Últimas 12 semanas
        </p>
        <div className="mt-4 grid grid-cols-[repeat(14,1fr)] gap-1.5">
          {grid.map((c) => (
            <div
              key={c.date}
              title={c.date}
              className="aspect-square rounded-[5px]"
              style={{ background: c.done ? "var(--gold)" : "rgba(255,255,255,0.10)" }}
            />
          ))}
        </div>
        <p className="mt-4 text-xs" style={{ color: "#6F6F6F" }}>
          Media semanal: {stats.weeklyFreq != null ? fmtNum(stats.weeklyFreq) : "—"} sesiones
          {weeklyTarget ? ` · objetivo ${weeklyTarget}` : ""}
        </p>
      </Card>
    </div>
  );
}

/* ---------------- 10. Recovery ---------------- */

const WELLNESS_FIELDS = [
  { key: "energy", label: "Energía" },
  { key: "fatigue", label: "Fatiga" },
  { key: "soreness", label: "Dolor" },
  { key: "mood", label: "Ánimo" },
] as const;

function RecoverySection({ logs, results, days }: any) {
  const save = useSaveWellness();
  const del = useDeleteWellness();
  const [form, setForm] = useState<Record<string, any>>({ logged_on: new Date().toISOString().slice(0, 10) });

  const cur = wellnessAverages(logs, days);
  const all = wellnessAverages(logs, null);
  const curRpe = windowStats(results, [], days).avgRpe;
  const baseRpe = windowStats(results, [], null).avgRpe;

  async function submit() {
    const payload: any = { logged_on: form.logged_on, notes: form.notes || null, sleep_hours: num(form.sleep_hours) };
    for (const f of WELLNESS_FIELDS) payload[f.key] = num(form[f.key]);
    try {
      await save.mutateAsync(payload);
      toast.success("Registro guardado");
      setForm({ logged_on: new Date().toISOString().slice(0, 10) });
    } catch (e: any) {
      toast.error(e?.message ?? "Error");
    }
  }

  const notes: string[] = [];
  if (cur.fatigue != null && all.fatigue != null) {
    if (cur.fatigue > all.fatigue * 1.1) notes.push("Tu fatiga está por encima de tu media habitual.");
    else if (cur.fatigue < all.fatigue * 0.9) notes.push("Tu fatiga está por debajo de tu media habitual.");
    else notes.push("Tu fatiga se mantiene en tu media habitual.");
  }
  if (curRpe != null && baseRpe != null) {
    if (curRpe > baseRpe * 1.05) notes.push("Tu RPE medio ha aumentado respecto a tu histórico.");
    else if (curRpe < baseRpe * 0.95) notes.push("Tu RPE medio ha bajado respecto a tu histórico.");
  }
  if (cur.sleep != null) notes.push(`Duermes una media de ${fmtNum(cur.sleep)} h en este periodo.`);

  return (
    <div className="space-y-4">
      <Card>
        <p className="text-[11px] uppercase tracking-[0.24em]" style={{ color: "#6F6F6F" }}>
          Registro diario
        </p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Field label="Fecha">
            <input type="date" className={inputCls} value={form.logged_on} onChange={(e) => setForm({ ...form, logged_on: e.target.value })} />
          </Field>
          <Field label="Sueño (h)">
            <input inputMode="decimal" className={inputCls} value={form.sleep_hours ?? ""} onChange={(e) => setForm({ ...form, sleep_hours: e.target.value })} />
          </Field>
        </div>
        <div className="mt-3 space-y-3">
          {WELLNESS_FIELDS.map((f) => (
            <div key={f.key}>
              <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.18em]" style={{ color: "#6F6F6F" }}>
                <span>{f.label}</span>
                <span>{form[f.key] ?? "—"}/10</span>
              </div>
              <input
                type="range"
                min={1}
                max={10}
                value={form[f.key] ?? 5}
                onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                className="mt-2 w-full accent-black"
              />
            </div>
          ))}
        </div>
        <Field label="Notas">
          <input className={inputCls} value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} maxLength={200} />
        </Field>
        <button onClick={submit} className="mt-4 w-full rounded-[18px] gold-gradient py-3 text-sm font-semibold">
          Guardar día
        </button>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Stat label="Sueño" value={cur.sleep != null ? `${fmtNum(cur.sleep)} h` : "—"} />
        <Stat label="Energía" value={cur.energy != null ? fmtNum(cur.energy) : "—"} />
        <Stat label="Fatiga" value={cur.fatigue != null ? fmtNum(cur.fatigue) : "—"} />
        <Stat label="RPE medio" value={curRpe != null ? fmtNum(curRpe) : "—"} />
      </div>

      {notes.length === 0 ? (
        <Empty text="Registra tu sueño, energía y fatiga varios días para ver tendencias." />
      ) : (
        <div className="space-y-2">
          {notes.map((n, i) => (
            <div key={i} className="rounded-[22px] border border-border bg-surface p-4 text-sm">{n}</div>
          ))}
        </div>
      )}

      <div className="space-y-2">
        {[...logs].reverse().slice(0, 14).map((l: any) => (
          <div key={l.id} className="flex items-center gap-3 rounded-[22px] border border-border bg-surface p-4">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">{new Date(l.logged_on).toLocaleDateString("es-ES", { day: "2-digit", month: "long" })}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {[l.sleep_hours != null && `Sueño ${l.sleep_hours}h`, l.energy != null && `Energía ${l.energy}`, l.fatigue != null && `Fatiga ${l.fatigue}`, l.soreness != null && `Dolor ${l.soreness}`, l.mood != null && `Ánimo ${l.mood}`]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
            </div>
            <button onClick={() => window.confirm("¿Eliminar?") && del.mutate(l.id)} className="rounded-xl border border-border p-2 text-muted-foreground" aria-label="Eliminar">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- 12. Goals ---------------- */

const GOAL_TYPES = [
  { key: "weight", label: "Peso", unit: "kg" },
  { key: "pr", label: "PR", unit: "kg" },
  { key: "time", label: "Tiempo", unit: "s" },
  { key: "reps", label: "Repeticiones", unit: "reps" },
  { key: "volume", label: "Volumen", unit: "kg" },
  { key: "frequency", label: "Frecuencia", unit: "ses/sem" },
  { key: "benchmark", label: "Benchmark", unit: "" },
];

function GoalsSection({ records, results, metrics }: any) {
  const { data: goals = [] } = useGoals();
  const save = useSaveGoal();
  const del = useDeleteGoal();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Record<string, any>>({ goal_type: "pr" });

  const currentFor = (g: AthleteGoal): number | null => {
    if (g.goal_type === "pr" && g.exercise) {
      const recs = records.filter((r: any) => sameExercise(r.exercise, g.exercise!));
      return recs.length ? Math.max(...recs.map((r: any) => Number(r.weight))) : g.current_value ?? null;
    }
    if (g.goal_type === "weight") return bodyChange(metrics).current ?? g.current_value ?? null;
    if (g.goal_type === "volume") return windowStats(results, [], 28).volume;
    if (g.goal_type === "frequency") return windowStats(results, [], 28).weeklyFreq;
    return g.current_value ?? null;
  };

  async function submit() {
    const target = num(form.target_value);
    if (!form.title?.trim()) return toast.error("Escribe un título");
    if (target == null) return toast.error("Objetivo inválido");
    try {
      await save.mutateAsync({
        title: form.title.trim(),
        goal_type: form.goal_type,
        exercise: form.exercise || null,
        start_value: num(form.start_value),
        current_value: num(form.start_value),
        target_value: target,
        unit: GOAL_TYPES.find((t) => t.key === form.goal_type)?.unit ?? "",
        target_date: form.target_date || null,
        status: "active",
      });
      setForm({ goal_type: "pr" });
      setOpen(false);
      toast.success("Objetivo creado");
    } catch (e: any) {
      toast.error(e?.message ?? "Error");
    }
  }

  return (
    <div className="space-y-4">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-center gap-2 rounded-[18px] gold-gradient py-3 text-sm font-semibold">
        <Plus className="h-4 w-4" /> Nuevo objetivo
      </button>

      {open && (
        <Card>
          <Field label="Título">
            <input className={inputCls} value={form.title ?? ""} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={60} />
          </Field>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Field label="Tipo">
              <select className={inputCls} value={form.goal_type} onChange={(e) => setForm({ ...form, goal_type: e.target.value })}>
                {GOAL_TYPES.map((t) => (
                  <option key={t.key} value={t.key}>{t.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Ejercicio (opcional)">
              <input className={inputCls} value={form.exercise ?? ""} onChange={(e) => setForm({ ...form, exercise: e.target.value })} maxLength={60} />
            </Field>
            <Field label="Valor inicial">
              <input inputMode="decimal" className={inputCls} value={form.start_value ?? ""} onChange={(e) => setForm({ ...form, start_value: e.target.value })} />
            </Field>
            <Field label="Objetivo">
              <input inputMode="decimal" className={inputCls} value={form.target_value ?? ""} onChange={(e) => setForm({ ...form, target_value: e.target.value })} />
            </Field>
            <Field label="Fecha límite">
              <input type="date" className={inputCls} value={form.target_date ?? ""} onChange={(e) => setForm({ ...form, target_date: e.target.value })} />
            </Field>
          </div>
          <button onClick={submit} className="mt-5 w-full rounded-[18px] gold-gradient py-3 text-sm font-semibold">Crear</button>
        </Card>
      )}

      {goals.length === 0 && <Empty text="Crea tu primer objetivo deportivo." />}

      {goals.map((g) => {
        const current = currentFor(g);
        const start = g.start_value ?? 0;
        const pct =
          current == null || g.target_value === start
            ? null
            : Math.max(0, Math.min(100, Math.round(((current - start) / (g.target_value - start)) * 100)));
        return (
          <Card key={g.id}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-[0.2em]" style={{ color: "#6F6F6F" }}>{g.title}</p>
                <p className="mt-1 text-[34px] font-semibold leading-none tabular tracking-tight">
                  {current != null ? fmtNum(current) : "—"}
                  <span className="text-sm" style={{ color: "#6F6F6F" }}> / {fmtNum(g.target_value)} {g.unit}</span>
                </p>
              </div>
              <button onClick={() => window.confirm("¿Eliminar objetivo?") && del.mutate(g.id)} className="rounded-xl border p-2" style={{ borderColor: "#E4E4E4", color: "#6F6F6F" }} aria-label="Eliminar objetivo">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4 h-[6px] w-full overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.10)" }}>
              <div className="h-full rounded-full" style={{ width: `${pct ?? 0}%`, background: "linear-gradient(140deg,#EBD6A6,#D8B46B)" }} />
            </div>
            <p className="mt-2 text-[11px]" style={{ color: "#6F6F6F" }}>
              {pct != null ? `${pct}% completado` : "Sin datos suficientes"}
              {g.target_date ? ` · hasta ${new Date(g.target_date).toLocaleDateString("es-ES")}` : ""}
            </p>
          </Card>
        );
      })}
    </div>
  );
}

/* ---------------- 13. Milestones ---------------- */

function MilestonesSection({ results, history }: any) {
  const { data: saved = [] } = useMilestones();
  const sync = useSyncMilestones();
  const computed = useMemo(() => computeMilestones(results, history), [results, history]);

  useEffect(() => {
    const missing = computed.filter((c) => !saved.some((s) => s.code === c.code));
    if (missing.length) sync.mutate(missing.map((m) => ({ ...m, label: m.label, detail: m.detail ?? null })));
  }, [computed.map((c) => c.code).join(","), saved.length]);

  const list = computed.map((c) => ({
    ...c,
    achieved_at: saved.find((s) => s.code === c.code)?.achieved_at ?? null,
  }));

  if (list.length === 0) return <Empty text="Completa tu primer entrenamiento para desbloquear hitos." />;

  return (
    <div className="grid grid-cols-2 gap-3">
      {list.map((m) => (
        <div key={m.code} className="card-elevated p-4">
          <Award className="h-5 w-5" />
          <p className="mt-3 text-sm font-semibold leading-tight">{m.label}</p>
          {m.detail && <p className="mt-1 text-[11px]" style={{ color: "#6F6F6F" }}>{m.detail}</p>}
          {m.achieved_at && (
            <p className="mt-2 text-[10px] uppercase tracking-[0.16em]" style={{ color: "#6F6F6F" }}>
              {new Date(m.achieved_at).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "2-digit" })}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

/* ---------------- 14. Monthly report ---------------- */

function ReportSection({ results, history, metrics, records }: any) {
  const [offset, setOffset] = useState(0);
  const monthDate = useMemo(() => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - offset);
    return d;
  }, [offset]);

  const rep = monthlyReport(results, history, metrics, monthDate);
  const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
  const stats = exerciseStats(records, history, 60);
  const improving = stats.filter((s) => (s.changePct ?? 0) > 1);
  const stalled = stats.filter((s) => s.lastPrDate && Date.now() - new Date(s.lastPrDate).getTime() > 42 * 864e5);
  const stable = stats.filter((s) => !improving.includes(s) && !stalled.includes(s));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={() => setOffset(offset + 1)} className="rounded-xl border border-border px-3 py-2 text-xs">Anterior</button>
        <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">{rep.label}</p>
        <button onClick={() => setOffset(Math.max(0, offset - 1))} disabled={offset === 0} className="rounded-xl border border-border px-3 py-2 text-xs disabled:opacity-30">Siguiente</button>
      </div>

      {rep.sessions === 0 && rep.prs.length === 0 ? (
        <Empty text="No hay registros en este mes." />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Entrenos" value={String(rep.sessions)} sub={`de ${daysInMonth} días`} />
            <Stat label="PRs" value={String(rep.prs.length)} />
            <Stat label="Volumen" value={`${Math.round(rep.volume).toLocaleString("es-ES")} kg`} />
            <Stat label="RPE medio" value={rep.avgRpe != null ? fmtNum(rep.avgRpe) : "—"} />
            <Stat label="Peso corporal" value={rep.bodyweight != null ? fmtKg(rep.bodyweight) : "—"} />
            <Stat label="Bloques" value={String(rep.blocks)} />
          </div>

          <Card>
            <ReportList title="Improving" items={improving.map((s) => `${s.exercise} +${s.changePct!.toFixed(1)}%`)} />
            <div className="my-4 h-px" style={{ background: "rgba(255,255,255,0.10)" }} />
            <ReportList title="Stable" items={stable.map((s) => s.exercise)} />
            <div className="my-4 h-px" style={{ background: "rgba(255,255,255,0.10)" }} />
            <ReportList title="Stalled" items={stalled.map((s) => `${s.exercise} · sin PR desde ${new Date(s.lastPrDate!).toLocaleDateString("es-ES")}`)} />
          </Card>
        </>
      )}
    </div>
  );
}

function ReportList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.24em]" style={{ color: "#6F6F6F" }}>{title}</p>
      {items.length === 0 ? (
        <p className="mt-2 text-sm" style={{ color: "#6F6F6F" }}>Not enough data</p>
      ) : (
        <ul className="mt-2 space-y-1 text-sm">
          {items.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ---------------- 19. Privacy & data ---------------- */

function DataSection() {
  const [busy, setBusy] = useState(false);

  async function doExport() {
    setBusy(true);
    try {
      const data = await exportAllData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `rmordie-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Datos exportados");
    } catch (e: any) {
      toast.error(e?.message ?? "Error");
    } finally {
      setBusy(false);
    }
  }

  async function doWipe() {
    if (!window.confirm("Se eliminará TODO tu historial (entrenos, RM, cuerpo, objetivos). ¿Continuar?")) return;
    if (!window.confirm("Esta acción no se puede deshacer. ¿Seguro?")) return;
    setBusy(true);
    try {
      await wipeAllHistory();
      toast.success("Historial eliminado");
      window.location.reload();
    } catch (e: any) {
      toast.error(e?.message ?? "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <Card>
        <p className="text-[11px] uppercase tracking-[0.24em]" style={{ color: "#6F6F6F" }}>Privacidad y control</p>
        <p className="mt-3 text-sm" style={{ color: "#6F6F6F" }}>
          Tus datos son tuyos. Puedes exportarlos en cualquier momento o eliminarlos por completo. Nunca se borra nada de forma automática.
        </p>
        <button onClick={doExport} disabled={busy} className="mt-5 w-full rounded-[18px] py-3 text-sm font-semibold" style={{ background: "linear-gradient(140deg,#EBD6A6,#D8B46B)", color: "#0A0A0B" }}>
          Exportar todos mis datos (JSON)
        </button>
      </Card>
      <button onClick={doWipe} disabled={busy} className="w-full rounded-[18px] border border-border py-3 text-sm font-semibold text-muted-foreground">
        Eliminar todo mi historial
      </button>
    </div>
  );
}
