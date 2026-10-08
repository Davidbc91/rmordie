import { GlobalWorkerOptions, getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import pdfWorker from "pdfjs-dist/legacy/build/pdf.worker.mjs?url";

GlobalWorkerOptions.workerSrc = pdfWorker;
import type { Planning } from "./excel-parser";
import type { ParsedImport, ReviewRow } from "./generic-import";
import { IMPORT_DAYS, normalizeDay, parseStructuredTextPlanning } from "./generic-import";
import { uid } from "./manual-plan";

const WEEK_RE = /(?:SEMANA|WEEK|MICROCICLO|MICROCYCLE)\s*(?:N[º°]?\s*)?[:#-]?\s*(\d{1,2})(?:\s*(?:DE|OF|\/)\s*\d{1,2})?/i;
const PHASE_RE = /^(?:FASE|PHASE|BLOQUE|BLOCK|MESOCICLO|MESOCYCLE|CICLO|CYCLE|PROGRAMA|PROGRAM)\b\s*[:#-]?\s*(.+)$/i;
const DAY_NAMES = "LUNES|MARTES|MI(?:E|É)RCOLES|JUEVES|VIERNES|S(?:Á|A)BADO|DOMINGO|MONDAY|TUESDAY|WEDNESDAY|THURSDAY|FRIDAY|SATURDAY|SUNDAY|MON|TUE|TUES|WED|THU|THUR|FRI|SAT|SUN";
const DAY_RE = new RegExp("^\\s*(?:\\d{1,2}\\s*[.)-]?\\s*)?(" + DAY_NAMES + ")\\s*(?:\\d{1,2}(?:\\s+[A-ZÁÉÍÓÚÜÑ]+)?)?\\s*[:\\-–·]?\\s*(.*)$", "i");
const DATE_RE = /\b(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?\b/;
const BLOCK_RE = /^(?:[A-F]\s*[.)-]?\s*)?(WARM\s*[-–]?\s*UP|CALENTAMIENTO|MOVILIDAD|MOBILITY|FUERZA|STRENGTH|STRENGH|MAX\s*STRENGH(?:\s+COMBINE)?|STRENGTH\s+WOD|STRENGH\s+WOD|ACCESS(?:ORY|SORY)?\s+STRENGH\s+WOD|METABOLIC\s+PUMP(?:\s+\d+)?|BODY\s+ARMOUR|BODY\s+ARMOR|POWER\s+WOD|AGONIST\s+ANTAGONIST|HALTEROFILIA|WEIGHTLIFTING|GIMNÁSTICOS|GIMNASTICOS|GYMNASTICS|SKILL|METCON|WOD|CONDITIONING|CARDIO|CORE|ZONA MEDIA|COOL\s*DOWN|VUELTA A LA CALMA|REST|DESCANSO)\s*[:\-–·]?\s*$/i;
const NUMBERED_RE = /^\s*(\d{1,2})[.)]\s*(.+?)\s*$/;
const DAY_INLINE_RE = new RegExp("\\b(?:\\d{1,2}\\s*[.)-]?\\s*)?(" + DAY_NAMES + ")\\b\\s*(?:\\d{1,2}(?:\\s+[A-ZÁÉÍÓÚÜÑ]+)?)?\\s*[:\\-–·]", "i");

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
  if (/^(PAGE|PAGINA|P)\s*\d+(\s*(OF|DE)\s*\d+)?$/.test(normalized)) return true;
  if (/^(RM\s*OR\s*DIE|TEAM\s*VADER|TRAINCULT)$/.test(normalized)) return true;
  if (/^(FW\s*[·-]?\s*©?\s*2023|YOU WON'T ALWAYS LOVE THE WORKOUT BUT YOU'?LL LOVE THE RESULT|PUMP PALACE|PROGRAMACION|TCPUMP)$/.test(normalized)) return true;
  if (/^©\s*2023/.test(normalized)) return true;
  if (/^(CROSSFIT\s*[·-]\s*PLANIFICACION SEMANAL|PLANIFICACION CROSSFIT.*)$/.test(normalized)) return true;
  if (/^(DATO|VALOR|DATO VALOR)$/.test(normalized)) return true;
  if (/^(REGISTRO DEL ATLETA|DIA CARGAS \/ RESULTADO RPE DIFICULTAD \/ NOTAS)$/.test(normalized)) return true;
  if (/^(REGISTRO|NOTA|ESTRATEGIA|RECUPERACION|OBJETIVO|REGLA DE AJUSTE|REFERENCIA)$/.test(normalized)) return true;
  if (/^COMPLETAR DESPUES DE CADA SESION/.test(normalized)) return true;
  if (/^(WARM\s*UP|COOL\s*DOWN|STRENGTH|STRENGH|METCON|WOD|AMRAP|EMOM|FOR TIME)$/i.test(line)) return false;
  return false;
}

function looksLikeTrainingLine(line: string): boolean {
  if (line.length < 3) return false;
  if (BLOCK_RE.test(line) || WEEK_RE.test(line) || DAY_RE.test(line) || DAY_INLINE_RE.test(line) || PHASE_RE.test(line)) return true;
  if (/\b(amrap|emom|e\d+mom|for\s*time|for\s*reps?|for\s*load|every\s*\d+|on\s*the\s*\d+|rest|rounds?|reps?|sets?|kg|lb|lbs|%|cal|sec|seconds?|min|mins?|minutes?|time\s*cap|zone\s*[1-5]|zona\s*[1-5]|rft|rft|interval|intervals?|ladder|descending|ascending|death\s*by|max\s*reps?|quality|tempo|rm|1rm|3rm|5rm|8rm|10rm|rx|rx'd|scaled|beginner|intermediate|advanced)\b/i.test(line)) return true;
  if (/\b(air\s*squat|back\s*squat|front\s*squat|overhead\s*squat|deadlift|clean|snatch|jerk|thruster|press|bench|pull[- ]?up|push[- ]?up|muscle[- ]?up|toes?\s*to\s*bar|handstand|burpee|box\s*jump|double[- ]?under|run|row|bike|ski|swim|wall\s*ball|kettlebell|dumbbell|barbell|lunges?|sit[- ]?up|plank|carry|sled|rope\s*climb)\b/i.test(line)) return true;
  return /\d/.test(line);
}

function blockFromLine(line: string): string | null {
  const m = line.match(BLOCK_RE);
  return m ? cleanLine(m[1]).toUpperCase() : null;
}

type LayoutLine = { text: string; x: number; y: number; page?: number };

function isDayAnchorText(value: string): boolean {
  return /^(?:\d{1,2}\s*[.)-]?\s*)?(?:LUNES|MARTES|MI(?:E|É)RCOLES|JUEVES|VIERNES|S(?:Á|A)BADO|DOMINGO)$/i.test(cleanLine(value));
}

function orderPageColumns(items: LayoutLine[], pageWidth: number): string[] {
  const raw = items.filter((item) => item.text.trim());
  const anchors = raw
    .filter((item) => isDayAnchorText(item.text))
    .sort((a, b) => a.x - b.x);

  if (anchors.length < 2) {
    return groupLayoutItems(raw)
      .sort((a, b) => a.y - b.y || a.x - b.x)
      .map((line) => line.text)
      .filter((line) => !isNoise(line));
  }

  // Grid PDFs must be read column-by-column, not by the PDF's global text order.
  // This keeps every exercise and continuation under its actual day.
  const columns = anchors.map((anchor, index) => ({
    xMin: index === 0 ? -Infinity : (anchors[index - 1].x + anchor.x) / 2,
    xMax: index === anchors.length - 1 ? Math.max(pageWidth, anchor.x + 20) : (anchor.x + anchors[index + 1].x) / 2,
  }));

  const result: string[] = [];
  for (const column of columns) {
    const columnItems = raw
      .filter((item) => item.x >= column.xMin && item.x < column.xMax)
      .sort((a, b) => a.y - b.y || a.x - b.x);

    result.push(
      ...groupLayoutItems(columnItems)
        .sort((a, b) => a.y - b.y || a.x - b.x)
        .map((line) => line.text)
        .filter((line) => !isNoise(line)),
    );
  }
  return result;
}

function groupLayoutItems(items: LayoutLine[]): LayoutLine[] {
  const sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x);
  const grouped: LayoutLine[] = [];
  for (const item of sorted) {
    const current = grouped.at(-1);
    if (!current || Math.abs(current.y - item.y) > 3 || Math.abs(item.x - current.x) > 120) {
      grouped.push({ text: item.text, x: item.x, y: item.y });
    } else {
      current.text += current.text.endsWith(" ") || item.text.startsWith(" ") ? item.text : " " + item.text;
    }
  }
  return grouped.map((line) => ({ ...line, text: cleanLine(line.text) })).filter((line) => line.text);
}

function orderColumnLayout(items: LayoutLine[], pageWidth: number): string[] {
  const raw = items.filter((item) => item.text.trim());
  const provisional = groupLayoutItems(raw);
  const dayAnchors = raw
    .filter((item) => /^(?:\d{1,2}[.)-]?\s*)?(?:LUNES|MARTES|MI(?:E|É)RCOLES|JUEVES|VIERNES|S(?:Á|A)BADO|DOMINGO)$/i.test(cleanLine(item.text)))
    .map((item) => ({ x: item.x, y: item.y, day: item.text }));

  if (dayAnchors.length < 2) {
    return provisional
      .sort((a, b) => a.y - b.y || a.x - b.x)
      .map((line) => line.text)
      .filter((line) => !isNoise(line));
  }

  const xCenters = [...new Set(dayAnchors.map((a) => Math.round(a.x * 10) / 10))].sort((a, b) => a - b);
  const yCenters = [...new Set(dayAnchors.map((a) => Math.round(a.y * 10) / 10))].sort((a, b) => a - b);
  const maxX = Math.max(...raw.map((item) => item.x));
  const minX = Math.min(...raw.map((item) => item.x));
  const result: string[] = [];

  for (const yCenter of yCenters) {
    const yIndex = yCenters.indexOf(yCenter);
    const yMin = yIndex === 0 ? -Infinity : (yCenters[yIndex - 1] + yCenter) / 2;
    const yMax = yIndex === yCenters.length - 1 ? Infinity : (yCenter + yCenters[yIndex + 1]) / 2;

    for (let xIndex = 0; xIndex < xCenters.length; xIndex++) {
      const xCenter = xCenters[xIndex];
      const xMin = xIndex === 0 ? minX - 10 : (xCenters[xIndex - 1] + xCenter) / 2;
      const xMax = xIndex === xCenters.length - 1 ? Math.min(pageWidth, maxX + 8) : (xCenter + xCenters[xIndex + 1]) / 2;
      const regionItems = raw.filter((item) => item.x >= xMin && item.x < xMax && item.y >= yMin && item.y < yMax);
      const regionLines = groupLayoutItems(regionItems).sort((a, b) => a.y - b.y || a.x - b.x);
      result.push(...regionLines.map((line) => line.text).filter((line) => !isNoise(line)));
    }
  }

  return result;
}

function normalizeDayLine(value: string): string | null {
  const cleaned = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  return normalizeDay(cleaned);
}

function blockTypeFromLabel(label: string): ReviewRow["blockType"] {
  const n = normalizeForMatch(label);
  if (/WARM UP|CALENTAMIENTO|MOVILIDAD|MOBILITY|ACTIVATION|ACTIVACION|STRETCH|FLEXIBILITY|COOL DOWN|RECOVERY/.test(n)) return "MOVILIDAD";
  if (/HALTEROFILIA|WEIGHTLIFTING|OLYMPIC|SNATCH|CLEAN|JERK/.test(n)) return "HALTEROFILIA";
  if (/GIMNAST|GYMNAST|SKILL|PULL UP|MUSCLE UP|HANDSTAND|HSPU|HOLLOW|L[- ]?SIT|TOES TO BAR/.test(n)) return "GIMNASTICOS";
  if (/METCON|WOD|CONDITIONING|AMRAP|EMOM|E\dMOM|FOR TIME|FOR REPS|CHIPPER|COUPLET|TRIPLET|INTERVAL|RFT/.test(n)) return "METCON";
  if (/CARDIO|ENGINE|MONOSTRUCTURAL|RUN|ROW|BIKE|SKI|SWIM|ZONE [1-5]|ZONA [1-5]/.test(n)) return "CARDIO";
  if (/FUERZA|STRENGTH|STRENGH|MAX STRENGTH|SQUAT|DEADLIFT|PRESS|BENCH|RM/.test(n)) return "FUERZA";
  if (/CORE|ZONA MEDIA|TRUNK|ABDOMINAL|HOLLOW|GHD/.test(n)) return "OTRO";
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

async function extractPdfOcrLines(file: File): Promise<string[]> {
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await getDocument({ data }).promise;
  const Tesseract = await loadBrowserTesseract();
  const worker = await Tesseract.createWorker(["spa", "eng"], 1);
  const lines: string[] = [];

  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext("2d");
      if (!context) continue;

      await page.render({ canvasContext: context, canvas, viewport }).promise;
      const result = await worker.recognize(canvas as unknown as File, { rotateAuto: true });
      const ocrLines = result.data.lines ?? [];
      const positioned = ocrLines
        .filter((line) => line.text?.trim() && line.bbox)
        .map((line) => ({
          text: line.text as string,
          x: Number(line.bbox?.x0 ?? 0),
          y: Number(line.bbox?.y0 ?? 0),
        }));

      if (positioned.length >= 2) {
        lines.push(...orderPageColumns(positioned, canvas.width));
      } else {
        lines.push(
          ...(result.data.text ?? "")
            .split(/\r?\n/)
            .map(cleanLine)
            .filter(Boolean),
        );
      }

      canvas.width = 1;
      canvas.height = 1;
    }
  } finally {
    await worker.terminate();
  }

  return lines.filter((line) => !isNoise(line));
}

async function extractPdfLines(file: File): Promise<string[]> {
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await getDocument({ data }).promise;
  const lines: string[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const items: LayoutLine[] = content.items
      .filter((item: any) => typeof item?.str === "string" && item.str.trim())
      .map((item: any) => ({
        text: item.str as string,
        x: Number(item.transform?.[4] ?? 0),
        y: Number(item.transform?.[5] ?? 0),
      }));

    const pageWidth = page.view?.[2] ?? 595;
    lines.push(...orderPageColumns(items, pageWidth));
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

    const phaseMatch = line.match(PHASE_RE);
    if (phaseMatch) {
      block = cleanLine(phaseMatch[2]).toUpperCase();
      blockType = blockTypeFromLabel(block);
      continue;
    }

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

    // Once the day column is known, retain every meaningful line. Explanatory
    // lines without a movement keyword are still part of the prescription.
    const preserveLine = Boolean(day) && !/^[-–—_]+$/.test(line) && line.length >= 2;
    if (!preserveLine && !looksLikeTrainingLine(line)) continue;

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


type BaselineGroup = { y: number; items: LayoutLine[] };

const ANNUAL_MONTHS: Record<string, number> = {
  ENERO: 1, FEBRERO: 2, MARZO: 3, ABRIL: 4, MAYO: 5, JUNIO: 6,
  JULIO: 7, AGOSTO: 8, SEPTIEMBRE: 9, OCTUBRE: 10, NOVIEMBRE: 11, DICIEMBRE: 12,
};

const ANNUAL_COLUMN_PATTERNS: RegExp[] = [
  /FECHA|D[ÍI]A/i, /^FOCO$/i, /MOVILIDAD.*CORE|MOVILIDAD|CORE/i,
  /CALENTAMIENTO/i, /FUERZA.*T[ÉE]CNICA|FUERZA|T[ÉE]CNICA/i,
  /^WOD$/i, /ACCESORIO/i, /^FESTIVO/i,
];

function baselineGroups(items: LayoutLine[]): BaselineGroup[] {
  const sorted = [...items].filter((item) => item.text.trim()).sort((a, b) => b.y - a.y || a.x - b.x);
  const groups: BaselineGroup[] = [];
  for (const item of sorted) {
    const current = groups.at(-1);
    if (!current || Math.abs(current.y - item.y) > 3) groups.push({ y: item.y, items: [item] });
    else current.items.push(item);
  }
  return groups.map((group) => ({ y: group.y, items: [...group.items].sort((a, b) => a.x - b.x) }));
}

function groupCellItems(items: LayoutLine[]): string[] {
  const groups: BaselineGroup[] = [];
  for (const item of [...items].sort((a, b) => b.y - a.y || a.x - b.x)) {
    const current = groups.at(-1);
    if (!current || Math.abs(current.y - item.y) > 3) groups.push({ y: item.y, items: [item] });
    else current.items.push(item);
  }
  return groups
    .sort((a, b) => b.y - a.y)
    .map((group) => group.items.sort((a, b) => a.x - b.x).map((item) => cleanLine(item.text)).filter(Boolean).join(" "))
    .map(cleanLine)
    .filter(Boolean)
    .filter((line) => !isNoise(line));
}

function annualMonthFromGroups(groups: BaselineGroup[]): { month: number; year: number } | null {
  const candidates = groups.slice(0, 18).map((group) => group.items.map((item) => cleanLine(item.text)).join(" ")).join(" ");
  for (const [name, month] of Object.entries(ANNUAL_MONTHS)) {
    const match = candidates.match(new RegExp("\\b" + name + "\\s+(20\\d{2})\\b", "i"));
    if (match) return { month, year: Number(match[1]) };
  }
  return null;
}

function annualMonthMeta(month: number, year: number): { key: string; label: string; order: number } {
  const monthEntry = Object.entries(ANNUAL_MONTHS).find(([, value]) => value === month);
  const monthName = monthEntry?.[0] ?? "Plan";
  const monthAbbr = monthName.slice(0, 3);
  const order = (year - 2026) * 12 + month - 10 + 1;
  return {
    key: `${Math.max(1, order)}. ${monthAbbr} ${year}`,
    label: `${monthName[0] + monthName.slice(1).toLowerCase()} ${year}`,
    order: Math.max(1, order),
  };
}

function annualWeekHeaders(groups: BaselineGroup[]): Array<{ y: number; week: number }> {
  return groups
    .map((group) => {
      const text = group.items.map((item) => cleanLine(item.text)).join(" ");
      const match = text.match(/\bSEMANA\s*(\d{1,2})\b/i);
      return match ? { y: group.y, week: Number(match[1]) } : null;
    })
    .filter((value): value is { y: number; week: number } => value !== null);
}

function annualDateAnchors(groups: BaselineGroup[]): Array<{ y: number; day: string; dateText: string; text: string }> {
  const result: Array<{ y: number; day: string; dateText: string; text: string }> = [];
  for (const group of groups) {
    const text = group.items.map((item) => cleanLine(item.text)).join(" ");
    const match = text.match(/\b(\d{1,2}\/\d{1,2})\s+(Lunes|Martes|Mi(?:e|é)rcoles|Jueves|Viernes|S(?:á|a)bado|Domingo)\b/i);
    if (!match) continue;
    const day = normalizeDayLine(match[2]);
    if (day) result.push({ y: group.y, day, dateText: match[1], text });
  }
  return result;
}

function annualHeaderAnchors(groups: BaselineGroup[]): { boundaries: number[]; score: number } | null {
  const maxY = Math.max(...groups.map((group) => group.y), 0);
  const candidates = groups.filter((group) => group.y >= maxY - 300);
  let best: { score: number; anchors: Array<number | null> } | null = null;

  for (const group of candidates) {
    const anchors = ANNUAL_COLUMN_PATTERNS.map((pattern) => {
      const item = group.items.find((candidate) => pattern.test(cleanLine(candidate.text)));
      return item ? item.x : null;
    });
    const score = anchors.filter((x): x is number => x !== null).length;
    if (!best || score > best.score) best = { score, anchors };
  }

  if (!best || best.score < 5) return null;

  const allX = groups.flatMap((group) => group.items.map((item) => item.x));
  const maxX = Math.max(...allX, 595);
  const minX = Math.min(...allX, 0);
  const positions = [...best.anchors];

  for (let i = 0; i < positions.length; i++) {
    if (positions[i] !== null) continue;
    let left = i - 1;
    while (left >= 0 && positions[left] === null) left--;
    let right = i + 1;
    while (right < positions.length && positions[right] === null) right++;
    if (left >= 0 && right < positions.length) {
      positions[i] = positions[left]! + ((positions[right]! - positions[left]!) * (i - left)) / (right - left);
    } else if (left >= 0) {
      positions[i] = positions[left]! + (maxX - positions[left]!) / (positions.length - left);
    } else if (right < positions.length) {
      positions[i] = positions[right]! - (positions[right]! - minX) / (right + 1);
    } else {
      positions[i] = minX + ((maxX - minX) * i) / (positions.length - 1);
    }
  }

  const sorted = positions as number[];
  const boundaries = [minX - 10];
  for (let i = 0; i < sorted.length - 1; i++) boundaries.push((sorted[i] + sorted[i + 1]) / 2);
  boundaries.push(maxX + 30);
  return { boundaries, score: best.score };
}

function annualCellLines(items: LayoutLine[], bounds: number[], upperY: number, lowerY: number, column: number): string[] {
  const cellItems = items.filter(
    (item) => item.x >= bounds[column] && item.x < bounds[column + 1] && item.y <= upperY && item.y > lowerY,
  );
  return groupCellItems(cellItems).filter((line) => {
    const normalized = normalizeForMatch(line);
    if (/^SEMANA\s+\d+/.test(normalized)) return false;
    if (/^(OCTUBRE|NOVIEMBRE|DICIEMBRE|ENERO|FEBRERO|MARZO|ABRIL|MAYO|JUNIO|JULIO|AGOSTO|SEPTIEMBRE)\s+20\d{2}$/.test(normalized)) return false;
    if (/^(FECHA|DIA|FOCO|MOVILIDAD|CORE|CALENTAMIENTO|FUERZA|TECNICA|WOD|ACCESORIO|FESTIVO)$/.test(normalized)) return false;
    return true;
  });
}

function annualRowsFromPage(items: LayoutLine[], pageNumber: number): { rows: ReviewRow[]; month?: { key: string; label: string; order: number } } {
  const groups = baselineGroups(items);
  const month = annualMonthFromGroups(groups);
  const dates = annualDateAnchors(groups);
  const weeks = annualWeekHeaders(groups);
  const header = annualHeaderAnchors(groups);
  if (!month || dates.length === 0 || !header) return { rows: [] };

  const rows: ReviewRow[] = [];
  const orderedDates = dates.sort((a, b) => b.y - a.y);
  for (let index = 0; index < orderedDates.length; index++) {
    const date = orderedDates[index];
    const nextDate = orderedDates[index + 1];
    const nextWeekHeader = weeks.filter((week) => week.y < date.y).sort((a, b) => b.y - a.y)[0];
    const lowerY = nextDate ? nextDate.y + 4 : nextWeekHeader ? nextWeekHeader.y + 4 : 0;
    const upperY = date.y + 5;
    const week = weeks.filter((candidate) => candidate.y >= date.y).sort((a, b) => a.y - b.y)[0]?.week ?? weeks[0]?.week ?? 1;
    const meta = annualMonthMeta(month.month, month.year);
    const cells = Array.from({ length: 8 }, (_, column) => annualCellLines(items, header.boundaries, upperY, lowerY, column));
    const focus = cells[1].join("\n").trim();
    const restInDate = /DESCANSO/i.test(date.text);

    const blockCells: Array<{ key: string; type: ReviewRow["blockType"]; lines: string[] }> = [
      { key: "FOCO", type: "OTRO", lines: cells[1] },
      { key: "1 · MOVILIDAD · CORE", type: "MOVILIDAD", lines: cells[2] },
      { key: "2 · CALENTAMIENTO", type: "MOVILIDAD", lines: cells[3] },
      { key: "3 · FUERZA · TÉCNICA", type: blockTypeFromLabel(cells[4].join(" ")), lines: cells[4] },
      { key: "4 · WOD", type: "METCON", lines: cells[5] },
      { key: "5 · ACCESORIO", type: "OTRO", lines: cells[6] },
      { key: "FESTIVO", type: "OTRO", lines: cells[7] },
    ];

    if (restInDate && !focus) blockCells.unshift({ key: "DESCANSO", type: "OTRO", lines: ["Descanso"] });

    for (const cell of blockCells) {
      const content = cell.lines.join("\n").trim();
      if (!content) continue;
      rows.push({
        id: uid(),
        sourceRow: pageNumber * 10000 + index,
        day: date.day,
        dateText: date.dateText,
        week,
        monthKey: meta.key,
        monthLabel: meta.label,
        monthOrder: meta.order,
        block: cell.key,
        blockType: cell.type,
        exercise: content,
        sets: "",
        reps: "",
        percent: "",
        load: "",
        time: "",
        distance: "",
        raw: content,
      });
    }
  }

  return { rows, month: annualMonthMeta(month.month, month.year) };
}

async function extractAnnualPdfRows(file: File): Promise<{ rows: ReviewRow[]; months: Array<{ key: string; label: string; order: number }> }> {
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await getDocument({ data }).promise;
  const rows: ReviewRow[] = [];
  const months = new Map<string, { key: string; label: string; order: number }>();

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const items: LayoutLine[] = content.items
      .filter((item: any) => typeof item?.str === "string" && item.str.trim())
      .map((item: any) => ({
        text: item.str as string,
        x: Number(item.transform?.[4] ?? 0),
        y: Number(item.transform?.[5] ?? 0),
        page: pageNumber,
      }));

    const parsed = annualRowsFromPage(items, pageNumber);
    rows.push(...parsed.rows);
    if (parsed.month) months.set(parsed.month.key, parsed.month);
  }

  return { rows, months: [...months.values()].sort((a, b) => a.order - b.order) };
}

async function extractStructuredDailyPdfLines(file: File): Promise<string[]> {
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

    const grouped: Array<{ y: number; text: string }> = [];
    for (const item of items) {
      const current = grouped.at(-1);
      if (!current || Math.abs(current.y - item.y) > 3) {
        grouped.push({ y: item.y, text: item.text });
      } else {
        current.text += current.text.endsWith(" ") || item.text.startsWith(" ") ? item.text : " " + item.text;
      }
    }

    lines.push(...grouped.map((line) => cleanLine(line.text)).filter(Boolean));
  }

  return lines;
}

async function looksLikeStructuredDailyPdf(file: File): Promise<boolean> {
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await getDocument({ data }).promise;
  if (pdf.numPages === 0) return false;

  const page = await pdf.getPage(1);
  const content = await page.getTextContent();
  const sample = content.items
    .filter((item: any) => typeof item?.str === "string" && item.str.trim())
    .map((item: any) => item.str as string)
    .join(" ");

  return (
    /RM\s*OR\s*DIE\s*\|\s*REGISTRO\s*DIARIO/i.test(sample) &&
    /FECHA\s*:/i.test(sample) &&
    /SECCION\s*:/i.test(sample) &&
    /INICIO\s+DIA/i.test(sample)
  );
}

export async function parsePdfPlanning(file: File): Promise<ParsedImport & { detectedMonth: { key: string; label: string } }> {
  // Este PDF es la versión paginada del TXT estructurado: un día completo
  // por página. Detectarlo antes del parser de cuadrículas evita recorrer las
  // 366 páginas dos veces y conserva las cinco secciones originales.
  if (await looksLikeStructuredDailyPdf(file)) {
    const lines = await extractStructuredDailyPdfLines(file);
    const structuredSource = lines.join("\n");
    const structuredFile = new File(
      [structuredSource],
      file.name.replace(/\.pdf$/i, ".txt"),
      { type: "text/plain" },
    );
    const structured = await parseStructuredTextPlanning(structuredFile);
    return {
      ...structured,
      detectedMonth: inferMonthFromText(lines, file.name),
    };
  }

  const annual = await extractAnnualPdfRows(file);
  if (annual.rows.length > 0) {
    const firstMonth = annual.months[0] ?? { key: "1. PDF", label: "Plan PDF", order: 1 };
    return {
      header: ["FECHA", "DÍA", "FOCO", "MOVILIDAD · CORE", "CALENTAMIENTO", "FUERZA · TÉCNICA", "WOD", "ACCESORIO", "FESTIVO"],
      columns: {},
      rows: annual.rows,
      unmapped: [],
      detectedMonth: { key: firstMonth.key, label: firstMonth.label },
    };
  }

  let lines = await extractPdfLines(file);

  if (lines.length === 0) {
    lines = await extractPdfOcrLines(file);
  }

  let rows = rowsFromLines(lines);

  if (rows.length === 0) {
    const ocrLines = await extractPdfOcrLines(file);
    if (ocrLines.length && ocrLines.join("\n") !== lines.join("\n")) {
      lines = ocrLines;
      rows = rowsFromLines(lines);
    }
  }

  if (rows.length === 0) {
    throw new Error("No pude detectar sesiones de entrenamiento en el PDF. Si es un PDF escaneado, comprueba que las páginas sean nítidas y que aparezcan días y ejercicios.");
  }

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

  // Keep the athlete's existing custom month order. New months are appended
  // following the order of the incoming file instead of resetting the calendar.
  const incomingOnly = incoming.months.filter(
    (month) => !current.months.some((existing) => existing.key.toUpperCase() === month.key.toUpperCase()),
  );
  const currentOrder = current.months
    .map((existing) => merged.find((month) => month.key.toUpperCase() === existing.key.toUpperCase()))
    .filter((month): month is Month => !!month);
  const ordered = [...currentOrder, ...incomingOnly];
  return {
    months: ordered.map((month, index) => ({ ...month, order: index + 1 })),
    importedAt: new Date().toISOString(),
  };
}


type BrowserTesseract = {
  createWorker: (
    langs?: string | string[],
    oem?: number,
    options?: { logger?: (message: { progress?: number }) => void },
  ) => Promise<{
    recognize: (image: File | HTMLCanvasElement, options?: { rotateAuto?: boolean }) => Promise<{
      data: {
        text?: string;
        lines?: Array<{ text?: string; bbox?: { x0?: number; y0?: number } }>;
      };
    }>;
    terminate: () => Promise<unknown>;
  }>;
};

let tesseractPromise: Promise<BrowserTesseract> | null = null;

async function loadBrowserTesseract(): Promise<BrowserTesseract> {
  const getTesseract = () => (globalThis as typeof globalThis & { Tesseract?: BrowserTesseract }).Tesseract;

  const existing = getTesseract();
  if (existing) return existing;
  if (typeof document === "undefined") {
    throw new Error("El OCR de imágenes solo está disponible en el navegador.");
  }

  if (!tesseractPromise) {
    tesseractPromise = new Promise<BrowserTesseract>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/tesseract.min.js";
      script.async = true;
      script.onload = () => {
        const api = getTesseract();
        if (api) resolve(api);
        else reject(new Error("No se pudo cargar el motor OCR."));
      };
      script.onerror = () => reject(new Error("No se pudo cargar el motor OCR. Comprueba la conexión a internet."));
      document.head.appendChild(script);
    }).catch((error) => {
      tesseractPromise = null;
      throw error;
    });
  }

  return tesseractPromise;
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
  if (!/^image\/(png|jpe?g|webp)$/i.test(file.type) && !/\.(png|jpe?g|webp)$/i.test(file.name)) {
    throw new Error("Formato de imagen no compatible. Usa JPG, PNG o WEBP.");
  }

  const Tesseract = await loadBrowserTesseract();
  const worker = await Tesseract.createWorker(["spa", "eng"], 1, {
    logger: (message) => {
      if (typeof message.progress === "number") onProgress?.(Math.max(0, Math.min(1, message.progress)));
    },
  });

  try {
    const result = await worker.recognize(file, { rotateAuto: true });
    const ocrLines = result.data.lines ?? [];
    const positioned = ocrLines
      .filter((line) => line.text?.trim() && line.bbox)
      .map((line) => ({
        text: line.text as string,
        x: Number(line.bbox?.x0 ?? 0),
        y: Number(line.bbox?.y0 ?? 0),
      }));
    const lines = positioned.length >= 2
      ? orderColumnLayout(positioned, Math.max(...positioned.map((line) => line.x), 1000) + 10)
      : (result.data.text ?? "")
          .split(/\r?\n/)
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
