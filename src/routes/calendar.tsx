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
      <div className="select-none" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <div className="glass glass-sheen rise rise-1 flex items-center justify-between gap-2 p-2.5">
          <button
            onClick={goPrev}
            className="tap pressable grid place-items-center rounded-[14px] text-muted-foreground hover:text-foreground disabled:opacity-25"
            disabled={idx === 0}
            aria-label="Mes anterior"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0 text-center">
            <p className="eyebrow">{month.key}</p>
            <h1 className="mt-1 truncate text-xl font-semibold tracking-tight">{month.label}</h1>
          </div>
          <button
            onClick={goNext}
            className="tap pressable grid place-items-center rounded-[14px] text-muted-foreground hover:text-foreground disabled:opacity-25"
            disabled={idx === months.length - 1}
            aria-label="Mes siguiente"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-3 flex items-center justify-center gap-3">
          <button
            onClick={() => setIdx(findMonthIndexForDate(months))}
            className="pressable inline-flex min-h-[40px] items-center gap-2 rounded-full border border-[rgba(216,180,107,0.35)] bg-[rgba(216,180,107,0.10)] px-4 text-xs font-semibold text-gold"
          >
            <Calendar className="h-3.5 w-3.5" />
            Ir a hoy
          </button>
          <span className="text-[10px] text-muted-foreground/70 sm:hidden">Desliza para cambiar de mes</span>
        </div>

        <div className="mt-7 space-y-7">
          {month.weeks.map((w, wi) => {
            const trainDays = w.days.filter((d) => !d.isRest);
            const doneCount = trainDays.filter((d) => doneMap.has(`${month.key}|${w.index}|${d.key}`)).length;
            const pct = trainDays.length ? Math.round((doneCount / trainDays.length) * 100) : 0;
            return (
              <section key={w.index} className={`rise rise-${Math.min(wi + 1, 5)}`}>
                <div className="mb-2.5 flex items-end justify-between gap-4">
                  <h2 className="eyebrow">Semana {w.index}</h2>
                  <span className="text-[11px] font-semibold tabular text-muted-foreground">
                    {doneCount}/{trainDays.length}
                  </span>
                </div>
                <div className="mb-3.5 h-[2px] w-full overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.08)" }}>
                  <div
                    className="h-full rounded-full transition-[width] duration-700"
                    style={{ width: `${pct}%`, background: "linear-gradient(90deg,#EBD6A6,#D8B46B)" }}
                  />
                </div>
                <div className="space-y-2">
                  {w.days.map((d) => {
                    const done = doneMap.has(`${month.key}|${w.index}|${d.key}`);
                    const isRest = d.isRest;
                    const headline = isRest
                      ? "Descanso y movilidad"
                      : (d.blocks.find((b) => /^[A-D]$/.test(b.key))?.content.split("\n")[0] ??
                        d.blocks[0]?.content.split("\n")[0] ??
                        "—");
                    return (
                      <Link
                        key={d.key}
                        to="/workout/$month/$week/$day"
                        params={{ month: month.key, week: String(w.index), day: d.key }}
                        className={`pressable flex items-center gap-3.5 px-4 py-3.5 ${done ? "glass glass-sheen glass-gold" : isRest ? "glass-quiet opacity-70" : "glass glass-sheen"}`}
                      >
                        <span
                          className="grid h-11 w-11 shrink-0 place-items-center rounded-[15px] border text-[11px] font-bold uppercase tracking-[0.06em]"
                          style={{
                            borderColor: done ? "rgba(216,180,107,0.45)" : "rgba(255,255,255,0.09)",
                            background: done ? "rgba(216,180,107,0.14)" : "rgba(255,255,255,0.035)",
                            color: done ? "var(--gold)" : "var(--muted-foreground)",
                          }}
                        >
                          {d.key.slice(0, 3)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold">
                            {isRest ? "Descanso" : d.key}
                          </span>
                          <span className="mt-0.5 block truncate text-xs text-muted-foreground">{headline}</span>
                        </span>
                        {isRest ? (
                          <Moon className="h-4 w-4 shrink-0 text-muted-foreground/70" strokeWidth={1.7} />
                        ) : done ? (
                          <span className="gold-gradient grid h-6 w-6 shrink-0 place-items-center rounded-full">
                            <Check className="h-3.5 w-3.5" strokeWidth={2.6} />
                          </span>
                        ) : (
                          <Circle className="h-4 w-4 shrink-0 text-muted-foreground/45" strokeWidth={1.7} />
                        )}
                      </Link>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
