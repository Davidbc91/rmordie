import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { usePlanning, useAllResults } from "@/lib/store";
import { useMemo, useState, useEffect, useRef, useCallback } from "react";
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
  head: () => ({ meta: [{ title: "Calendario — RM OR DIE" }] }),
  component: CalendarPage,
});

function CalendarPage() {
  const { data: planning } = usePlanning();
  const { data: results = [] } = useAllResults();
  const [idx, setIdx] = useState(0);
  const initialized = useRef(false);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  if (!planning) {
    return (
      <AppShell>
        <p className="text-muted-foreground text-sm">Importa primero tu planificación.</p>
      </AppShell>
    );
  }
  const months = planning.data.months;

  // Initialize only once so interactions never recenter the calendar.
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
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

  const goPrev = useCallback(() => {
    setIdx((i) => Math.max(0, i - 1));
  }, []);

  const goNext = useCallback(() => {
    setIdx((i) => Math.min(months.length - 1, i + 1));
  }, [months.length]);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, []);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const start = touchStart.current;
    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    const dx = endX - start.x;
    const dy = endY - start.y;
    touchStart.current = null;

    // Only handle horizontal swipes that are longer than vertical movement.
    if (Math.abs(dx) < 50 || Math.abs(dy) > Math.abs(dx)) return;
    if (dx > 0) goPrev();
    else goNext();
  }, [goPrev, goNext]);

  const doneMap = useMemo(() => {
    const m = new Set<string>();
    for (const r of results) {
      if (r.status === "completed") m.add(`${r.month_key}|${r.week}|${r.day_key}`);
    }
    return m;
  }, [results]);

  return (
    <AppShell>
      <div
        className="select-none"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div className="flex items-center justify-between">
          <button
            onClick={goPrev}
            className="rounded-full p-2 text-muted-foreground hover:text-foreground disabled:opacity-30 active:scale-95"
            disabled={idx === 0}
            aria-label="Mes anterior"
          ><ChevronLeft className="h-5 w-5" /></button>
          <div className="text-center">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{month.key}</p>
            <h1 className="text-xl font-semibold">{month.label}</h1>
          </div>
          <button
            onClick={goNext}
            className="rounded-full p-2 text-muted-foreground hover:text-foreground disabled:opacity-30 active:scale-95"
            disabled={idx === months.length - 1}
            aria-label="Mes siguiente"
          ><ChevronRight className="h-5 w-5" /></button>
        </div>

        <div className="mt-4 flex justify-center">
          <button
            onClick={() => setIdx(findMonthIndexForDate(months))}
            className="flex items-center gap-2 rounded-full border border-border px-4 py-1.5 text-xs font-medium text-foreground hover:bg-white/5 active:bg-white/10"
          >
            <Calendar className="h-3.5 w-3.5" />
            Ir a hoy
          </button>
        </div>

        <div className="mt-2 text-center text-[10px] text-muted-foreground/60 sm:hidden">
          Desliza para cambiar de mes
        </div>

        <div className="mt-10 space-y-8">
          {month.weeks.map((w) => (
            <section key={w.index}>
              <h2 className="mb-4 text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Semana {w.index}</h2>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {w.days.map((d) => {
                  const done = doneMap.has(`${month.key}|${w.index}|${d.key}`);
                  const isRest = d.isRest;
                  return (
                    <Link
                      key={d.key}
                      to="/workout/$month/$week/$day"
                      params={{ month: month.key, week: String(w.index), day: d.key }}
                      className="flex flex-col items-start gap-2 rounded-2xl border p-3 transition active:scale-[0.98]"
                      style={{
                        background: done ? "#FFFFFF" : "#000000",
                        borderColor: done ? "#FFFFFF" : "#2A2A2A",
                        color: done ? "#000000" : "#FFFFFF",
                      }}
                    >
                      <div className="flex w-full items-center justify-between">
                        <span className="text-[10px] uppercase tracking-[0.2em]" style={{ opacity: done ? 0.6 : 0.55 }}>{d.key.slice(0, 3)}</span>
                        {isRest ? (
                          <Moon className="h-3.5 w-3.5" style={{ opacity: 0.5 }} />
                        ) : done ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : (
                          <Circle className="h-3.5 w-3.5" style={{ opacity: 0.4 }} />
                        )}
                      </div>
                      <div className="text-xs line-clamp-2" style={{ opacity: done ? 0.7 : 0.6 }}>
                        {isRest ? "Descanso" : (d.blocks.find((b) => /^[A-D]$/.test(b.key))?.content.split("\n")[0] ?? d.blocks[0]?.content.split("\n")[0] ?? "—")}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
