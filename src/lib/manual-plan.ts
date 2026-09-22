/**
 * Planificación manual: serializa/parsea bloques y ejercicios usando EXACTAMENTE
 * la estructura existente de `planning` (Month → Week → Day → Block{key, content}).
 * No hay tablas ni campos nuevos: el contenido del bloque sigue siendo texto,
 * igual que el que genera el importador de Excel.
 */

export const BLOCK_TYPES = [
  "FUERZA",
  "HALTEROFILIA",
  "GIMNASTICOS",
  "METCON",
  "CARDIO",
  "MOVILIDAD",
  "OTRO",
] as const;

export type BlockType = (typeof BLOCK_TYPES)[number];

export const BLOCK_TYPE_LABEL: Record<BlockType, string> = {
  FUERZA: "Fuerza",
  HALTEROFILIA: "Halterofilia",
  GIMNASTICOS: "Gimnásticos",
  METCON: "Metcon",
  CARDIO: "Cardio",
  MOVILIDAD: "Movilidad",
  OTRO: "Otro",
};

export type ManualExercise = {
  id: string;
  name: string;
  sets: string;
  reps: string;
  percent: string;
  time: string;
  distance: string;
  load: string;
};

export type ManualBlock = {
  id: string;
  /** clave estable del bloque: se usa tal cual como Block.key */
  key: string;
  type: BlockType;
  header: string;
  exercises: ManualExercise[];
};

export const uid = () => Math.random().toString(36).slice(2, 10);

export function emptyExercise(): ManualExercise {
  return { id: uid(), name: "", sets: "", reps: "", percent: "", time: "", distance: "", load: "" };
}

/** Clave estable y única dentro del día: "FUERZA", "FUERZA 2", … */
export function nextBlockKey(type: BlockType, existing: ManualBlock[]): string {
  const used = new Set(existing.map((b) => b.key));
  if (!used.has(type)) return type;
  let n = 2;
  while (used.has(`${type} ${n}`)) n++;
  return `${type} ${n}`;
}

const SEP = " · ";

function num(s: string) {
  return s.trim().replace(",", ".");
}

export function serializeExercise(ex: ManualExercise): string {
  const tokens: string[] = [];
  if (ex.sets.trim() && ex.reps.trim()) tokens.push(`${num(ex.sets)}x${num(ex.reps)}`);
  else if (ex.sets.trim()) tokens.push(`${num(ex.sets)} series`);
  else if (ex.reps.trim()) tokens.push(`${num(ex.reps)} reps`);
  if (ex.percent.trim()) tokens.push(`${num(ex.percent)}%`);
  if (ex.load.trim()) tokens.push(`${num(ex.load)} kg`);
  if (ex.time.trim()) tokens.push(ex.time.trim());
  if (ex.distance.trim()) tokens.push(ex.distance.trim());
  const name = ex.name.trim();
  return [name, ...tokens].filter(Boolean).join(SEP);
}

export function serializeBlock(block: ManualBlock): string {
  const lines: string[] = [];
  const header = block.header.trim();
  if (header) lines.push(header);
  for (const ex of block.exercises) {
    const line = serializeExercise(ex);
    if (line) lines.push(line);
  }
  return lines.join("\n");
}

function parseExerciseLine(line: string): ManualExercise | null {
  const parts = line.split(SEP).map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  const ex = emptyExercise();
  ex.name = parts[0];
  for (const token of parts.slice(1)) {
    let m: RegExpMatchArray | null;
    if ((m = token.match(/^([\d.]+)\s*x\s*([\d.]+)$/i))) {
      ex.sets = m[1];
      ex.reps = m[2];
    } else if ((m = token.match(/^([\d.]+)\s*series$/i))) {
      ex.sets = m[1];
    } else if ((m = token.match(/^([\d.]+)\s*reps$/i))) {
      ex.reps = m[1];
    } else if ((m = token.match(/^([\d.]+)\s*%$/))) {
      ex.percent = m[1];
    } else if ((m = token.match(/^([\d.]+)\s*kg$/i))) {
      ex.load = m[1];
    } else if (/^\d+\s*(km|m|mi|metros)$/i.test(token)) {
      ex.distance = token;
    } else if (/^[\d.]+\s*(km|m|mi|metros)$/i.test(token)) {
      ex.distance = token;
    } else if (/(\d+:\d{2}|\d+\s*'|min|seg|s$)/i.test(token)) {
      ex.time = token;
    } else {
      ex.header = ex.header; // no-op para mantener el tipo simple
      ex.name = ex.name; // token no reconocido: se conserva en el nombre
      ex.name = `${ex.name}${SEP}${token}`;
    }
  }
  return ex;
}

/** Convierte un bloque existente (Excel o manual) en estado editable. */
export function parseBlock(key: string, content: string): ManualBlock {
  const upper = key.trim().toUpperCase();
  const type = (BLOCK_TYPES.find((t) => upper.startsWith(t)) ?? "OTRO") as BlockType;
  const headerLines: string[] = [];
  const exercises: ManualExercise[] = [];
  for (const raw of content.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const ex = parseExerciseLine(line);
    if (ex) exercises.push(ex);
    else headerLines.push(line);
  }
  return { id: uid(), key: key.trim() || type, type, header: headerLines.join("\n"), exercises };
}

export function move<T>(arr: T[], from: number, to: number): T[] {
  if (to < 0 || to >= arr.length) return arr;
  const copy = arr.slice();
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}

/** Validación: el bloque necesita tipo y al menos un ejercicio con nombre o un encabezado. */
export function validateBlock(block: ManualBlock): string | null {
  const named = block.exercises.filter((e) => e.name.trim());
  if (!block.header.trim() && named.length === 0) {
    return `El bloque ${block.key} necesita un encabezado o al menos un ejercicio con nombre.`;
  }
  for (const ex of block.exercises) {
    if (!ex.name.trim() && (ex.sets || ex.reps || ex.percent || ex.time || ex.distance || ex.load)) {
      return `Hay un ejercicio sin nombre en el bloque ${block.key}.`;
    }
  }
  return null;
}
