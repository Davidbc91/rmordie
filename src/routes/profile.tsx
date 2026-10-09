import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { ChevronLeft, ChevronRight, Pencil } from "lucide-react";
import { usePlanning, useAllResults, usePersonalRecords } from "@/lib/store";
import { useAthleteProfile, useBodyMetrics, useWellnessLogs, useAllPrHistory } from "@/lib/profile-store";
import { RANGES, type RangeKey, plannedTrainingDays, streaks } from "@/lib/analytics";
import { planningCompletion } from "@/lib/session-progress";
import { RangePicker } from "@/components/profile/shared";
import { ProfileForm } from "@/components/profile/ProfileForm";
import { BodySection } from "@/components/profile/BodySection";
import { ProgressSection } from "@/components/profile/ProgressSection";
import { PerformanceSection } from "@/components/profile/PerformanceSection";
import { StrengthSection } from "@/components/profile/StrengthSection";
import { ConsistencySection } from "@/components/profile/ConsistencySection";
import { RecoverySection } from "@/components/profile/RecoverySection";
import { GoalsSection } from "@/components/profile/GoalsSection";
import { MilestonesSection } from "@/components/profile/MilestonesSection";
import { ReportSection } from "@/components/profile/ReportSection";
import { DataSection } from "@/components/profile/DataSection";

type ProfileSearch = { section?: SectionKey; range?: RangeKey };

export const Route = createFileRoute("/profile")({
  validateSearch: (search: Record<string, unknown>): ProfileSearch => ({
    section: typeof search.section === "string" && SECTIONS.some((s) => s.key === search.section) ? (search.section as SectionKey) : undefined,
    range: RANGES.some((r) => r.key === search.range) ? (search.range as RangeKey) : "12w",
  }),
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
  { key: "profile", label: "Datos personales", hint: "Nombre, altura, nivel y objetivo semanal", group: "you" },
  { key: "progress", label: "Progreso", hint: "Sesiones, volumen y evolución", group: "progress" },
  { key: "performance", label: "Rendimiento", hint: "RPE, carga y fuerza relativa", group: "progress" },
  { key: "strength", label: "Fuerza", hint: "RM estimados y mejoras", group: "progress" },
  { key: "consistency", label: "Constancia", hint: "Semanas cumplidas y rachas", group: "progress" },
  { key: "recovery", label: "Recuperación", hint: "Sueño, energía y ánimo", group: "progress" },
  { key: "body", label: "Cuerpo", hint: "Peso y medidas", group: "you" },
  { key: "goals", label: "Objetivos", hint: "Tus metas y cómo vas", group: "you" },
  { key: "milestones", label: "Hitos", hint: "Logros conseguidos", group: "you" },
  { key: "report", label: "Informe mensual", hint: "Resumen para ti o tu entrenador", group: "data" },
  { key: "data", label: "Mis datos", hint: "Exportar o borrar tu información", group: "data" },
] as const;

const GROUPS = [
  { key: "progress", title: "Tu progreso" },
  { key: "you", title: "Tú" },
  { key: "data", title: "Informes y datos" },
] as const;

type SectionKey = (typeof SECTIONS)[number]["key"];

function ProfilePage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const section = search.section;
  const range = search.range ?? "12w";

  const setSection = (next: SectionKey | undefined) => navigate({ search: (prev) => ({ ...prev, section: next }) });
  const setRange = (next: RangeKey) => navigate({ search: (prev) => ({ ...prev, range: next }), replace: true });

  const { data: planning } = usePlanning();
  const { data: results = [] } = useAllResults();
  const { data: records = [] } = usePersonalRecords();
  const { data: history = [] } = useAllPrHistory();
  const { data: profile } = useAthleteProfile();
  const { data: metrics = [] } = useBodyMetrics();
  const { data: wellness = [] } = useWellnessLogs();

  const days = RANGES.find((r) => r.key === range)!.days;
  const rangeLabel = RANGES.find((r) => r.key === range)!.label;

  const completion = planningCompletion(planning?.data, results);
  const streak = streaks(results).current;
  const current = SECTIONS.find((s) => s.key === section);
  const initials = (profile?.display_name || "Atleta").trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  const subtitle = [
    profile?.current_weight_kg != null ? `${profile.current_weight_kg} kg` : null,
    profile?.weekly_target ? `objetivo ${profile.weekly_target} sesiones/semana` : null,
  ].filter(Boolean).join(" · ");

  if (!current) {
    return (
      <AppShell>
        <header className="rise rise-1 mb-4 flex items-center gap-3.5 py-1">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="h-16 w-16 shrink-0 rounded-full border border-[color:var(--gold)]/45 object-cover" />
          ) : (
            <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full border border-[color:var(--gold)]/45 bg-[color:var(--gold)]/15 text-[22px] font-bold text-gold-soft">{initials}</span>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[34px] font-extrabold leading-none tracking-tight" style={{ fontFamily: "var(--font-editorial)" }}>{profile?.display_name || "Atleta"}</h1>
            {subtitle && <p className="mt-1 truncate text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          <button
            type="button"
            aria-label="Editar datos personales"
            onClick={() => setSection("profile")}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/[0.06]"
          >
            <Pencil className="h-[18px] w-[18px]" strokeWidth={1.8} />
          </button>
        </header>

        <div className="rise rise-2 mb-2 grid grid-cols-3 gap-2">
          <ProfileStat value={String(completion.completed)} label="Sesiones" onClick={() => setSection("progress")} />
          <ProfileStat value={`${completion.pct} %`} label="Constancia" onClick={() => setSection("consistency")} />
          <ProfileStat value={String(streak)} label="Días de racha" accent onClick={() => setSection("consistency")} />
        </div>

        {GROUPS.map((g) => (
          <section key={g.key} className="rise rise-3 mt-4">
            <h2 className="mb-1.5 px-1 text-[13px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{g.title}</h2>
            <div className="overflow-hidden rounded-[18px] border border-white/[0.09] bg-white/[0.045]">
              {SECTIONS.filter((s) => s.group === g.key).map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setSection(s.key)}
                  className="flex min-h-[58px] w-full items-center gap-3 border-b border-white/[0.06] px-4 py-2 text-left last:border-b-0"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold">{s.label}</span>
                    <span className="block truncate text-[13px] text-muted-foreground">{s.hint}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              ))}
            </div>
          </section>
        ))}
      </AppShell>
    );
  }

  return (
    <AppShell>
      <button
        type="button"
        onClick={() => setSection(undefined)}
        className="mb-1 flex min-h-11 items-center gap-1 text-[15px] text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-[18px] w-[18px]" /> Perfil
      </button>
      <h1 className="rise rise-1 mb-4 text-[40px] font-extrabold leading-none tracking-tight" style={{ fontFamily: "var(--font-editorial)" }}>{current.label}</h1>

      {section === "profile" && <ProfileForm />}
      {section === "body" && <BodySection />}
      {(section === "progress" || section === "performance" || section === "strength" || section === "recovery") && (
        <RangePicker range={range} setRange={setRange} />
      )}
      {section === "progress" && (
        <ProgressSection
          results={results}
          history={history}
          records={records}
          metrics={metrics}
          plannedDays={plannedTrainingDays(planning?.data)}
          completedSessions={planningCompletion(planning?.data, results).completed}
          days={days}
          rangeLabel={rangeLabel}
          goStrength={() => setSection("strength")}
          wellness={wellness}
        />
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

function ProfileStat({ value, label, onClick, accent }: { value: string; label: string; onClick: () => void; accent?: boolean }) {
  return (
    <button type="button" onClick={onClick} className="glass glass-sheen pressable min-h-[80px] min-w-0 p-3 text-left cinematic-card-dark">
      <div className={`metric truncate tabular ${accent ? "text-gold" : ""}`}>{value}</div>
      <div className="mt-1 truncate text-[13px] text-muted-foreground">{label}</div>
    </button>
  );
}
