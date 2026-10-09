import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { Plus, X } from "lucide-react";
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
      { title: "Récords — RMORDIE" },
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
  const [showAdd, setShowAdd] = useState(false);
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
      <header className="rise rise-1 mb-3 flex min-h-12 items-center justify-between gap-3">
        <h1 className="text-[40px] font-extrabold leading-none tracking-tight" style={{ fontFamily: "var(--font-editorial)" }}>Récords</h1>
        {category === "strength" && (
          <button
            type="button"
            onClick={() => setShowAdd((v) => !v)}
            aria-expanded={showAdd}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-[color:var(--gold)]/45 px-4 text-[15px] font-semibold text-gold"
          >
            {showAdd ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />} {showAdd ? "Cerrar" : "Añadir"}
          </button>
        )}
      </header>

      <div role="tablist" aria-label="Tipo de récord" className="rise rise-2 mb-3 grid grid-cols-2 gap-1 rounded-[16px] bg-white/[0.05] p-1">
        {([
          { label: "Fuerza", value: "strength" as const },
          { label: "WODs", value: "wods" as const },
        ]).map((c) => (
          <button
            key={c.value}
            role="tab"
            aria-selected={category === c.value}
            onClick={() => navigate({ search: { tab: c.value }, replace: true })}
            className={`min-h-11 rounded-[12px] text-[15px] transition ${
              category === c.value ? "bg-[color:var(--gold)] font-bold text-[color:var(--gold-foreground)]" : "text-foreground/80"
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
          showAdd={showAdd}
          setShowAdd={setShowAdd}
        />
      )}
    </div>
  );
}
