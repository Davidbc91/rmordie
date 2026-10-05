import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Search, BookOpen, ChevronRight, Dumbbell, X } from "lucide-react";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { GlassCard } from "@/components/glass";
import { MOVEMENT_CATEGORIES, MOVEMENT_EQUIPMENT, movements } from "@/lib/dictionary/catalog";
import { useCustomMovements } from "@/lib/dictionary/custom";
import type { MovementLevel } from "@/lib/dictionary/types";

export const Route = createFileRoute("/dictionary")({
  head: () => ({
    meta: [
      { title: "Diccionario — RM OR DIE" },
      { name: "description", content: "Diccionario local de movimientos CrossFit." },
    ],
  }),
  component: DictionaryPage,
});

function DictionaryPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [equipment, setEquipment] = useState("");
  const [level, setLevel] = useState("");
  const { data: customMovements = [] } = useCustomMovements();
  const allMovements = useMemo(() => [...movements, ...customMovements], [customMovements]);
  const showingMovement = useRouterState({
    select: (state) => state.location.pathname.startsWith("/dictionary/"),
  });
  const filtered = useMemo(() => {
    const term = query
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
    return allMovements.filter((m) => {
      const matchesQuery =
        !term ||
        [m.name, m.nameEs, ...m.aliases].some((value) =>
          value
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, " ")
            .includes(term),
        );
      return (
        matchesQuery &&
        (!category || m.category === category) &&
        (!equipment || m.equipment.includes(equipment)) &&
        (!level || m.level === level)
      );
    });
  }, [query, category, equipment, level, allMovements]);
  const selectClass =
    "min-w-0 rounded-xl border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] px-3 py-2.5 text-sm text-foreground outline-none focus:border-[rgba(216,180,107,0.55)]";
  const levels: MovementLevel[] = ["Beginner", "Intermediate", "Advanced"];
  const categories = useMemo(() => Array.from(new Set([...MOVEMENT_CATEGORIES, ...customMovements.map((m) => m.category)])).sort(), [customMovements]);
  const equipmentOptions = useMemo(() => Array.from(new Set([...MOVEMENT_EQUIPMENT, ...customMovements.flatMap((m) => m.equipment)])).sort(), [customMovements]);

  return (
    <AppShell>
      {showingMovement ? (
        <Outlet />
      ) : (
        <div className="space-y-6">
          <header className="space-y-2">
            <div className="flex items-center gap-2">
              <BookOpen className="h-6 w-6" style={{ color: "var(--gold)" }} />
              <h1 className="text-2xl font-semibold">DICCIONARIO</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Movimientos utilizados en CrossFit, con técnica y variantes.
            </p>
          </header>
          <div className="space-y-3">
            <label className="relative block">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar movimiento…"
                className="min-h-11 w-full rounded-xl border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] py-3 pl-10 pr-10 text-sm outline-none placeholder:text-muted-foreground focus:border-[rgba(216,180,107,0.55)]"
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  aria-label="Limpiar búsqueda"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <select
                aria-label="Filtrar por categoría"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className={selectClass}
              >
                <option value="">Todas las categorías</option>
                {categories.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
              <select
                aria-label="Filtrar por equipamiento"
                value={equipment}
                onChange={(e) => setEquipment(e.target.value)}
                className={selectClass}
              >
                <option value="">Todo el equipamiento</option>
                {equipmentOptions.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
              <select
                aria-label="Filtrar por nivel"
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                className={selectClass}
              >
                <option value="">Todos los niveles</option>
                {levels.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </div>
          </div>
          <p className="eyebrow">{filtered.length} movimientos</p>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {filtered.map((m) => (
              <Link
                key={m.id}
                to="/dictionary/$movementId"
                params={{ movementId: m.id }}
                className="block text-left"
              >
                <GlassCard className="pressable p-4">
                  <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[14px] border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)]">
                      <Dumbbell className="h-4 w-4" style={{ color: "var(--gold)" }} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{m.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {m.nameEs}
                      </span>
                    </span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <span className="rounded-full border border-border px-2 py-1 text-[10px]">
                      {m.category}
                    </span>
                    <span className="rounded-full border border-border px-2 py-1 text-[10px]">
                      {m.level}
                    </span>
                    {m.rm && (
                      <span
                        className="rounded-full border border-[rgba(216,180,107,0.35)] px-2 py-1 text-[10px]"
                        style={{ color: "var(--gold)" }}
                      >
                        RM
                      </span>
                    )}
                  </div>
                </GlassCard>
              </Link>
            ))}
          </div>
          {filtered.length === 0 && (
            <p className="rounded-2xl border border-border p-6 text-center text-sm text-muted-foreground">
              No se encontraron movimientos con esos filtros.
            </p>
          )}
        </div>
      )}
    </AppShell>
  );
}
