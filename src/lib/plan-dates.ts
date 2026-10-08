/**
 * Fechas reales de cada día de la planificación.
 *
 * Compartido por el calendario (navegador) y por los avisos programados
 * (servidor), para que ambos coloquen cada sesión en el mismo día.
 */
import type { Day, Month } from "@/lib/excel-parser";

export function parseMonthDate(month: Month): { year: number; monthIndex: number } | null {
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

export const WEEKDAY_MAP: Record<string, number> = {
  LUNES: 0, MARTES: 1, MIERCOLES: 2, MIÉRCOLES: 2,
  JUEVES: 3, VIERNES: 4, SABADO: 5, SÁBADO: 5, DOMINGO: 6,
};

export type PlannedDay = {
  month: Month;
  week: number;
  day: Day;
  date: Date;
};

export function isoKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

export function parseISODate(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function buildPlanDateIndex(months: Month[]) {
  const index = new Map<string, PlannedDay>();

  for (const month of months) {
    const parsed = parseMonthDate(month);
    if (!parsed) continue;

    const firstMonthDate = new Date(parsed.year, parsed.monthIndex, 1);
    const sortedWeeks = [...month.weeks].sort((a, b) => a.index - b.index);
    const firstWeek = sortedWeeks[0];
    if (!firstWeek) continue;

    // Prefer the exact date saved by the importer. Older planning versions may
    // not have Day.date, so derive dates from THIS MONTH rather than using the
    // first month of the whole planning as a global anchor.
    const exactEntries: Array<{ week: number; day: Day; date: Date }> = [];

    for (const week of sortedWeeks) {
      for (const day of week.days) {
        const exactDate = day.date ? parseISODate(day.date) : null;
        if (exactDate) {
          exactEntries.push({ week: week.index, day, date: exactDate });
        }
      }
    }

    if (exactEntries.length > 0) {
      for (const entry of exactEntries) {
        const key = isoKey(entry.date);
        const existing = index.get(key);
        if (!existing || existing.month.key === month.key) {
          index.set(key, { month, week: entry.week, day: entry.day, date: entry.date });
        }
      }
      continue;
    }

    const firstPlannedDay =
      firstWeek.days.find((day) => !day.isRest) ??
      firstWeek.days.find(Boolean);
    if (!firstPlannedDay) continue;

    const firstWeekday = WEEKDAY_MAP[firstPlannedDay.key.toUpperCase()];
    if (firstWeekday == null) continue;

    // Put the first real day of week 1 on its actual calendar weekday.
    const firstWeekAnchor = addDays(
      firstMonthDate,
      (firstWeekday - firstMonthDate.getDay() + 7) % 7,
    );
    const firstWeekMonday = addDays(firstWeekAnchor, -((firstWeekAnchor.getDay() + 6) % 7));

    for (const week of sortedWeeks) {
      for (const day of week.days) {
        const weekday = WEEKDAY_MAP[day.key.toUpperCase()];
        if (weekday == null) continue;

        let date: Date;
        if (week.index === firstWeek.index) {
          date = addDays(firstWeekMonday, weekday);
        } else {
          const weekOffset = week.index - firstWeek.index - 1;
          date = addDays(firstWeekMonday, 7 * (weekOffset + 1) + weekday);
        }

        if (date.getFullYear() !== parsed.year || date.getMonth() !== parsed.monthIndex) continue;

        const key = isoKey(date);
        const existing = index.get(key);
        if (!existing || existing.month.key === month.key) {
          index.set(key, { month, week: week.index, day, date });
        }
      }
    }
  }

  return index;
}
