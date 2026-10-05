import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import type { Planning } from "./excel-parser";
import type { ParsedImport, ReviewRow } from "./generic-import";
import { IMPORT_DAYS, normalizeDay } from "./generic-import";
import { uid } from "./manual-plan";

const WEEK_RE = /(?:SEMANA|WEEK|MICROCICLO)\s*[:#-]?\s*(\d+)/i;
const DAY_RE = /^(LUNES|MARTES|MI(?:E|É)RCOLES|JUEVES|VIERNES|S(?:Á|A)BADO|DOMINGO)\s*[:\-–]?\s*(.*)$/i;
const DATE_RE = /\b(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?\b/;
const BLOCK_RE = /^(WARM\s*UP|CALENTAMIENTO|MOVILIDAD|MOBILITY|FUERZA|STRENGTH|HALTEROFILIA|WEIGHTLIFTING|GIMNÁSTICOS|GIMNASTICOS|GYMNASTICS|SKILL|METCON|WOD|CONDITIONING|CARDIO|CORE|ZONA MEDIA|COOL\s*DOWN|VUELTA A LA CALMA|REST|DESCANSO)\s*[:\-–]?$/i;

function cleanLine(value: string): string {
  return value
    .replace(/[•·▪◦]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isNoise(line: string): boolean {
  if (!line) return true;
  if (/^\d{1,3}$/.test(line)) return true;
  if (/^(page|página)\s*\d+(\s*(of|de)\s*\d+)?$/i.test(line)) return true;
  if (/^(rm\s*or\s*die|team\s*vader)$/i.test(line)) return true;
  return false;
}

function looksLikeTrainingLine(line: string): boolean {
  if (line.length < 3) return false;
  if (BLOCK_RE.test(line) || WEEK_RE.test(line) || DAY_RE.test(line)) return true;
  if (/\b(amrap|emom|for\s*time|every\s*\d+|on\s*the\s*\d+|rest|rounds?|reps?|sets?|kg|%|cal|m|sec|min)\b/i.test(line)) return true;
  return /\d/.test(line);
}

function blockFromLine(line: string): string | null {
  const m = line.match(BLOCK_RE);
  return m ? m[1].toUpperCase() : null;
}

function normalizeDayLine(value: string): string | null {
  const cleaned = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  return normalizeDay(cleaned);
}

async function extractPdfLines(file: File): Promise<string[]> {
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await getDocument({ data, disableWorker: true }).promise;
  const lines: string[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const items = content.items
      .filter((item: any) => typeof item?.str === "string" && item.str.trim())
      .map((item: any) => ({
        text: item.str as string,
        x: Number(item.transform?.[4] ?? 0),
        y: Number(item.transform?.[5] ?? 0),
      }))
      .sort((a, b) => b.y - a.y || a.x - b.x);

    const pageLines: { y: number; text: string; x: number }[] = [];
    for (const item of items) {
      const current = pageLines.at(-1);
      if (!current || Math.abs(current.y - item.y) > 3) {
        pageLines.push({ y: item.y, text: item.text, x: item.x });
      } else {
        current.text += current.text.endsWith(" ") || item.text.startsWith(" ") ? item.text : " " + item.text;
      }
    }

    lines.push(...pageLines.map((line) => cleanLine(line.text)));
  }

  return lines.filter((line) => !isNoise(line));
}

function inferMonthFromText(lines: string[], filename: string): { key: string; label: string } {
  const months: Record<string, [string, string]> = {
    enero: ["ENE", "Enero"], febrero: ["FEB", "Febrero"], marzo: ["MAR", "Marzo"],
    abril: ["ABR", "Abril"], mayo: ["MAY", "Mayo"], junio: ["JUN", "Junio"],
    julio: ["JUL", "Julio"], agosto: ["AGO", "Agosto"], septiembre: ["SEP", "Septiembre"],
    octubre: ["OCT", "Octubre"], noviembre: ["NOV", "Noviembre"], diciembre: ["DIC", "Diciembre"],
  };
  const haystack = [...lines.slice(0, 40), filename].join(" ").toLowerCase();
  for (const [name, [abbr, label]] of Object.entries(months)) {
    if (haystack.includes(name)) return { key: `1. ${abbr}`, label };
  }
  return { key: "1. PDF", label: "Plan PDF" };
}

function rowsFromLines(lines: string[]): ReviewRow[] {
  const rows: ReviewRow[] = [];
  let day = "";
  let week = 1;
  let block = "PLAN";

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    if (!looksLikeTrainingLine(line)) continue;

    const weekMatch = line.match(WEEK_RE);
    if (weekMatch) {
      week = Math.max(1, Number(weekMatch[1]));
      const rest = line.replace(WEEK_RE, "").replace(/^[:\-–\s]+/, "").trim();
      if (!rest) continue;
      line = rest;
    }

    const dayMatch = line.match(DAY_RE);
    if (dayMatch) {
      const nextDay = normalizeDayLine(dayMatch[1]);
      if (nextDay) day = nextDay;
      const rest = cleanLine(dayMatch[2]);
      if (!rest) continue;
      line = rest;
    }

    const blockName = blockFromLine(line);
    if (blockName) {
      block = blockName;
      continue;
    }

    const inlineDay = line.match(/\b(LUNES|MARTES|MI(?:E|É)RCOLES|JUEVES|VIERNES|S(?:Á|A)BADO|DOMINGO)\b\s*[:\-–]/i);
    if (inlineDay) {
      const nextDay = normalizeDayLine(inlineDay[1]);
      if (nextDay) day = nextDay;
      line = cleanLine(line.slice((inlineDay.index ?? 0) + inlineDay[0].length));
    }

    if (!day || !line) continue;

    const date = line.match(DATE_RE);
    rows.push({
      id: uid(),
      sourceRow: i + 1,
      day,
      dateText: date?.[0] ?? "",
      week,
      block,
      blockType: "OTRO",
      exercise: line,
      sets: "",
      reps: "",
      percent: "",
      load: "",
      time: "",
      distance: "",
      raw: line,
    });
  }

  return rows;
}

export async function parsePdfPlanning(file: File): Promise<ParsedImport & { detectedMonth: { key: string; label: string } }> {
  const lines = await extractPdfLines(file);
  if (lines.length === 0) throw new Error("El PDF no contiene texto seleccionable. Si es un PDF escaneado, necesitaremos OCR.");
  const rows = rowsFromLines(lines);
  if (rows.length === 0) throw new Error("No pude detectar sesiones de entrenamiento en el PDF.");
  return {
    header: ["Texto PDF"],
    columns: {},
    rows,
    unmapped: [],
    detectedMonth: inferMonthFromText(lines, file.name),
  };
}

export function mergePlanningPreservingPrevious(current: Planning | null | undefined, incoming: Planning): Planning {
  if (!current) return incoming;

  const incomingKeys = new Set(incoming.months.map((m) => m.key.toUpperCase()));
  const preserved = current.months.filter((m) => !incomingKeys.has(m.key.toUpperCase()));
  const mergedMonths = [...preserved, ...incoming.months].sort((a, b) => a.order - b.order);

  return {
    months: mergedMonths.map((month, index) => ({ ...month, order: index + 1 })),
    importedAt: new Date().toISOString(),
  };
}
