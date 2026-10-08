import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
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
} from "lucide-react";
import { usePlanning, useAllResults, usePersonalRecords } from "@/lib/store";
import { useAthleteProfile, useBodyMetrics, useWellnessLogs, useAllPrHistory } from "@/lib/profile-store";
import { RANGES, type RangeKey, plannedTrainingDays } from "@/lib/analytics";
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
    section: typeof search.section === "string" && SECTIONS.some((s) => s.key === search.section) ? (search.section as SectionKey) : "profile",
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

function ProfilePage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const section = search.section ?? "profile";
  const range = search.range ?? "12w";

  const setSection = (next: SectionKey) => navigate({ search: (prev) => ({ ...prev, section: next }), replace: true });
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

  return (
    <AppShell>
      <header className="rise rise-1 mb-5">
        <div className="flex items-center gap-2">
          <span className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-gold" />
          <p className="cinematic-label">ATHLETE PROFILE</p>
        </div>
        <h1 className="cinematic-title mt-5">{profile?.display_name || "Atleta"}</h1>
      </header>

      <div className="rise rise-2 mb-6 block w-full min-w-0 max-w-full overflow-x-auto overscroll-x-contain no-scrollbar [contain:inline-size] [-webkit-overflow-scrolling:touch]">
        <div className="inline-flex min-w-full gap-2">
          {SECTIONS.map((s) => {
            const active = section === s.key;
            return (
              <button
                key={s.key}
                onClick={() => setSection(s.key)}
                className={`whitespace-nowrap rounded-2xl border px-4 py-2 text-xs font-semibold transition ${
                  active
                    ? "border-transparent gold-gradient shadow-[0_8px_24px_-12px_rgba(200,179,138,.42)]"
                    : "border-border bg-white/[.025] text-muted-foreground"
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
