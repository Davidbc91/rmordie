import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Search, ChevronRight, X, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { usePlanning } from "@/lib/store";
import { buildPlanDateIndex, isoKey } from "@/lib/plan-dates";
import { resolveMovements } from "@/lib/dictionary/resolve";
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
  const [moreFilters, setMoreFilters] = useState(false);
  const { data: planning } = usePlanning();
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
    "min-h-12 min-w-0 rounded-[14px] border border-white/[0.14] bg-white/[0.06] px-3 text-[15px] text-foreground outline-none focus:border-[color:var(--gold)]/60";
  const levels: MovementLevel[] = ["Beginner", "Intermediate", "Advanced"];
  const categories = useMemo(() => Array.from(new Set([...MOVEMENT_CATEGORIES, ...customMovements.map((m) => m.category)])).sort(), [customMovements]);
  const equipmentOptions = useMemo(() => Array.from(new Set([...MOVEMENT_EQUIPMENT, ...customMovements.flatMap((m) => m.equipment)])).sort(), [customMovements]);

  // Movimientos del entreno de hoy (según el plan)
  const todayMovements = useMemo(() => {
    const months = planning?.data.months ?? [];
    if (!months.length) return [];
    const today = buildPlanDateIndex(months).get(isoKey(new Date()));
    if (!today || today.day.isRest) return [];
    const ids: string[] = [];
    for (const b of today.day.blocks) {
      if (!/^[A-D]$/.test(b.key)) continue;
      for (const m of resolveMovements(b.content)) if (!ids.includes(m.movementId)) ids.push(m.movementId);
    }
    return ids.map((id) => allMovements.find((m) => m.id === id)).filter((m): m is (typeof allMovements)[number] => !!m).slice(0, 6);
  }, [planning, allMovements]);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    for (const m of filtered) {
      const list = map.get(m.category) ?? [];
      list.push(m);
      map.set(m.category, list);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], "es"));
  }, [filtered]);

  const searching = !!query.trim() || !!category || !!equipment || !!level;
  const extraFilters = (equipment ? 1 : 0) + (level ? 1 : 0);

  return (
    <AppShell>
      {showingMovement ? (
        <Outlet />
      ) : (
        <div className="space-y-4">
          <header>
            <p className="eyebrow">Movimientos CrossFit</p>
            <h1 className="page-title mt-1">Diccionario</h1>
          </header>

          <label className="flex min-h-[52px] items-center gap-2.5 rounded-[16px] border border-white/[0.12] bg-white/[0.06] px-3.5 focus-within:border-[color:var(--gold)]/60">
            <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
            <span className="sr-only">Buscar movimiento</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Busca: snatch, dominada, t2b…"
              className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
            />
            {query && (
              <button type="button" onClick={() => setQuery("")} className="grid h-11 w-11 shrink-0 place-items-center text-muted-foreground" aria-label="Limpiar búsqueda">
                <X className="h-5 w-5" />
              </button>
            )}
          </label>

          <div role="group" aria-label="Categoría" className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
            {["", ...categories].map((c) => {
              const on = category === c;
              return (
                <button
                  key={c || "todos"}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setCategory(c)}
                  className={`min-h-10 shrink-0 rounded-full px-3.5 text-sm ${on ? "bg-[color:var(--gold)] font-bold text-[color:var(--gold-foreground)]" : "bg-white/[0.06] font-medium"}`}
                >
                  {c || "Todos"}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between text-[13px] text-muted-foreground">
            <span>{filtered.length} movimientos</span>
            <button type="button" aria-expanded={moreFilters} onClick={() => setMoreFilters((v) => !v)} className="flex min-h-11 items-center gap-1.5 font-bold text-gold">
              <SlidersHorizontal className="h-4 w-4" /> Más filtros{extraFilters ? ` (${extraFilters})` : ""}
            </button>
          </div>
          {moreFilters && (
            <div className="grid grid-cols-2 gap-2">
              <select aria-label="Filtrar por equipamiento" value={equipment} onChange={(e) => setEquipment(e.target.value)} className={selectClass}>
                <option value="">Todo el material</option>
                {equipmentOptions.map((x) => <option key={x}>{x}</option>)}
              </select>
              <select aria-label="Filtrar por nivel" value={level} onChange={(e) => setLevel(e.target.value)} className={selectClass}>
                <option value="">Todos los niveles</option>
                {levels.map((x) => <option key={x} value={x}>{LEVEL_LABEL[x].text}</option>)}
              </select>
            </div>
          )}

          {!searching && todayMovements.length > 0 && (
            <section>
              <p className="mb-1.5 px-1 text-[13px] font-bold tracking-[0.12em] text-gold">EN TU ENTRENO DE HOY</p>
              <div className="grid grid-cols-2 gap-2">
                {todayMovements.map((m) => (
                  <Link key={m.id} to="/dictionary/$movementId" params={{ movementId: m.id }} className="pressable min-h-16 rounded-[16px] border border-[color:var(--gold)]/30 bg-[color:var(--gold)]/[0.09] px-3 py-2.5">
                    <span className="block truncate text-[15px] font-bold">{m.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{m.nameEs}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {grouped.map(([cat, list]) => (
            <section key={cat}>
              <p className="mb-1.5 px-1 text-[13px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{cat}</p>
              <div className="overflow-hidden rounded-[18px] bg-white/[0.045]">
                {list.map((m) => (
                  <Link
                    key={m.id}
                    to="/dictionary/$movementId"
                    params={{ movementId: m.id }}
                    className="flex min-h-16 items-center gap-3 border-b border-white/[0.06] px-3.5 py-2 last:border-b-0 active:bg-white/[0.04]"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-base font-bold">{m.name}</span>
                        {m.rm && <span className="shrink-0 rounded-full border border-[color:var(--gold)]/40 px-1.5 text-[11px] font-bold text-gold">RM</span>}
                        {m.id.startsWith("custom-") && <span className="shrink-0 rounded-full border border-[color:var(--gold)]/40 px-1.5 text-[11px] font-bold text-gold">Tuyo</span>}
                      </span>
                      <span className="block truncate text-[13px] text-muted-foreground">
                        {m.nameEs}{m.equipment[0] ? ` · ${m.equipment[0]}` : ""}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground" aria-label={`Nivel ${LEVEL_LABEL[m.level]?.text ?? m.level}`}>
                      <span className="text-gold">{LEVEL_LABEL[m.level]?.dots ?? ""}</span> {LEVEL_LABEL[m.level]?.text ?? m.level}
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </Link>
                ))}
              </div>
            </section>
          ))}

          {filtered.length === 0 && (
            <p className="rounded-[18px] bg-white/[0.04] p-6 text-center text-[15px] text-muted-foreground">
              No hay movimientos con esa búsqueda.
            </p>
          )}
        </div>
      )}
    </AppShell>
  );
}

const LEVEL_LABEL: Record<string, { dots: string; text: string }> = {
  Beginner: { dots: "●", text: "Básico" },
  Intermediate: { dots: "●●", text: "Medio" },
  Advanced: { dots: "●●●", text: "Avanzado" },
};
