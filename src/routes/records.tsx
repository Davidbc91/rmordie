import { createFileRoute } from "@tanstack/react-router";
import { useCallback } from "react";
import { WodRecords } from "@/components/WodRecords";
import { StrengthRecords } from "@/components/records/StrengthRecords";

type RecordsSearch = {
  tab?: "strength" | "wods";
  wod?: string;
  exercise?: string;
  repMax?: number;
};

export const Route = createFileRoute("/records")({
  validateSearch: (search: Record<string, unknown>): RecordsSearch => ({
    tab: search.tab === "wods" ? "wods" : "strength",
    wod: typeof search.wod === "string" ? search.wod : undefined,
    exercise: typeof search.exercise === "string" ? search.exercise : undefined,
    repMax: [1, 3, 5, 10].includes(Number(search.repMax)) ? Number(search.repMax) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Personal Records — RMORDIE" },
      {
        name: "description",
        content: "Consulta y edita tus RM (1RM, 3RM, 5RM, 10RM) con su evolución.",
      },
      { property: "og:title", content: "Personal Records — RM OR DIE" },
      { property: "og:description", content: "Tus récords máximos personales." },
    ],
  }),
  component: RecordsPage,
});

function RecordsPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const category = search.tab === "wods" ? "wods" : "strength";
  const clearFocus = useCallback(
    () =>
      navigate({
        search: (previous) => ({
          ...previous,
          exercise: undefined,
          repMax: undefined,
        }),
        replace: true,
      }),
    [navigate],
  );

  return (
          <div className="page-enter">
      <header className="rise rise-1 mb-7 glass-panel glass-refraction rounded-[28px] p-6">
        <div className="flex items-center gap-2">
          <span className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-gold" />
          <p className="cinematic-label">PERSONAL RECORDS</p>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Tu fuerza, evolución y próximos objetivos en un solo lugar.</p>
        <h1 className="cinematic-title mt-4 text-[3.4rem] leading-[.88]">
          {category === "wods" ? "WOD PRs" : "Mis RM"}
        </h1>
      </header>

      <div className="rise rise-2 glass-panel mb-5 flex gap-1 rounded-[20px] border-white/[.14] p-1.5">
        {([
          { label: "Fuerza", value: "strength" as const },
          { label: "WODs", value: "wods" as const },
        ]).map((c) => (
          <button
            key={c.value}
            onClick={() => navigate({ search: { tab: c.value }, replace: true })}
            className={`flex-1 rounded-xl px-3 py-2 text-xs font-semibold tracking-wide transition ${
              category === c.value
                ? "gold-gradient shadow-[0_10px_22px_-16px_rgba(200,179,138,0.36)]"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {category === "wods" ? (
        <WodRecords focusSlug={search.wod} />
      ) : (
        <StrengthRecords
          focusExercise={search.exercise}
          focusRepMax={search.repMax}
          clearFocus={clearFocus}
        />
      )}
      </div>
  );
}
