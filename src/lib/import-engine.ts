import type { ParsedImport, ReviewRow } from "./generic-import";
import { parseGenericFile, parseStructuredTextPlanning } from "./generic-import";
import { parseImagePlanning, parsePdfPlanning } from "./pdf-import";

export type ImportFormat = "excel" | "csv" | "pdf" | "image" | "txt";

export type ImportDiagnostics = {
  format: ImportFormat;
  confidence: number;
  level: "high" | "medium" | "low";
  rows: number;
  daysDetected: number;
  weeksDetected: number;
  datedRows: number;
  emptyExerciseRows: number;
  missingDayRows: number;
  duplicateRows: number;
  warnings: string[];
};

export type ImportEngineResult = ParsedImport & { diagnostics: ImportDiagnostics };

function detectFormat(file: File): ImportFormat {
  if (/\.pdf$/i.test(file.name) || file.type === "application/pdf") return "pdf";
  if (/\.(png|jpe?g|webp)$/i.test(file.name) || /^image\//i.test(file.type)) return "image";
  if (/\.txt$/i.test(file.name) || file.type === "text/plain") return "txt";
  if (/\.csv$/i.test(file.name) || file.type === "text/csv") return "csv";
  return "excel";
}

function rowFingerprint(row: ReviewRow): string {
  return [
    row.day, row.week, row.block, row.exercise, row.sets, row.reps,
    row.percent, row.load, row.time, row.distance,
  ].map((value) => String(value ?? "").trim().toUpperCase()).join("|");
}

function diagnose(format: ImportFormat, rows: ReviewRow[]): ImportDiagnostics {
  const total = rows.length;
  const dayCount = new Set(rows.map((r) => r.day).filter(Boolean)).size;
  const weekCount = new Set(rows.map((r) => r.week).filter((w) => Number(w) > 0)).size;
  const datedRows = rows.filter((r) => r.dateText?.trim()).length;
  const emptyExerciseRows = rows.filter((r) => !r.exercise.trim()).length;
  const missingDayRows = rows.filter((r) => !r.day).length;

  const seen = new Set<string>();
  let duplicateRows = 0;
  for (const row of rows) {
    const fp = rowFingerprint(row);
    if (fp.replace(/\|/g, "")) {
      if (seen.has(fp)) duplicateRows++;
      seen.add(fp);
    }
  }

  if (!total) {
    return {
      format, confidence: 0, level: "low", rows: 0, daysDetected: 0,
      weeksDetected: 0, datedRows: 0, emptyExerciseRows: 0,
      missingDayRows: 0, duplicateRows: 0, warnings: ["No se detectaron sesiones."],
    };
  }

  const dayCoverage = 1 - missingDayRows / total;
  const exerciseCoverage = 1 - emptyExerciseRows / total;
  const structureBonus = Math.min(0.25, (dayCount / 5) * 0.15 + (weekCount > 1 ? 0.1 : 0));
  const dateBonus = datedRows / total * 0.1;
  const duplicatePenalty = Math.min(0.2, duplicateRows / total * 0.3);

  let confidence = 0.55 * dayCoverage + 0.35 * exerciseCoverage + structureBonus + dateBonus - duplicatePenalty;
  if (format === "txt") confidence += 0.05;
  confidence = Math.max(0, Math.min(1, confidence));

  const warnings: string[] = [];
  if (missingDayRows) warnings.push(`${missingDayRows} filas no tienen día identificado.`);
  if (emptyExerciseRows) warnings.push(`${emptyExerciseRows} filas no tienen contenido de entrenamiento.`);
  if (duplicateRows) warnings.push(`${duplicateRows} filas parecen duplicadas.`);
  if (format === "pdf" && confidence < 0.7) warnings.push("El PDF tiene una lectura parcial; conviene revisar antes de importar.");
  if (format === "image") warnings.push("La lectura procede de OCR y puede requerir revisión.");
  if (format === "excel" && confidence < 0.7) warnings.push("La estructura del Excel no coincide completamente con los formatos conocidos.");

  return {
    format, confidence,
    level: confidence >= 0.82 ? "high" : confidence >= 0.62 ? "medium" : "low",
    rows: total, daysDetected: dayCount, weeksDetected: weekCount, datedRows,
    emptyExerciseRows, missingDayRows, duplicateRows, warnings,
  };
}

export async function importPlanningFile(
  file: File,
  onOcrProgress?: (progress: number) => void,
): Promise<ImportEngineResult> {
  const format = detectFormat(file);

  const parsed =
    format === "pdf"
      ? await parsePdfPlanning(file, onOcrProgress)
      : format === "image"
        ? await parseImagePlanning(file, onOcrProgress)
        : format === "txt"
          ? await parseStructuredTextPlanning(file)
          : await parseGenericFile(file);

  if (!parsed.rows.length) {
    throw new Error("El archivo se ha podido abrir, pero no se han detectado sesiones de entrenamiento.");
  }

  return { ...parsed, diagnostics: diagnose(format, parsed.rows) };
}
