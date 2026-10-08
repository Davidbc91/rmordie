import { createFileRoute, Link } from "@tanstack/react-router";
import { usePlanning, useAllResults } from "@/lib/store";
import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { ChevronLeft, ChevronRight, Check, Circle, Moon, Calendar } from "lucide-react";
import type { Month } from "@/lib/excel-parser";
import { completedBlockMap, isSessionCompleted, sessionProgress } from "@/lib/session-progress";


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

function parseMonthDate(month: Month): { year: number; monthIndex: number } | null {
  const text = `${month.key} ${month.label}`.toUpperCase();
  const yearMatch = text.match(/(?:19|20)\d{2}/);
  const year = yearMatch ? Number(yearMatch[0]) : new Date().getFullYear();
  const monthMap: Record<string, number> = {
    ENE: 0, ENERO: 0, FEB: 1, FEBRERO: 1, MAR: 2, MARZO: 2, ABR: 3, ABRIL: 3,
    MAY: 4, MAYO: 4, JUN: 5, JUNIO: 5, JUL: 6, JULIO: 6, AGO: 7, AGOSTO: 7,
    SEP: 8, SEPT: 8, SEPTIEMBRE: 8, OCT: 9, OCTUBRE: 9, NOV: 10, NOVIEMBRE: 10,
    DIC: 11, DICIEMBRE: 11,
  };
  const token = Object.keys(monthMap).sort((a, b) => b.length - a.length).find((key) => new RegExp(`\\b${key}\\b`).test(text));
  return token ? { year, monthIndex: monthMap[token] } : null;
}

const WEEKDAY_MAP: Record<string, number> = {
  LUNES: 0, MARTES: 1, MIERCOLES: 2, MIÉRCOLES: 2,
  JUEVES: 3, VIERNES: 4, SABADO: 5, SÁBADO: 5, DOMINGO: 6,
};

type PlannedDay = {
  month: Month;
  week: number;
  day: import("@/lib/excel-parser").Day;
  date: Date;
};

function isoKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

/**
 * El plan anual empieza el 07/10/2026: la semana 1 es 07/10–11/10
 * y desde la semana 2 cada semana empieza en lunes. Inferimos el anclaje
 * desde la primera semana de la planificación para conservar las fechas
 * reales incluso cuando una semana cruza de mes.
 */
function inferPlanAnchor(months: Month[]): { date: Date; week: number } | null {
  const firstMonth = [...months].sort((a, b) => a.order - b.order)[0];
  const firstWeek = firstMonth?.weeks.slice().sort((a, b) => a.index - b.index)[0];
  const parsed = firstMonth ? parseMonthDate(firstMonth) : null;
  if (!firstMonth || !firstWeek || !parsed) return null;

  const firstPlannedDay = firstWeek.days.find((day) => !day.isRest);
  const weekday = firstPlannedDay ? WEEKDAY_MAP[firstPlannedDay.key.toUpperCase()] : undefined;
  if (weekday == null) return null;

  const firstOfMonth = new Date(parsed.year, parsed.monthIndex, 1);
  const offset = (weekday - firstOfMonth.getDay() + 7) % 7;
  return { date: addDays(firstOfMonth, offset), week: firstWeek.index };
}

function dateForPlannedDay(
  weekIndex: number,
  dayKey: string,
  anchor: { date: Date; week: number },
) {
  const weekday = WEEKDAY_MAP[dayKey.toUpperCase()];
  if (weekday == null) return null;

  const anchorWeekday = anchor.date.getDay();
  if (weekIndex === anchor.week) {
    const date = addDays(anchor.date, weekday - anchorWeekday);
    return date >= anchor.date ? date : null;
  }

  // La primera semana comienza a mitad de semana. Desde ahí, la siguiente
  // semana real empieza el lunes siguiente.
  const nextMonday = addDays(anchor.date, 7 - anchorWeekday);
  return addDays(nextMonday, (weekIndex - anchor.week - 1) * 7 + weekday);
}

function buildPlanDateIndex(months: Month[]) {
  const anchor = inferPlanAnchor(months);
  const index = new Map<string, PlannedDay>();

  if (!anchor) return index;

  for (const month of months) {
    const parsed = parseMonthDate(month);
    for (const week of month.weeks) {
      for (const day of week.days) {
        const date = dateForPlannedDay(week.index, day.key, anchor);
        if (!date) continue;

        const key = isoKey(date);
        const existing = index.get(key);
        const belongsToThisMonth =
          parsed &&
          parsed.year === date.getFullYear() &&
          parsed.monthIndex === date.getMonth();

        if (!existing || belongsToThisMonth) {
          index.set(key, { month, week: week.index, day, date });
        }
      }
    }
  }

  return index;
}

function buildCalendarWeeks(year: number, monthIndex: number) {
  const first = new Date(year, monthIndex, 1);
  const last = new Date(year, monthIndex + 1, 0);
  const monday = addDays(first, -((first.getDay() + 6) % 7));
  const sunday = addDays(last, 6 - ((last.getDay() + 6) % 7));
  const weeks: Date[][] = [];

  for (let cursor = monday; cursor <= sunday; cursor = addDays(cursor, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, offset) => addDays(cursor, offset)));
  }

  return weeks;
}

function dateLabel(date: Date | null) {
  if (!date) return "";
  return new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short" })
    .format(date)
    .replace(".", "")
    .toUpperCase();
}

function isSameDate(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function CalendarPage() {
  const { data: planning } = usePlanning();
  const { data: results = [] } = useAllResults();
  const [idx, setIdx] = useState(0);
  const initialized = useRef(false);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const months = planning?.data.months ?? [];

  useEffect(() => {
    if (initialized.current || months.length === 0) return;
    initialized.current = true;
    setIdx(getInitialMonthIndex(months));
  }, [months]);

  useEffect(() => {
    const month = months[idx];
    if (month) window.localStorage.setItem(CALENDAR_MONTH_KEY, month.key);
  }, [idx, months]);

  const month = months[Math.min(idx, months.length - 1)];

  const goPrev = useCallback(() => setIdx((i) => Math.max(0, i - 1)), []);
  const goNext = useCallback(() => setIdx((i) => Math.min(months.length - 1, i + 1)), [months.length]);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, []);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const start = touchStart.current;
    const dx = e.changedTouches[0].clientX - start.x;
    const dy = e.changedTouches[0].clientY - start.y;
    touchStart.current = null;
    if (Math.abs(dx) < 50 || Math.abs(dy) > Math.abs(dx)) return;
    if (dx > 0) goPrev(); else goNext();
  }, [goPrev, goNext]);

  const blockMap = useMemo(() => completedBlockMap(results), [results]);
  const today = new Date();

  if (!planning || !month) {
    return (
      <div className="glass glass-sheen p-6 text-center">
        <p className="text-sm text-muted-foreground">Importa primero tu planificación.</p>
      </div>
    );
  }

  const weekdayLabels = ["LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB", "DOM"];
  const parsedMonth = parseMonthDate(month);
  const planIndex = useMemo(() => buildPlanDateIndex(months), [months]);
  const calendarWeeks = parsedMonth
    ? buildCalendarWeeks(parsedMonth.year, parsedMonth.monthIndex)
    : [];

  return (
    <div className="page-enter select-none" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <div className="glass glass-sheen rise rise-1 flex items-center justify-between gap-2 p-2.5">
        <button onClick={goPrev} className="tap pressable grid h-11 w-11 place-items-center rounded-[14px] text-muted-foreground hover:text-foreground disabled:opacity-25" disabled={idx === 0} aria-label="Mes anterior">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 text-center">
          <p className="eyebrow">PLANIFICACIÓN</p>
          <h1 className="mt-1 truncate text-xl font-semibold tracking-tight">{month.label}</h1>
        </div>
        <button onClick={goNext} className="tap pressable grid h-11 w-11 place-items-center rounded-[14px] text-muted-foreground hover:text-foreground disabled:opacity-25" disabled={idx === months.length - 1} aria-label="Mes siguiente">
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <button
          onClick={() => setIdx(findMonthIndexForDate(months))}
          className="pressable inline-flex min-h-[40px] items-center gap-2 rounded-full border border-[rgba(216,180,107,0.35)] bg-[rgba(216,180,107,0.10)] px-4 text-xs font-semibold text-gold"
        >
          <Calendar className="h-3.5 w-3.5" />
          Ir a hoy
        </button>
        <span className="text-[10px] text-muted-foreground/70">Desliza para cambiar</span>
      </div>

      <div className="mt-5 grid grid-cols-7 gap-1.5 px-1">
        {weekdayLabels.map((label) => (
          <div key={label} className="text-center text-[9px] font-bold tracking-[0.12em] text-muted-foreground/65">
            {label}
          </div>
        ))}
      </div>

      <div className="mt-2 space-y-3">
        {calendarWeeks.map((weekDates, wi) => {
          const planned = weekDates.map((date) => planIndex.get(isoKey(date)) ?? null);
          const weekPlans = planned.filter((value): value is PlannedDay => !!value);
          const planWeek =
            weekPlans.find((value) => value.month.key === month.key)?.week ??
            weekPlans[0]?.week ??
            null;
          const trainDays = weekPlans.filter((value) => !value.day.isRest);
          const doneCount = trainDays.filter((value) =>
            isSessionCompleted(value.day, value.month.key, value.week, blockMap),
          ).length;
          const pct = trainDays.length ? Math.round((doneCount / trainDays.length) * 100) : 0;

          return (
            <section key={isoKey(weekDates[0])} className={`rise rise-${Math.min(wi + 1, 5)}`}>
              <div className="mb-1.5 flex items-center justify-between px-1">
                <span className="eyebrow">{planWeek ? `SEMANA ${planWeek}` : "CALENDARIO"}</span>
                {trainDays.length > 0 && (
                  <span className="text-[10px] font-semibold tabular text-muted-foreground">
                    {doneCount}/{trainDays.length}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-7 gap-1.5">
                {weekDates.map((date) => {
                  const key = isoKey(date);
                  const plannedDay = planIndex.get(key);
                  const inMonth =
                    date.getMonth() === parsedMonth?.monthIndex &&
                    date.getFullYear() === parsedMonth?.year;
                  const d = plannedDay?.day;
                  const prog = plannedDay
                    ? sessionProgress(plannedDay.day, plannedDay.month.key, plannedDay.week, blockMap)
                    : null;
                  const done = prog?.state === "completed";
                  const partial = prog?.state === "in_progress";
                  const isToday = isSameDate(date, today);
                  const headline = !d
                    ? "SIN PLAN"
                    : d.isRest
                      ? "DESCANSO"
                      : (d.blocks.find((b) => /^[A-D]$/.test(b.key))?.content.split("\n")[0] ??
                        d.blocks[0]?.content.split("\n")[0] ??
                        "Entreno");

                  const cell = (
                    <div
                      className={[
                        "min-h-[112px] rounded-[16px] border p-2 transition-all",
                        !inMonth
                          ? "border-transparent bg-transparent opacity-20"
                          : d?.isRest
                            ? "glass-quiet opacity-70"
                            : d
                              ? "glass glass-sheen"
                              : "glass-quiet opacity-45",
                        done ? "border-[rgba(216,180,107,0.48)] bg-[rgba(216,180,107,0.10)]" : "",
                        isToday ? "ring-1 ring-[rgba(216,180,107,0.9)]" : "",
                      ].join(" ")}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <span className={`text-[16px] font-bold tabular ${isToday ? "text-gold" : inMonth ? "text-foreground" : "text-muted-foreground"}`}>
                          {date.getDate()}
                        </span>
                        {inMonth && d && (
                          done ? (
                            <span className="gold-gradient grid h-5 w-5 place-items-center rounded-full">
                              <Check className="h-3 w-3" strokeWidth={2.7} />
                            </span>
                          ) : d.isRest ? (
                            <Moon className="h-3.5 w-3.5 text-muted-foreground/65" strokeWidth={1.8} />
                          ) : partial ? (
                            <span className="text-[8px] font-bold tabular text-gold">{prog?.done}/{prog?.total}</span>
                          ) : (
                            <Circle className="h-3.5 w-3.5 text-muted-foreground/35" strokeWidth={1.8} />
                          )
                        )}
                      </div>

                      {inMonth && (
                        <>
                          <p className={`mt-0.5 text-[8px] font-semibold uppercase tracking-[0.08em] ${isToday ? "text-gold" : "text-muted-foreground/60"}`}>
                            {dateLabel(date)}
                          </p>

                          <p className="mt-2 line-clamp-3 text-[10px] font-semibold leading-[1.25] text-foreground/90">
                            {headline}
                          </p>

                          {d && !d.isRest && (
                            <p className="mt-1 text-[8px] text-muted-foreground/65">
                              {prog?.done ?? 0}/{prog?.total ?? 0} bloques
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  );

                  if (!plannedDay || !inMonth) return <div key={key}>{cell}</div>;

                  return (
                    <Link
                      key={key}
                      to="/workout/$month/$week/$day"
                      params={{
                        month: plannedDay.month.key,
                        week: String(plannedDay.week),
                        day: plannedDay.day.key,
                      }}
                      aria-label={`${plannedDay.day.key} ${dateLabel(date)}${plannedDay.day.isRest ? ", descanso" : ""}`}
                      className="block min-w-0"
                    >
                      {cell}
                    </Link>
                  );
                })}
              </div>

              <div className="mt-2 h-[2px] w-full overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.08)" }}>
                <div
                  className="h-full rounded-full transition-[width] duration-700"
                  style={{ width: `${pct}%`, background: "linear-gradient(90deg,#EBD6A6,#D8B46B)" }}
                />
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
