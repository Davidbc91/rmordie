import type { Planning } from "@/lib/excel-parser";
import { resolveMovements } from "@/lib/dictionary/resolve";
import type { MovementMatch } from "@/lib/dictionary/types";

export type AuditPlace = { month: string; week: number; day: string; block: string };
export type AuditLine = {
  /** Texto de la línea tal cual aparece en el plan. */
  text: string;
  key: string;
  matches: MovementMatch[];
  /** Partes de la línea con letras que no quedaron enlazadas. */
  leftover: string;
  places: AuditPlace[];
};

// Palabras de estructura del WOD: no son movimientos y no deben contar como «sin enlace».
const STRUCTURE = new Set([
  "amrap", "emom", "e2mom", "e3mom", "e4mom", "tabata", "for", "time", "fortime", "rounds", "round", "rondas", "ronda",
  "rft", "of", "de", "y", "and", "then", "rest", "descanso", "desc", "min", "mins", "minute", "minutes", "minuto", "minutos",
  "sec", "secs", "seg", "segs", "segundos", "reps", "rep", "repeticiones", "series", "serie", "sets", "set", "x", "kg", "kgs",
  "lb", "lbs", "cal", "cals", "calorias", "m", "mt", "mts", "metros", "km", "every", "cada", "on", "the", "a", "al", "con",
  "en", "por", "to", "cap", "tc", "time cap", "build", "up", "heavy", "max", "rm", "pesado", "ladder", "escalera", "pyramid",
  "piramide", "buy", "in", "out", "sin", "partner", "pareja", "equipos", "team", "alt", "alternando", "alternating", "each",
  "side", "lado", "cada", "pierna", "brazo", "unbroken", "ub", "tempo", "pausa", "pause", "hold", "rx", "scaled", "esc",
  "escalado", "men", "women", "h", "mujeres", "hombres", "total", "start", "inicio", "minuto", "workout", "wod", "metcon",
  "strength", "fuerza", "skill", "accesorio", "accesorios", "warm", "calentamiento", "mobility", "movilidad", "cool", "down",
  "vuelta", "calma", "zona", "media", "core", "opcional", "optional", "notes", "nota", "notas", "despues", "after", "before",
  "antes", "luego", "post", "score", "rpe", "rir", "vs", "o", "or", "u", "la", "el", "las", "los", "del", "un", "una",
]);

const hasWord = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z]+/)
    .some((w) => w.length > 1 && !STRUCTURE.has(w));

/** Recorre el plan y agrupa cada línea distinta con sus enlaces al diccionario. */
export function auditPlanLinks(planning: Planning | null | undefined): AuditLine[] {
  const byKey = new Map<string, AuditLine>();
  for (const month of planning?.months ?? []) {
    for (const week of month.weeks) {
      for (const day of week.days) {
        if (day.isRest) continue;
        for (const block of day.blocks) {
          for (const raw of block.content.split(/\r?\n/)) {
            const text = raw.trim();
            if (!text || !hasWord(text)) continue;
            const key = text.toLowerCase().replace(/\s+/g, " ");
            let line = byKey.get(key);
            if (!line) {
              const matches = resolveMovements(text);
              let leftover = "";
              let cursor = 0;
              for (const m of matches) {
                leftover += ` ${text.slice(cursor, m.start)}`;
                cursor = m.end;
              }
              leftover += ` ${text.slice(cursor)}`;
              line = { text, key, matches, leftover: hasWord(leftover) ? leftover.trim() : "", places: [] };
              byKey.set(key, line);
            }
            line.places.push({ month: month.label || month.key, week: week.index, day: day.key, block: block.key });
          }
        }
      }
    }
  }
  return [...byKey.values()];
}

/** Propuesta de texto a enlazar: la línea sin cantidades, cargas ni estructura. */
export function suggestAlias(text: string): string {
  return text
    .replace(/\(.*?\)/g, " ")
    .replace(/@\s*\S+/g, " ")
    .replace(/\b\d+\s*[x×]\s*\d+\b/gi, " ")
    .replace(/\b[x×]\s*\d+\b/gi, " ")
    .replace(/^[\s\-–•*·.:]+/, "")
    .replace(/\b\d+([.,]\d+)?\s*(x|×|kg|kgs|lb|lbs|%|cal|cals|m|mts|metros|km|reps?|rondas?|rounds?|seg|s|min|'|")?\b/gi, " ")
    .replace(/\d+/g, " ")
    .replace(/[/%×@:;,+]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
