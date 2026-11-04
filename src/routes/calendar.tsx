import { createFileRoute, Link } from "@tanstack/react-router";
import { usePlanning, useAllResults, useUpdatePlanningData } from "@/lib/store";
import { getCurrentUserId } from "@/lib/pin-gate";
import { dayRefFor, moveDay, shiftDays } from "@/lib/plan-move";
import { toast } from "sonner";
import type { Planning } from "@/lib/excel-parser";
import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { ChevronLeft, ChevronRight, Check, Circle, Moon, Calendar, GripVertical, Minus, Plus, Move } from "lucide-react";
import type { Month } from "@/lib/excel-parser";
import { completedBlockMap, isSessionCompleted, sessionProgress } from "@/lib/session-progress";
import { PageSkeleton } from "@/components/PageSkeleton";
import { addDays, buildPlanDateIndex, isoKey, parseMonthDate, type PlannedDay } from "@/lib/plan-dates";
import { findMonthIndexForDate as findPlanMonthIndex } from "@/lib/plan-dates";


const CALENDAR_MONTH_KEY = "malitos_calendar_month_key";
const CALENDAR_VIEW_KEY = "rmordie_calendar_view";
type CalendarView = "semana" | "mes";

function readView(): CalendarView {
  try {
    return window.localStorage.getItem(CALENDAR_VIEW_KEY) === "mes" ? "mes" : "semana";
  } catch {
    return "semana";
  }
}

function mondayOf(date: Date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return addDays(d, -((d.getDay() + 6) % 7));
}

function dayHeadline(d: PlannedDay["day"] | undefined) {
  if (!d) return "Sin plan";
  if (d.isRest) return "Descanso";
  return (
    d.blocks.find((b) => /^[A-D]$/.test(b.key))?.content.split("\n")[0] ??
    d.blocks[0]?.content.split("\n")[0] ??
    "Entreno"
  );
}

const MONTH_ABBR: Record<number, string> = {
  0: "ENE", 1: "FEB", 2: "MAR", 3: "ABR", 4: "MAY", 5: "JUN",
  6: "JUL", 7: "AGO", 8: "SEP", 9: "OCT", 10: "NOV", 11: "DIC",
};

function getCurrentMonthAbbr() {
  return MONTH_ABBR[new Date().getMonth()];
}

function findMonthIndexForDate(months: Month[]) {
  const idx = findPlanMonthIndex(months, new Date());
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
  const { data: planning, isLoading } = usePlanning();
  const updatePlan = useUpdatePlanningData();
  const canMove = !!planning && planning.user_id === getCurrentUserId();
  const [moveMode, setMoveMode] = useState(false);
  const [selectedIso, setSelectedIso] = useState<string | null>(null);
  const [shiftOpen, setShiftOpen] = useState(false);

  const applyPlan = useCallback((next: Planning, message: string) => {
    if (!planning) return;
    const prev = planning.data;
    updatePlan.mutate(
      { planningId: planning.id, data: next },
      { onError: (e) => toast.error((e as { message?: string })?.message ?? "No se pudo mover") },
    );
    toast.success(message, {
      action: { label: "Deshacer", onClick: () => updatePlan.mutate({ planningId: planning.id, data: prev }) },
      duration: 6000,
    });
  }, [planning, updatePlan]);

  const pickDay = useCallback((iso: string) => {
    if (!planning) return;
    if (!selectedIso) {
      if (!dayRefFor(planning.data, iso)) return toast("Ese día no tiene nada del plan. Elige un día con entreno o descanso.");
      setSelectedIso(iso);
      return;
    }
    if (iso === selectedIso) return setSelectedIso(null);
    const ref = dayRefFor(planning.data, selectedIso);
    setSelectedIso(null);
    if (!ref) return;
    const fmtD = (x: string) => new Date(`${x}T12:00:00`).toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" });
    applyPlan(moveDay(planning.data, ref, iso), `Movido del ${fmtD(selectedIso)} al ${fmtD(iso)}`);
  }, [planning, selectedIso, applyPlan]);

  const dropDay = useCallback((fromIso: string, toIso: string) => {
    if (!planning || fromIso === toIso) return;
    const ref = dayRefFor(planning.data, fromIso);
    if (!ref) return;
    const fmtD = (x: string) => new Date(`${x}T12:00:00`).toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" });
    applyPlan(moveDay(planning.data, ref, toIso), `Movido del ${fmtD(fromIso)} al ${fmtD(toIso)}`);
  }, [planning, applyPlan]);
  const { data: results = [] } = useAllResults();
  const [idx, setIdx] = useState(0);
  const [view, setView] = useState<CalendarView>("semana");
  const [weekStart, setWeekStart] = useState<Date>(() => mondayOf(new Date()));
  useEffect(() => { setView(readView()); }, []);
  const changeView = useCallback((v: CalendarView) => {
    setView(v);
    try { window.localStorage.setItem(CALENDAR_VIEW_KEY, v); } catch { /* sin almacenamiento */ }
  }, []);
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
    if (moveMode) { touchStart.current = null; return; }
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, []);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const start = touchStart.current;
    const dx = e.changedTouches[0].clientX - start.x;
    const dy = e.changedTouches[0].clientY - start.y;
    touchStart.current = null;
    if (Math.abs(dx) < 50 || Math.abs(dy) > Math.abs(dx)) return;
    if (view === "semana") setWeekStart((w) => addDays(w, dx > 0 ? -7 : 7));
    else if (dx > 0) goPrev(); else goNext();
  }, [goPrev, goNext, view, moveMode]);

  const blockMap = useMemo(() => completedBlockMap(results), [results]);
  // Debe calcularse antes de cualquier return: si un hook se ejecuta solo
  // cuando ya hay planificación, React falla al llegar los datos tarde.
  const planIndex = useMemo(() => buildPlanDateIndex(months), [months]);
  const today = new Date();

  if (isLoading && !planning) {
    return <PageSkeleton label="Cargando calendario" variant="calendar" />;
  }

  if (!planning || !month) {
    return (
      <div className="glass glass-sheen p-6 text-center">
        <p className="text-sm text-muted-foreground">Importa primero tu planificación.</p>
      </div>
    );
  }

  const weekdayLabels = ["LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB", "DOM"];
  const parsedMonth = parseMonthDate(month);
  const calendarWeeks = parsedMonth
    ? buildCalendarWeeks(parsedMonth.year, parsedMonth.monthIndex)
    : [];

  const viewSwitch = (
    <div role="group" aria-label="Vista del calendario" className="flex shrink-0 gap-1 rounded-[14px] bg-white/[0.06] p-1">
      {(["semana", "mes"] as const).map((v) => (
        <button
          key={v}
          type="button"
          aria-pressed={view === v}
          onClick={() => changeView(v)}
          className={`min-h-10 rounded-[10px] px-3.5 text-sm font-bold ${view === v ? "bg-[color:var(--gold)] text-[color:var(--gold-foreground)]" : "text-muted-foreground"}`}
        >
          {v === "semana" ? "Semana" : "Mes"}
        </button>
      ))}
    </div>
  );

  if (view === "semana") {
    return (
      <div className="page-enter select-none" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <WeekView
          weekStart={weekStart}
          planIndex={planIndex}
          blockMap={blockMap}
          today={today}
          viewSwitch={viewSwitch}
          onPrev={() => setWeekStart((w) => addDays(w, -7))}
          onNext={() => setWeekStart((w) => addDays(w, 7))}
          onToday={() => setWeekStart(mondayOf(new Date()))}
          move={{
            active: moveMode,
            selected: selectedIso,
            onToggle: () => {
              if (!canMove) {
                toast.error(planning.user_id
                  ? "Este plan es de otro atleta: solo puedes mover días de tu propio plan."
                  : "Este es el plan compartido del box y no se puede mover. Súbelo o créalo como tuyo en Plan → Importar y podrás moverlo.", { duration: 8000 });
                return;
              }
              setMoveMode((v) => !v); setSelectedIso(null);
            },
            onPick: pickDay,
            onDrop: dropDay,
            onShift: () => setShiftOpen(true),
          }}
        />
        {shiftOpen && planning && (
          <ShiftSheet
            planning={planning.data}
            fromIso={selectedIso}
            onClose={() => setShiftOpen(false)}
            onApply={(days, fromIso) => {
              setShiftOpen(false);
              setSelectedIso(null);
              const n = Math.abs(days);
              applyPlan(shiftDays(planning.data, days, fromIso ?? undefined), `${fromIso ? "Desde ese día, el plan" : "Todo el plan"} se ${days > 0 ? "retrasa" : "adelanta"} ${n} día${n === 1 ? "" : "s"}`);
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="page-enter select-none" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => { changeView("semana"); if (canMove) setMoveMode(true); else toast.error("Solo puedes mover días de tu propio plan."); }}
          className="inline-flex min-h-11 items-center gap-2 rounded-[14px] bg-white/[0.06] px-3.5 text-sm font-bold"
        >
          <Move className="h-4 w-4" /> Mover días
        </button>
        {viewSwitch}
      </div>
      <div className="glass glass-sheen rise rise-1 flex items-center justify-between gap-2 p-2.5">
        <button onClick={goPrev} className="tap pressable grid h-11 w-11 place-items-center rounded-[14px] text-muted-foreground hover:text-foreground disabled:opacity-25" disabled={idx === 0} aria-label="Mes anterior">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 text-center">
          <p className="eyebrow">PLANIFICACIÓN</p>
          <h1 className="page-title mt-1 truncate" style={{ fontSize: "2rem" }}>{month.label} {parseMonthDate(month)?.year ?? ""}</h1>
        </div>
        <button onClick={goNext} className="tap pressable grid h-11 w-11 place-items-center rounded-[14px] text-muted-foreground hover:text-foreground disabled:opacity-25" disabled={idx === months.length - 1} aria-label="Mes siguiente">
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <button
          onClick={() => setIdx(findMonthIndexForDate(months))}
          className="pressable inline-flex min-h-[40px] items-center gap-2 rounded-full border border-[rgba(200,179,138,0.35)] bg-[rgba(200,179,138,0.10)] px-4 text-xs font-semibold text-gold"
        >
          <Calendar className="h-3.5 w-3.5" />
          Ir a hoy
        </button>
        <span className="text-xs text-muted-foreground/70">Desliza para cambiar</span>
      </div>

      <div className="mt-5 grid grid-cols-7 gap-1.5 px-1">
        {weekdayLabels.map((label) => (
          <div key={label} className="text-center text-[11px] font-bold tracking-[0.12em] text-muted-foreground/65">
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
                  <span className="text-xs font-semibold tabular text-muted-foreground">
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
                  const headline = dayHeadline(d);

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
                        done ? "border-[rgba(200,179,138,0.48)] bg-[rgba(200,179,138,0.10)]" : "",
                        isToday ? "ring-1 ring-[rgba(200,179,138,0.9)]" : "",
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
                            <span className="text-[11px] font-bold tabular text-gold">{prog?.done}/{prog?.total}</span>
                          ) : (
                            <Circle className="h-3.5 w-3.5 text-muted-foreground/35" strokeWidth={1.8} />
                          )
                        )}
                      </div>

                      {inMonth && (
                        <>
                          <p className={`mt-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] ${isToday ? "text-gold" : "text-muted-foreground/60"}`}>
                            {dateLabel(date)}
                          </p>

                          <p className="mt-2 line-clamp-3 text-xs font-semibold leading-[1.25] text-foreground/90">
                            {headline}
                          </p>

                          {d && !d.isRest && (
                            <p className="mt-1 text-[11px] text-muted-foreground/65">
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
                  style={{ width: `${pct}%`, background: "linear-gradient(90deg,#E8DDC8,#C8B38A)" }}
                />
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

const WEEKDAY_SHORT = ["LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB", "DOM"];

/** Vista por defecto en el móvil: la semana como lista, un día por fila. */
type MoveProps = {
  active: boolean;
  selected: string | null;
  onToggle: () => void;
  onPick: (iso: string) => void;
  onDrop: (fromIso: string, toIso: string) => void;
  onShift: () => void;
};

function WeekView({
  weekStart, planIndex, blockMap, today, viewSwitch, onPrev, onNext, onToday, move,
}: {
  move: MoveProps | null;
  weekStart: Date;
  planIndex: Map<string, PlannedDay>;
  blockMap: ReturnType<typeof completedBlockMap>;
  today: Date;
  viewSwitch: React.ReactNode;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const planned = days.map((date) => planIndex.get(isoKey(date)));
  const train = planned.filter((p): p is PlannedDay => !!p && !p.day.isRest);
  const done = train.filter((p) => isSessionCompleted(p.day, p.month.key, p.week, blockMap)).length;
  const planWeek = planned.find((p) => !!p)?.week ?? null;
  const mid = addDays(weekStart, 3);
  const monthName = new Intl.DateTimeFormat("es-ES", { month: "long" }).format(mid).toUpperCase();
  const fmt = (d: Date) => new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short" }).format(d).replace(".", "");
  const isCurrentWeek = isSameDate(weekStart, mondayOf(today));
  const moving = !!move?.active;
  const [drag, setDrag] = useState<{ from: string; over: string | null } | null>(null);

  function overAt(x: number, y: number) {
    const el = document.elementFromPoint(x, y) as HTMLElement | null;
    return el?.closest<HTMLElement>("[data-date]")?.dataset.date ?? null;
  }

  return (
    <div>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow">PLANIFICACIÓN · {mid.getFullYear()}</p>
          <h1 className="page-title mt-1 truncate">{monthName}</h1>
        </div>
        {viewSwitch}
      </div>

      <div className="mt-4 flex items-center justify-between gap-2">
        <button type="button" onClick={onPrev} aria-label="Semana anterior" className="pressable grid h-11 w-11 place-items-center rounded-full bg-white/[0.06]">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 text-center">
          <p className="text-base font-bold">{planWeek ? `Semana ${planWeek}` : "Semana"}</p>
          <p className="text-[13px] text-muted-foreground">
            {fmt(days[0])} – {fmt(days[6])}{train.length > 0 ? ` · ${done} de ${train.length} hechos` : ""}
          </p>
        </div>
        <button type="button" onClick={onNext} aria-label="Semana siguiente" className="pressable grid h-11 w-11 place-items-center rounded-full bg-white/[0.06]">
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {move && (
        <div className={`mt-3 rounded-[16px] ${moving ? "border border-[color:var(--gold)]/40 bg-[color:var(--gold)]/[0.08] p-3" : ""}`}>
          {moving ? (
            <>
              <p className="text-sm font-bold">
                {move.selected ? "Ahora toca el día al que lo quieres llevar" : "Arrastra un día con ⋮⋮ o tócalo para elegirlo"}
              </p>
              <p className="mt-0.5 text-[13px] text-muted-foreground">
                {move.selected ? "Puedes cambiar de semana con las flechas. Si allí hay otro día, se intercambian." : "Tus registros van con el día: no se pierde nada."}
              </p>
              <div className="mt-2.5 flex gap-2">
                <button type="button" onClick={move.onShift} className="min-h-11 flex-1 rounded-[12px] bg-white/[0.08] text-sm font-bold">
                  {move.selected ? "Mover desde este día…" : "Mover todo el plan…"}
                </button>
                <button type="button" onClick={move.onToggle} className="gold-gradient min-h-11 rounded-[12px] px-4 text-sm font-extrabold">Hecho</button>
              </div>
            </>
          ) : (
            <button type="button" onClick={move.onToggle} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-[14px] bg-white/[0.06] text-sm font-bold">
              <Move className="h-4 w-4" /> Mover días del plan
            </button>
          )}
        </div>
      )}

      {!isCurrentWeek && (
        <div className="mt-3 flex justify-center">
          <button type="button" onClick={onToday} className="pressable inline-flex min-h-11 items-center gap-2 rounded-full border border-[color:var(--gold)]/35 bg-[color:var(--gold)]/10 px-4 text-sm font-semibold text-gold">
            <Calendar className="h-4 w-4" /> Ir a esta semana
          </button>
        </div>
      )}

      <div className="mt-4 space-y-2">
        {moving && days.map((date, i) => {
          const iso = isoKey(date);
          const p = planned[i];
          const rest = !p || p.day.isRest;
          const isSel = move?.selected === iso || drag?.from === iso;
          const isOver = !!drag && drag.over === iso && drag.from !== iso;
          return (
            <div
              key={iso}
              data-date={iso}
              className={`flex min-h-16 items-center gap-3 rounded-[18px] px-3 transition-colors ${isSel ? "bg-[color:var(--gold)]/20 ring-2 ring-[color:var(--gold)]" : isOver ? "bg-white/[0.12] ring-2 ring-white/40" : rest ? "border border-dashed border-white/12" : "bg-white/[0.045]"}`}
            >
              <button type="button" onClick={() => move?.onPick(iso)} className="flex min-h-16 min-w-0 flex-1 items-center gap-3 text-left">
                <span className="w-11 shrink-0 text-center">
                  <span className="block text-[26px] font-extrabold leading-none" style={{ fontFamily: "var(--font-editorial)" }}>{date.getDate()}</span>
                  <span className="text-xs text-muted-foreground">{WEEKDAY_SHORT[i]}</span>
                </span>
                <span className={`min-w-0 flex-1 truncate text-[15px] ${rest ? "text-muted-foreground" : "font-semibold"}`}>
                  {p ? (p.day.isRest ? "Descanso" : dayHeadline(p.day)) : "Sin plan"}
                </span>
              </button>
              {p && (
                <span
                  role="button"
                  aria-label={`Arrastrar el día ${date.getDate()}`}
                  className="grid h-12 w-10 shrink-0 cursor-grab place-items-center text-muted-foreground"
                  style={{ touchAction: "none" }}
                  onPointerDown={(e) => { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); setDrag({ from: iso, over: iso }); }}
                  onPointerMove={(e) => { if (drag) setDrag({ from: drag.from, over: overAt(e.clientX, e.clientY) }); }}
                  onPointerUp={(e) => { const to = overAt(e.clientX, e.clientY); const from = drag?.from; setDrag(null); if (from && to && to !== from) move?.onDrop(from, to); }}
                  onPointerCancel={() => setDrag(null)}
                >
                  <GripVertical className="h-5 w-5" />
                </span>
              )}
            </div>
          );
        })}
        {!moving && days.map((date, i) => {
          const p = planned[i];
          const isToday = isSameDate(date, today);
          const prog = p ? sessionProgress(p.day, p.month.key, p.week, blockMap) : null;
          const isDone = prog?.state === "completed";
          const partial = prog?.state === "in_progress";
          const rest = !p || p.day.isRest;
          const dateBox = (
            <span className="w-12 shrink-0 text-center">
              <span className={`block text-[30px] font-extrabold leading-none ${isToday ? "text-[color:var(--gold-soft)]" : isDone ? "text-muted-foreground" : ""}`} style={{ fontFamily: "var(--font-editorial)" }}>{date.getDate()}</span>
              <span className={`text-xs ${isToday ? "font-bold text-gold" : "text-muted-foreground"}`}>{isToday ? "HOY" : WEEKDAY_SHORT[i]}</span>
            </span>
          );
          if (rest) {
            return (
              <div key={i} className="flex min-h-14 items-center gap-3.5 px-3.5 text-muted-foreground">
                {dateBox}
                <span className="flex-1 text-[15px]">{p ? "Descanso" : "Sin plan"}</span>
                {p && <Moon className="h-4 w-4" strokeWidth={1.8} />}
              </div>
            );
          }
          return (
            <Link
              key={i}
              to="/workout/$month/$week/$day"
              params={{ month: p.month.key, week: String(p.week), day: p.day.key }}
              className={`pressable flex min-h-[72px] items-center gap-3.5 rounded-[18px] px-3.5 ${isToday ? "border-[1.5px] border-[color:var(--gold)] bg-[color:var(--gold)]/8" : "bg-white/[0.045]"}`}
            >
              {dateBox}
              <span className="min-w-0 flex-1">
                <span className={`block truncate text-[15px] ${isToday ? "font-bold" : "font-semibold"}`}>{dayHeadline(p.day)}</span>
                <span className={`block text-[13px] ${isToday ? "text-gold" : "text-muted-foreground"}`}>
                  {isDone ? `${prog?.total ?? 0}/${prog?.total ?? 0} bloques` : partial ? `${prog?.done}/${prog?.total} bloques · sigue` : `${prog?.total ?? p.day.blocks.length} bloques`}
                </span>
              </span>
              {isDone ? (
                <span aria-label="Hecho" className="gold-gradient grid h-7 w-7 shrink-0 place-items-center rounded-full"><Check className="h-4 w-4" strokeWidth={3} /></span>
              ) : partial ? (
                <span aria-label="A medias" className="h-7 w-7 shrink-0 rounded-full border-2 border-[color:var(--gold)]" style={{ background: "linear-gradient(90deg, var(--gold) 50%, transparent 50%)" }} />
              ) : (
                <span aria-label="Pendiente" className="h-7 w-7 shrink-0 rounded-full border-2 border-white/25" />
              )}
            </Link>
          );
        })}
      </div>

      <p className="mt-4 text-center text-[13px] text-muted-foreground">Desliza a los lados para cambiar de semana</p>
    </div>
  );
}

function ShiftSheet({
  planning, fromIso, onClose, onApply,
}: {
  planning: Planning;
  fromIso: string | null;
  onClose: () => void;
  onApply: (days: number, fromIso: string | null) => void;
}) {
  const [scope, setScope] = useState<"todo" | "desde">(fromIso ? "desde" : "todo");
  const [days, setDays] = useState(7);
  const partial = scope === "desde" && !!fromIso;
  const firstIso = useMemo(() => {
    const keys = [...buildPlanDateIndex(planning.months).keys()].sort();
    return partial ? keys.find((k) => k >= fromIso!) ?? null : keys[0] ?? null;
  }, [planning, partial, fromIso]);
  const fmtD = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
  const target = firstIso ? isoKey(addDays(new Date(`${firstIso}T12:00:00`), days)) : null;
  const min = partial ? 1 : -60;

  return (
    <div className="fixed inset-0 z-[60] flex items-end bg-black/60" onClick={onClose}>
      <div
        role="dialog"
        aria-label="Mover el plan"
        className="w-full rounded-t-[24px] bg-[#151412] border-t border-white/10 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-[28px] font-extrabold leading-none" style={{ fontFamily: "var(--font-editorial)" }}>MOVER EL PLAN</h2>
        {fromIso && (
          <div className="mt-4 grid grid-cols-2 gap-2">
            {(["desde", "todo"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => { setScope(s); if (s === "desde" && days < 1) setDays(1); }}
                className={`min-h-12 rounded-[12px] text-sm font-bold ${scope === s ? "gold-gradient" : "bg-white/[0.06]"}`}
              >
                {s === "desde" ? "Desde este día" : "Todo el plan"}
              </button>
            ))}
          </div>
        )}
        <p className="mt-4 text-[13px] text-muted-foreground">
          {days >= 0 ? "Retrasar" : "Adelantar"} {Math.abs(days)} día{Math.abs(days) === 1 ? "" : "s"}
        </p>
        <div className="mt-1.5 flex h-14 items-center justify-between rounded-[14px] border border-white/15 bg-white/[0.06] px-2">
          <button type="button" aria-label="Un día menos" onClick={() => setDays((d) => Math.max(min, d - 1))} className="grid h-12 w-12 place-items-center"><Minus className="h-5 w-5" /></button>
          <span className="text-[32px] font-extrabold" style={{ fontFamily: "var(--font-editorial)" }}>{days > 0 ? `+${days}` : days}</span>
          <button type="button" aria-label="Un día más" onClick={() => setDays((d) => Math.min(60, d + 1))} className="grid h-12 w-12 place-items-center"><Plus className="h-5 w-5" /></button>
        </div>
        <div className="mt-2 flex gap-2">
          {[1, 7, 14].map((n) => (
            <button key={n} type="button" onClick={() => setDays(n)} className="min-h-10 flex-1 rounded-[10px] bg-white/[0.06] text-[13px] font-bold">
              +{n === 1 ? "1 día" : `${n / 7} sem`}
            </button>
          ))}
          {!partial && (
            <button type="button" onClick={() => setDays(-7)} className="min-h-10 flex-1 rounded-[10px] bg-white/[0.06] text-[13px] font-bold">−1 sem</button>
          )}
        </div>
        {firstIso && target && days !== 0 && (
          <p className="mt-4 text-sm">
            {partial ? "El día elegido" : "El primer día"} pasa del <b>{fmtD(firstIso)}</b> al <b className="text-[color:var(--gold)]">{fmtD(target)}</b>
            {partial ? ", y todo lo que viene después se mueve igual." : ", y todo lo demás se mueve igual."}
          </p>
        )}
        <p className="mt-1 text-[13px] text-muted-foreground">Tus registros siguen con cada entreno.</p>
        <div className="mt-5 flex gap-2">
          <button type="button" onClick={onClose} className="min-h-12 flex-1 rounded-[14px] bg-white/[0.08] font-bold">Cancelar</button>
          <button type="button" disabled={days === 0} onClick={() => onApply(days, partial ? fromIso : null)} className="gold-gradient min-h-12 flex-[2] rounded-[14px] font-extrabold disabled:opacity-40">Mover</button>
        </div>
      </div>
    </div>
  );
}
