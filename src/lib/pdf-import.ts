import { GlobalWorkerOptions, getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import pdfWorker from "pdfjs-dist/legacy/build/pdf.worker.mjs?url";

GlobalWorkerOptions.workerSrc = pdfWorker;
import type { Planning } from "./excel-parser";
import type { ParsedImport, ReviewRow } from "./generic-import";
import { IMPORT_DAYS, normalizeDay } from "./generic-import";
import { uid } from "./manual-plan";

const WEEK_RE = /(?:SEMANA|WEEK|MICROCICLO)\s*[:#-]?\s*(\d{1,2})(?!\s*[–-]\s*\d)/i;
const DAY_RE = /^(LUNES|MARTES|MI(?:E|É)RCOLES|JUEVES|VIERNES|S(?:Á|A)BADO|DOMINGO)\s*(?:\d{1,2}(?:\s+[A-ZÁÉÍÓÚÜÑ]+)?)?\s*[:\-–·]?\s*(.*)$/i;
const DATE_RE = /\b(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?\b/;
const BLOCK_RE = /^(WARM\s*[-–]?\s*UP|CALENTAMIENTO|MOVILIDAD|MOBILITY|FUERZA|STRENGTH|HALTEROFILIA|WEIGHTLIFTING|GIMNÁSTICOS|GIMNASTICOS|GYMNASTICS|SKILL|METCON|WOD|CONDITIONING|CARDIO|CORE|ZONA MEDIA|COOL\s*DOWN|VUELTA A LA CALMA|REST|DESCANSO)\s*[:\-–·]?\s*$/i;
const NUMBERED_RE = /^\s*(\d{1,2})\.\s*(.+?)\s*$/;
const DAY_INLINE_RE = /\b(LUNES|MARTES|MI(?:E|É)RCOLES|JUEVES|VIERNES|S(?:Á|A)BADO|DOMINGO)\b\s*(?:\d{1,2}(?:\s+[A-ZÁÉÍÓÚÜÑ]+)?)?\s*[:\-–·]/i;

function cleanLine(value: string): string {
  return value
    .replace(/[•▪◦]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeForMatch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

function isNoise(line: string): boolean {
  const normalized = normalizeForMatch(line);
  if (!normalized) return true;
  if (/^\d{1,3}$/.test(normalized)) return true;
  if (/^(PAGE|PAGINA)\s*\d+(\s*(OF|DE)\s*\d+)?$/.test(normalized)) return true;
  if (/^(RM\s*OR\s*DIE|TEAM\s*VADER)$/.test(normalized)) return true;
  if (/^(CROSSFIT\s*[·-]\s*PLANIFICACION SEMANAL|PLANIFICACION CROSSFIT.*)$/.test(normalized)) return true;
  if (/^(DATO|VALOR|DATO VALOR)$/.test(normalized)) return true;
  if (/^(REGISTRO DEL ATLETA|DIA CARGAS \/ RESULTADO RPE DIFICULTAD \/ NOTAS)$/.test(normalized)) return true;
  if (/^(REGISTRO|NOTA|ESTRATEGIA|RECUPERACION|OBJETIVO|REGLA DE AJUSTE|REFERENCIA)$/.test(normalized)) return true;
  if (/^COMPLETAR DESPUES DE CADA SESION/.test(normalized)) return true;
  return false;
}

function looksLikeTrainingLine(line: string): boolean {
  if (line.length < 3) return false;
  if (BLOCK_RE.test(line) || WEEK_RE.test(line) || DAY_RE.test(line) || DAY_INLINE_RE.test(line)) return true;
  if (/\b(amrap|emom|for\s*time|every\s*\d+|on\s*the\s*\d+|rest|rounds?|reps?|sets?|kg|%|cal|sec|min|time\s*cap|zone\s*2|zona\s*2)\b/i.test(line)) return true;
  return /\d/.test(line);
}

function blockFromLine(line: string): string | null {
  const m = line.match(BLOCK_RE);
  return m ? cleanLine(m[1]).toUpperCase() : null;
}

function normalizeDayLine(value: string): string | null {
  const cleaned = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  return normalizeDay(cleaned);
}

function blockTypeFromLabel(label: string): ReviewRow["blockType"] {
  const n = normalizeForMatch(label);
  if (/WARM UP|CALENTAMIENTO|MOVILIDAD|MOBILITY/.test(n)) return "MOVILIDAD";
  if (/HALTEROFILIA|WEIGHTLIFTING|SNATCH|CLEAN|JERK/.test(n)) return "HALTEROFILIA";
  if (/GIMNAST|GYMNAST|SKILL|PULL UP|MUSCLE UP|HANDSTAND/.test(n)) return "GIMNASTICOS";
  if (/METCON|WOD|CONDITIONING|AMRAP|EMOM|FOR TIME/.test(n)) return "METCON";
  if (/CARDIO|ENGINE|RUN|ROW|BIKE|ZONE 2|ZONA 2/.test(n)) return "CARDIO";
  if (/FUERZA|STRENGTH|SQUAT|DEADLIFT|PRESS|BENCH/.test(n)) return "FUERZA";
  if (/CORE|ZONA MEDIA|HOLLOW|GHD/.test(n)) return "OTRO";
  return "OTRO";
}

function cleanNumberedHeading(line: string): { number: number; text: string } | null {
  const match = line.match(NUMBERED_RE);
  if (!match) return null;
  return { number: Number(match[1]), text: cleanLine(match[2]) };
}

function splitSectionHeading(text: string): { title: string; detail: string } {
  const parts = text.split(/\s*[·|]\s*/);
  if (parts.length < 2) return { title: text.trim(), detail: "" };
  return { title: parts[0].trim(), detail: parts.slice(1).join(" · ").trim() };
}

function isSectionHeading(text: string): boolean {
  const normalized = normalizeForMatch(text);
  if (!normalized || normalized.length > 48) return false;
  if (/\d+\s*(KG|CAL|REPS?|ROUNDS?|MIN|SEC|M|%)/i.test(text)) return false;
  if (/^(3|4|5|6|7|8|9|10|12|15|20|30)\s/.test(normalized)) return false;
  return /^[A-ZÁÉÍÓÚÜÑ&'’ +/\-]+$/.test(normalized);
}

function addRow(rows: ReviewRow[], args: {
  line: string;
  sourceRow: number;
  day: string;
  week: number;
  block: string;
  blockType: ReviewRow["blockType"];
  dateText?: string;
}): void {
  const exercise = cleanLine(args.line);
  if (!exercise || !args.day) return;

  const date = exercise.match(DATE_RE);
  rows.push({
    id: uid(),
    sourceRow: args.sourceRow,
    day: args.day,
    dateText: args.dateText ?? date?.[0] ?? "",
    week: args.week,
    block: args.block || "PLAN",
    blockType: args.blockType,
    exercise,
    sets: "",
    reps: "",
    percent: "",
    load: "",
    time: "",
    distance: "",
    raw: exercise,
  });
}

async function extractPdfLines(file: File): Promise<string[]> {
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await getDocument({ data }).promise;
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
  const haystack = [...lines.slice(0, 50), filename].join(" ").toLowerCase();
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
  let blockType: ReviewRow["blockType"] = "OTRO";
  let skipRestOfDocument = false;

  for (let i = 0; i < lines.length; i++) {
    let line = cleanLine(lines[i]);
    if (!line) continue;

    const normalized = normalizeForMatch(line);
    if (/^REGISTRO DEL ATLETA$/.test(normalized)) {
      skipRestOfDocument = true;
      continue;
    }
    if (skipRestOfDocument) continue;

    const weekMatch = line.match(WEEK_RE);
    if (weekMatch) {
      week = Math.max(1, Number(weekMatch[1]));
      const rest = cleanLine(line.replace(WEEK_RE, ""));
      if (!rest) continue;
      line = rest.replace(/^[:\-–·\s]+/, "").trim();
    }

    const dayMatch = line.match(DAY_RE);
    if (dayMatch) {
      const nextDay = normalizeDayLine(dayMatch[1]);
      if (nextDay) day = nextDay;
      const rest = cleanLine(dayMatch[2]);
      if (!rest) continue;
      line = rest;
    } else {
      const inlineDay = line.match(DAY_INLINE_RE);
      if (inlineDay) {
        const nextDay = normalizeDayLine(inlineDay[1]);
        if (nextDay) day = nextDay;
        line = cleanLine(line.slice((inlineDay.index ?? 0) + inlineDay[0].length));
      }
    }

    if (!line || isNoise(line)) continue;

    const explicitBlock = blockFromLine(line);
    if (explicitBlock) {
      block = explicitBlock;
      blockType = blockTypeFromLabel(block);
      continue;
    }

    const numbered = cleanNumberedHeading(line);
    if (numbered) {
      const { title, detail } = splitSectionHeading(numbered.text);
      const titleBlock = blockFromLine(title);

      if (titleBlock) {
        block = titleBlock;
        blockType = blockTypeFromLabel(block);
        if (detail) {
          addRow(rows, {
            line: detail,
            sourceRow: i + 1,
            day,
            week,
            block,
            blockType,
          });
        }
        continue;
      }

      if (isSectionHeading(title)) {
        block = title.toUpperCase();
        blockType = blockTypeFromLabel(title);
        addRow(rows, {
          line: title,
          sourceRow: i + 1,
          day,
          week,
          block,
          blockType,
        });
        if (detail) {
          addRow(rows, {
            line: detail,
            sourceRow: i + 1,
            day,
            week,
            block,
            blockType,
          });
        }
        continue;
      }
    }

    if (!looksLikeTrainingLine(line)) continue;

    addRow(rows, {
      line,
      sourceRow: i + 1,
      day,
      week,
      block,
      blockType,
    });
  }

  return rows;
}

export async function parsePdfPlanning(file: File): Promise<ParsedImport & { detectedMonth: { key: string; label: string } }> {
  const lines = await extractPdfLines(file);
  if (lines.length === 0) throw new Error("El PDF no contiene texto seleccionable. Si es un PDF escaneado, necesitaremos OCR.");

  const rows = rowsFromLines(lines);
  if (rows.length === 0) throw new Error("No pude detectar sesiones de entrenamiento en el PDF. Comprueba que contiene texto seleccionable y encabezados de días.");

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

  const incomingByKey = new Map(incoming.months.map((m) => [m.key.toUpperCase(), m]));
  const merged = current.months.map((existingMonth) => {
    const incomingMonth = incomingByKey.get(existingMonth.key.toUpperCase());
    if (!incomingMonth) return existingMonth;

    const incomingWeeks = new Map(incomingMonth.weeks.map((w) => [w.index, w]));
    const mergedWeeks = existingMonth.weeks.map((existingWeek) => {
      const incomingWeek = incomingWeeks.get(existingWeek.index);
      if (!incomingWeek) return existingWeek;

      const incomingDays = new Map(incomingWeek.days.map((d) => [d.key, d]));
      return {
        ...existingWeek,
        days: existingWeek.days.map((existingDay) => incomingDays.get(existingDay.key) ?? existingDay),
      };
    });

    for (const incomingWeek of incomingMonth.weeks) {
      if (!mergedWeeks.some((w) => w.index === incomingWeek.index)) mergedWeeks.push(incomingWeek);
    }

    mergedWeeks.sort((a, b) => a.index - b.index);
    return { ...existingMonth, weeks: mergedWeeks };
  });

  for (const incomingMonth of incoming.months) {
    if (!current.months.some((m) => m.key.toUpperCase() === incomingMonth.key.toUpperCase())) {
      merged.push(incomingMonth);
    }
  }

  merged.sort((a, b) => a.order - b.order);
  return {
    months: merged.map((month, index) => ({ ...month, order: index + 1 })),
    importedAt: new Date().toISOString(),
  };
}


/**
 * OCR de planificaciones en imagen.
 * Tesseract.js trabaja en un Web Worker, por lo que el reconocimiento no bloquea
 * el hilo principal. Se cargan español + inglés porque las planificaciones pueden
 * mezclar nombres de movimientos y etiquetas en ambos idiomas.
 */
export async function parseImagePlanning(
  file: File,
  onProgress?: (progress: number) => void,
): Promise<ParsedImport & { detectedMonth: { key: string; label: string } }> {
  if (!/^image\\/(png|jpe?g|webp)$/i.test(file.type) && !/\\.(png|jpe?g|webp)$/i.test(file.name)) {
    throw new Error("Formato de imagen no compatible. Usa JPG, PNG o WEBP.");
  }

  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker(["spa", "eng"], 1, {
    logger: (message: { progress?: number }) => {
      if (typeof message.progress === "number") onProgress?.(Math.max(0, Math.min(1, message.progress)));
    },
  });

  try {
    const result = await worker.recognize(file, { rotateAuto: true });
    const text = result.data.text ?? "";
    const lines = text
      .split(/\\r?\\n/)
      .map(cleanLine)
      .filter(Boolean)
      .filter((line) => !isNoise(line));

    if (lines.length === 0) {
      throw new Error("No pude detectar texto en la imagen. Usa una foto nítida y bien iluminada.");
    }

    const rows = rowsFromLines(lines);
    if (rows.length === 0) {
      throw new Error("Detecté texto, pero no pude identificar sesiones. Comprueba que aparezcan los días y ejercicios.");
    }

    return {
      header: ["Texto OCR"],
      columns: {},
      rows,
      unmapped: [],
      detectedMonth: inferMonthFromText(lines, file.name),
    };
  } finally {
    await worker.terminate();
  }
}
