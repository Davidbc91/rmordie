/**
 * Importación de planificaciones genéricas (.xlsx / .csv).
 *
 * Lee una tabla de filas con cabeceras arbitrarias, intenta identificar las
 * columnas (día, fecha, ejercicio, series, reps, %RM, carga, tiempo, distancia,
 * bloque, semana) y produce filas revisables. Solo al confirmar se convierte a
 * la MISMA estructura interna de `planning` (Month → Week → Day → Block),
 * reutilizando la serialización de la planificación manual.
 *
 * No toca el importador Excel actual ni la creación manual.
 */
import * as XLSX from "xlsx";
import {
  BLOCK_TYPES,
  type BlockType,
  type ManualBlock,
  type ManualExercise,
  emptyExercise,
  serializeBlock,
  uid,
} from "./manual-plan";
import type { Planning } from "./excel-parser";

export const IMPORT_DAYS = ["LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES", "SABADO", "DOMINGO"] as const;

export type GenericField =
  | "day"
  | "date"
  | "week"
  | "block"
  | "exercise"
  | "sets"
  | "reps"
  | "percent"
  | "load"
  | "time"
  | "distance";

const norm = (s: unknown) =>
  String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9%]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");

/** Alias tolerantes a mayúsculas, acentos y separadores. */
const ALIASES: Record<GenericField, string[]> = {
  day: ["dia", "day", "dia semana", "weekday", "dia de la semana"],
  date: ["fecha", "date", "dia fecha", "fecha sesion"],
  week: ["semana", "week", "wk", "microciclo"],
  block: ["bloque", "block", "parte", "seccion", "section", "tipo", "type", "categoria", "category"],
  exercise: ["ejercicio", "exercise", "movement", "movimiento", "mov", "ejercicios"],
  sets: ["series", "sets", "n series", "num series"],
  reps: ["reps", "repeticiones", "rep", "repetitions", "reps serie"],
  percent: ["rm", "% rm", "%rm", "porcentaje", "percentage", "percent", "intensidad", "% 1rm", "1rm %"],
  load: ["carga", "peso", "load", "weight", "kg", "kilos"],
  time: ["tiempo", "time", "duracion", "duration", "min", "minutos"],
  distance: ["distancia", "distance", "metros", "km", "dist"],
};

export type ColumnMap = Partial<Record<GenericField, number>>;

export function detectColumns(header: unknown[]): ColumnMap {
  const map: ColumnMap = {};
  const normalized = header.map(norm);
  // Orden: campos más específicos primero para evitar colisiones ("% rm" vs "carga").
  const order: GenericField[] = [
    "percent",
    "exercise",
    "sets",
    "reps",
    "load",
    "time",
    "distance",
    "date",
    "week",
    "day",
    "block",
  ];
  const used = new Set<number>();
  for (const field of order) {
    const aliases = ALIASES[field];
    let found = -1;
    // 1) coincidencia exacta
    for (let i = 0; i < normalized.length; i++) {
      if (used.has(i) || !normalized[i]) continue;
      if (aliases.includes(normalized[i])) { found = i; break; }
    }
    // 2) coincidencia parcial
    if (found < 0) {
      for (let i = 0; i < normalized.length; i++) {
        if (used.has(i) || !normalized[i]) continue;
        if (aliases.some((a) => normalized[i].includes(a))) { found = i; break; }
      }
    }
    if (found >= 0) {
      map[field] = found;
      used.add(found);
    }
  }
  return map;
}

const DAY_ALIASES: Record<string, string> = {
  lunes: "LUNES", monday: "LUNES", lun: "LUNES", mon: "LUNES", l: "LUNES",
  martes: "MARTES", tuesday: "MARTES", mar: "MARTES", tue: "MARTES",
  miercoles: "MIERCOLES", wednesday: "MIERCOLES", mie: "MIERCOLES", wed: "MIERCOLES", x: "MIERCOLES",
  jueves: "JUEVES", thursday: "JUEVES", jue: "JUEVES", thu: "JUEVES",
  viernes: "VIERNES", friday: "VIERNES", vie: "VIERNES", fri: "VIERNES",
  sabado: "SABADO", saturday: "SABADO", sab: "SABADO", sat: "SABADO",
  domingo: "DOMINGO", sunday: "DOMINGO", dom: "DOMINGO", sun: "DOMINGO",
};

export function normalizeDay(v: unknown): string | null {
  const n = norm(v);
  if (!n) return null;
  return DAY_ALIASES[n] ?? (IMPORT_DAYS as readonly string[]).find((d) => norm(d) === n) ?? null;
}

/** Fecha desde texto (dd/mm/yyyy, yyyy-mm-dd) o serial de Excel. */
export function parseDate(v: unknown): Date | null {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v;
  if (typeof v === "number" && v > 20000 && v < 60000) {
    const d = XLSX.SSF.parse_date_code(v);
    if (d) return new Date(Date.UTC(d.y, d.m - 1, d.d));
  }
  const s = String(v ?? "").trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (m) return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (m) {
    const year = Number(m[3].length === 2 ? `20${m[3]}` : m[3]);
    return new Date(Date.UTC(year, Number(m[2]) - 1, Number(m[1])));
  }
  return null;
}

const DAY_FROM_INDEX = ["DOMINGO", "LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES", "SABADO"];

export function dayFromDate(d: Date): string {
  return DAY_FROM_INDEX[d.getUTCDay()];
}

function blockTypeFrom(value: string): BlockType {
  const n = norm(value);
  if (!n) return "OTRO";
  const direct = BLOCK_TYPES.find((t) => norm(t) === n || n.includes(norm(t)));
  if (direct) return direct;
  if (/strength|fuerza|squat|press/.test(n)) return "FUERZA";
  if (/weightlifting|halter|snatch|clean|jerk/.test(n)) return "HALTEROFILIA";
  if (/gym|gimnas|skill/.test(n)) return "GIMNASTICOS";
  if (/metcon|wod|amrap|emom|for time|conditioning/.test(n)) return "METCON";
  if (/cardio|run|row|bike|erg/.test(n)) return "CARDIO";
  if (/mobil|movil|stretch|estira/.test(n)) return "MOVILIDAD";
  return "OTRO";
}

export type ReviewRow = {
  id: string;
  sourceRow: number;
  day: string;          // "LUNES" | "" si no se pudo interpretar
  dateText: string;     // texto original de la fecha (informativo)
  week: number;
  block: string;        // etiqueta del bloque visible
  blockType: BlockType;
  exercise: string;
  sets: string;
  reps: string;
  percent: string;
  load: string;
  time: string;
  distance: string;
  raw: string;          // fila original (para "necesita revisión")
};

export type ParsedImport = {
  header: string[];
  columns: ColumnMap;
  rows: ReviewRow[];
  /** Campos esperados que no se han podido identificar en las cabeceras. */
  unmapped: GenericField[];
};

const cellText = (row: unknown[], idx: number | undefined) =>
  idx === undefined ? "" : String(row[idx] ?? "").trim();

function numText(row: unknown[], idx: number | undefined) {
  const raw = cellText(row, idx);
  if (!raw) return "";
  const m = raw.replace(",", ".").match(/-?\d+(\.\d+)?/);
  return m ? m[0] : raw;
}

/** ¿La fila necesita revisión manual? */
export function rowIssues(r: ReviewRow): string[] {
  const issues: string[] = [];
  if (!r.day) issues.push("Día sin identificar");
  if (!r.exercise.trim()) issues.push("Ejercicio vacío");
  if (r.percent && !(Number(r.percent.replace(",", ".")) > 0)) issues.push("% RM no numérico");
  if (r.load && !(Number(r.load.replace(",", ".")) > 0)) issues.push("Carga no numérica");
  return issues;
}

export function needsReview(r: ReviewRow): boolean {
  return rowIssues(r).length > 0;
}

function rowsFromWorkbook(wb: XLSX.WorkBook): unknown[][] {
  for (const name of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], {
      header: 1,
      defval: "",
      blankrows: false,
      raw: true,
    });
    if (rows.length >= 2) return rows;
  }
  return [];
}

/** Lee el archivo (sin guardar nada) y devuelve la interpretación revisable. */
export async function parseGenericFile(file: File): Promise<ParsedImport> {
  const isCsv = /\.csv$/i.test(file.name);
  const wb = isCsv
    ? XLSX.read(await file.text(), { type: "string", raw: false })
    : XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });

  const table = rowsFromWorkbook(wb);
  if (table.length < 2) throw new Error("El archivo no contiene una tabla con cabecera y filas de datos.");

  // Primera fila no vacía = cabecera
  let headerIdx = 0;
  while (headerIdx < table.length && (table[headerIdx] ?? []).every((c) => String(c ?? "").trim() === "")) headerIdx++;
  const headerRow = table[headerIdx] ?? [];
  const header = headerRow.map((c) => String(c ?? "").trim());
  const columns = detectColumns(headerRow);

  const rows: ReviewRow[] = [];
  let lastDay = "";
  let lastWeek = 1;
  let lastBlock = "";

  for (let i = headerIdx + 1; i < table.length; i++) {
    const row = table[i] ?? [];
    const raw = row.map((c) => String(c ?? "").trim()).filter(Boolean).join(" · ");
    if (!raw) continue;

    const dateRaw = cellText(row, columns.date);
    const date = columns.date !== undefined ? parseDate(row[columns.date]) : null;
    const dayCell = columns.day !== undefined ? normalizeDay(row[columns.day]) : null;
    const day = dayCell ?? (date ? dayFromDate(date) : "") ?? "";
    if (day) lastDay = day;

    const weekRaw = numText(row, columns.week);
    const weekNum = Number(weekRaw);
    const week = weekNum > 0 ? Math.floor(weekNum) : lastWeek;
    lastWeek = week;

    const blockRaw = cellText(row, columns.block);
    if (blockRaw) lastBlock = blockRaw;
    const blockLabel = blockRaw || lastBlock;

    let exercise = cellText(row, columns.exercise);
    if (!exercise && columns.exercise === undefined) {
      // Sin columna de ejercicio: la primera celda de texto no mapeada sirve de ejercicio.
      const mapped = new Set(Object.values(columns));
      for (let c = 0; c < row.length; c++) {
        if (mapped.has(c)) continue;
        const v = String(row[c] ?? "").trim();
        if (v && !/^[\d.,%]+$/.test(v)) { exercise = v; break; }
      }
    }

    rows.push({
      id: uid(),
      sourceRow: i + 1,
      day: day || lastDay,
      dateText: dateRaw,
      week,
      block: blockLabel,
      blockType: blockTypeFrom(blockLabel || exercise),
      exercise,
      sets: numText(row, columns.sets),
      reps: numText(row, columns.reps),
      percent: numText(row, columns.percent).replace("%", ""),
      load: numText(row, columns.load),
      time: cellText(row, columns.time),
      distance: cellText(row, columns.distance),
      raw,
    });
  }

  const expected: GenericField[] = ["day", "exercise", "sets", "reps", "percent"];
  const unmapped = expected.filter((f) => columns[f] === undefined);

  return { header, columns, rows, unmapped };
}

function toExercise(r: ReviewRow): ManualExercise {
  return {
    ...emptyExercise(),
    name: r.exercise.trim(),
    sets: r.sets.trim(),
    reps: r.reps.trim(),
    percent: r.percent.trim(),
    time: r.time.trim(),
    distance: r.distance.trim(),
    load: r.load.trim(),
  };
}

/**
 * Convierte las filas revisadas a la estructura interna de `planning`.
 * Se descartan las filas sin día o sin ejercicio (el usuario las ve marcadas
 * como "Necesita revisión" antes de confirmar).
 */
export function buildPlanningFromRows(
  rows: ReviewRow[],
  opts: { monthKey: string; monthLabel: string },
): Planning {
  const valid = rows.filter((r) => r.day && r.exercise.trim());
  const weeks = Array.from(new Set(valid.map((r) => r.week))).sort((a, b) => a - b);

  const planning: Planning = {
    months: [
      {
        key: opts.monthKey.trim() || "1. MI PLAN",
        label: opts.monthLabel.trim() || "Mi plan",
        order: 1,
        weeks: weeks.map((wIndex) => ({
          index: wIndex,
          days: IMPORT_DAYS.map((dayKey) => {
            const dayRows = valid.filter((r) => r.week === wIndex && r.day === dayKey);
            const blocks: { key: string; content: string }[] = [];
            const order: string[] = [];
            const grouped = new Map<string, ReviewRow[]>();
            for (const r of dayRows) {
              const key = (r.block.trim() || r.blockType).toUpperCase();
              if (!grouped.has(key)) { grouped.set(key, []); order.push(key); }
              grouped.get(key)!.push(r);
            }
            for (const key of order) {
              const group = grouped.get(key)!;
              const block: ManualBlock = {
                id: uid(),
                key,
                type: group[0].blockType,
                header: "",
                exercises: group.map(toExercise),
              };
              const content = serializeBlock(block);
              if (content.trim()) blocks.push({ key, content });
            }
            return { key: dayKey, blocks, isRest: blocks.length === 0 };
          }),
        })),
      },
    ],
    importedAt: new Date().toISOString(),
  };
  return planning;
}
