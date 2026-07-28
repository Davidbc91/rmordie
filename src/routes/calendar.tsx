import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { usePlanning, useAllResults } from "@/lib/store";
import { useMemo, useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Check, Circle, Moon, Calendar } from "lucide-react";
import type { Month } from "@/lib/excel-parser";

const CALENDAR_MONTH_KEY = "malitos_calendar_month_key";

const MONTH_ABBR: Record<number, string> = {
  0: "ENE", 1: "FEB", 2: "MAR", 3: "ABR", 4: "MAY", 5: "JUN",
  6: "JUL", 7: "AGO", 8: "SEP", 9: "OCT", 10: "NOV", 11: "DIC",
};

function getCurrentMonthAbbr() {
  return MONTH_ABBR[new Date().getMonth()];
}

function findMonthIndexForDate(months: Month[]) {
  const current = getCurrentMonthAbbr();
  const idx = months.findIndex((m) =>
    m.key.toUpperCase().includes(current)
  );
  return idx >= 0 ? idx : 0;
}

function getInitialMonthIndex(months: Month[]) {
  if (typeof window === "undefined") return 0;
  const saved = window.localStorage.getItem(CALENDAR_MONTH_KEY);
  if (saved) {
    const savedIdx = months.findIndex((m) => m.key === saved);
    if (savedIdx >= 0) return savedIdx;
  }
  return findMonthIndexForDate(months);
}

export const Route = createFileRoute("/calendar")({
  head: () => ({ meta: [{ title: "Calendario — Malitos" }] }),
  component: CalendarPage,
});

function CalendarPage() {
  const { data: planning } = usePlanning();
  const { data: results = [] } = useAllResults();
  const [idx, setIdx] = useState(0);

  if (!planning) {
    return (
      <AppShell>
        <p className="text-muted-foreground text-sm">Importa primero tu planificación.</p>
      </AppShell>
    );
  }
  const months = planning.data.months;

  // Initialize to the saved month, or the current calendar month, or the first one.
  useEffect(() => {
    setIdx(getInitialMonthIndex(months));
  }, [months]);

  // Persist the last viewed month key.
  useEffect(() => {
    const month = months[idx];
    if (month) {
      window.localStorage.setItem(CALENDAR_MONTH_KEY, month.key);
    }
  }, [idx, months]);

  const month = months[Math.min(idx, months.length - 1)];

  const doneMap = useMemo(() => {
    const m = new Set<string>();
    for (const r of results) {
      if (r.status === "completed") m.add(`${r.month_key}|${r.week}|${r.day_key}`);
    }
    return m;
  }, [results]);

  return (
    <AppShell>
      <div className="flex items-center justify-between">
        <button
          onClick={() => setIdx((i) => Math.max(0, i - 1))}
          className="rounded-full p-2 text-muted-foreground hover:text-foreground disabled:opacity-30"
          disabled={idx === 0}
        ><ChevronLeft className="h-5 w-5" /></button>
        <div className="text-center">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{month.key}</p>
          <h1 className="text-xl font-semibold">{month.label}</h1>
        </div>
        <button
          onClick={() => setIdx((i) => Math.min(months.length - 1, i + 1))}
          className="rounded-full p-2 text-muted-foreground hover:text-foreground disabled:opacity-30"
          disabled={idx === months.length - 1}
        ><ChevronRight className="h-5 w-5" /></button>
      </div>

      <div className="mt-3 flex justify-center">
        <button
          onClick={() => setIdx(findMonthIndexForDate(months))}
          className="flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-4 py-1.5 text-xs font-medium text-gold hover:bg-gold/20"
        >
          <Calendar className="h-3.5 w-3.5" />
          Ir a hoy
        </button>
      </div>

      <div className="mt-8 space-y-6">
        {month.weeks.map((w) => (
          <section key={w.index}>
            <h2 className="mb-3 text-xs uppercase tracking-widest text-muted-foreground">Semana {w.index}</h2>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {w.days.map((d) => {
                const done = doneMap.has(`${month.key}|${w.index}|${d.key}`);
                return (
                  <Link
                    key={d.key}
                    to="/workout/$month/$week/$day"
                    params={{ month: month.key, week: String(w.index), day: d.key }}
                    className="flex flex-col items-start gap-2 rounded-xl border border-border bg-surface p-3 transition hover:border-gold/40"
                  >
                    <div className="flex w-full items-center justify-between">
                      <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{d.key.slice(0, 3)}</span>
                      {d.isRest ? (
                        <Moon className="h-3.5 w-3.5 text-muted-foreground" />
                      ) : done ? (
                        <Check className="h-3.5 w-3.5 text-gold" />
                      ) : (
                        <Circle className="h-3.5 w-3.5 text-muted-foreground/60" />
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground/80 line-clamp-2">
                      {d.isRest ? "Descanso" : (d.blocks.find((b) => /^[A-D]$/.test(b.key))?.content.split("\n")[0] ?? d.blocks[0]?.content.split("\n")[0] ?? "—")}
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </AppShell>
  );
}
