import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { AppShell } from "@/components/AppShell";

import { loadRecordsContent } from "@/lib/records-loader";

const RecordsContent = lazy(loadRecordsContent);

export type RecordsSearch = {
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
      { name: "description", content: "Consulta y edita tus RM (1RM, 3RM, 5RM, 10RM) con su evolución." },
      { property: "og:title", content: "Personal Records — RM OR DIE" },
      { property: "og:description", content: "Tus récords máximos personales." },
    ],
  }),
  component: RecordsPage,
});

function RecordsPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  return (
    <AppShell>
      <Suspense fallback={
        <div className="min-h-[420px]">
          <p className="text-sm text-muted-foreground">Cargando RM…</p>
        </div>
      }>
        <RecordsContent search={search} navigate={navigate} />
      </Suspense>
    </AppShell>
  );
}
