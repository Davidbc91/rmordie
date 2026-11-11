/**
 * Lector inteligente: convierte cualquier archivo (Excel, CSV, TXT, PDF, fotos
 * o texto pegado) en el contenido que entiende la IA, lo lee por partes y
 * devuelve un plan con fechas reales (PlanState del planificador).
 */
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { addDays, isoKey, parseISODate } from "./plan-dates";
import { DAY_KEYS, mondayOf, nextMonday, pid, type PDay, type PlanState } from "./plan-builder";

export type AiBlock = { label: string; kind: string; content: string };
export type AiSession = {
  order: number;
  date: string | null;
  weekday: (typeof DAY_KEYS)[number] | null;
  week: number | null;
  title?: string | null;
  rest: boolean;
  blocks: AiBlock[];
};
export type AiReadResult = { plan_name: string; notes: string[]; sessions: AiSession[] };

type Chunk = { text?: string; images?: string[] };

const MAX_TEXT = 24_000;
const IMAGES_PER_CHUNK = 4;

export class AiReaderUnavailable extends Error {}

// ---------- 1. Sacar el contenido del archivo ----------

function splitText(text: string, max = MAX_TEXT): string[] {
  if (text.length <= max) return [text];
  const out: string[] = [];
  let cur = "";
  for (const line of text.split("\n")) {
    if (cur.length + line.length + 1 > max && cur) {
      out.push(cur);
      cur = "";
    }
    cur += (cur ? "\n" : "") + line;
  }
  if (cur) out.push(cur);
  return out;
}

function cellToText(v: unknown): string {
  if (v instanceof Date) return isoKey(v);
  return String(v ?? "").replace(/\r/g, "").replace(/\n+/g, " / ").trim();
}

/** Cada hoja como tabla de texto: celdas con " | " y número de fila. */
function workbookToText(wb: XLSX.WorkBook): string[] {
  const sheets: string[] = [];
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    if (!ws) continue;
    // Las celdas combinadas se rellenan para que cada día "vea" su cabecera
    for (const merge of ws["!merges"] ?? []) {
      const first = ws[XLSX.utils.encode_cell(merge.s)];
      if (!first) continue;
      for (let r = merge.s.r; r <= merge.e.r; r++) {
        for (let c = merge.s.c; c <= merge.e.c; c++) {
          if (r === merge.s.r && c === merge.s.c) continue;
          const addr = XLSX.utils.encode_cell({ r, c });
          if (!ws[addr]) ws[addr] = { ...first };
        }
      }
    }
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "", raw: false, dateNF: "yyyy-mm-dd" });
    const lines = rows
      .map((row, i) => {
        const cells = row.map(cellToText);
        while (cells.length && !cells[cells.length - 1]) cells.pop();
        return cells.some(Boolean) ? `${i + 1}: ${cells.join(" | ")}` : "";
      })
      .filter(Boolean);
    if (lines.length) sheets.push(`### Hoja: ${name}\n${lines.join("\n")}`);
  }
  return sheets;
}

async function pdfContent(file: File): Promise<Chunk[]> {
  const { GlobalWorkerOptions, getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const worker = (await import("pdfjs-dist/legacy/build/pdf.worker.mjs?url")).default;
  GlobalWorkerOptions.workerSrc = worker;
  const pdf = await getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages: string[] = [];
  const scanned: number[] = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n);
    const content = await page.getTextContent();
    const items = (content.items as Array<{ str?: string; transform?: number[] }>)
      .filter((it) => it.str?.trim())
      .map((it) => ({ s: it.str!, x: it.transform?.[4] ?? 0, y: it.transform?.[5] ?? 0 }));
    // Agrupar por renglón (misma altura) y ordenar de izquierda a derecha
    items.sort((a, b) => b.y - a.y || a.x - b.x);
    const lines: { y: number; parts: typeof items }[] = [];
    for (const it of items) {
      const line = lines.find((l) => Math.abs(l.y - it.y) < 3);
      if (line) line.parts.push(it);
      else lines.push({ y: it.y, parts: [it] });
    }
    const text = lines.map((l) => l.parts.sort((a, b) => a.x - b.x).map((p) => p.s).join("  ")).join("\n");
    if (text.replace(/\s/g, "").length < 80) scanned.push(n);
    else pages.push(`### Página ${n}\n${text}`);
  }

  const chunks: Chunk[] = splitText(pages.join("\n\n")).filter((t) => t.trim()).map((text) => ({ text }));

  // Páginas escaneadas (sin texto): se mandan como imagen
  const images: string[] = [];
  for (const n of scanned.slice(0, 24)) {
    const page = await pdf.getPage(n);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: Math.min(2.5, 1600 / base.width) });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport, canvas } as never).promise;
    images.push(canvas.toDataURL("image/jpeg", 0.82));
    canvas.width = canvas.height = 1;
  }
  for (let i = 0; i < images.length; i += IMAGES_PER_CHUNK) chunks.push({ images: images.slice(i, i + IMAGES_PER_CHUNK) });
  await pdf.loadingTask.destroy();
  return chunks;
}

/** Foto a JPEG de tamaño razonable (lado largo 2000 px). */
export async function imageToDataUrl(file: Blob): Promise<string> {
  const bitmap = await createImageBitmap(file).catch(() => null);
  let source: CanvasImageSource;
  let w: number;
  let h: number;
  let release = () => {};
  if (bitmap) {
    source = bitmap;
    w = bitmap.width;
    h = bitmap.height;
    release = () => bitmap.close();
  } else {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.src = url;
    await img.decode();
    source = img;
    w = img.naturalWidth;
    h = img.naturalHeight;
    release = () => URL.revokeObjectURL(url);
  }
  const scale = Math.min(1, 2000 / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  canvas.getContext("2d")!.drawImage(source, 0, 0, canvas.width, canvas.height);
  release();
  const url = canvas.toDataURL("image/jpeg", 0.85);
  canvas.width = canvas.height = 1;
  return url;
}

const isImage = (f: File) => /^image\//i.test(f.type) || /\.(png|jpe?g|webp|heic|heif)$/i.test(f.name);
const isPdf = (f: File) => f.type === "application/pdf" || /\.pdf$/i.test(f.name);
const isText = (f: File) => /^text\//i.test(f.type) || /\.(txt|md|csv|tsv|json)$/i.test(f.name);

/** Contenido de uno o varios archivos (y/o texto pegado), troceado para la IA. */
export async function extractChunks(files: File[], pasted = ""): Promise<Chunk[]> {
  const chunks: Chunk[] = [];
  const texts: string[] = [];
  const images: string[] = [];

  if (pasted.trim()) texts.push(`### Texto pegado\n${pasted.trim()}`);

  for (const f of files) {
    if (isImage(f)) {
      images.push(await imageToDataUrl(f));
    } else if (isPdf(f)) {
      chunks.push(...(await pdfContent(f)));
    } else if (isText(f) && !/\.csv$/i.test(f.name)) {
      texts.push(`### Archivo: ${f.name}\n${await f.text()}`);
    } else {
      // Excel, ODS, Numbers exportado, CSV…
      const wb = XLSX.read(await f.arrayBuffer(), { type: "array", cellDates: true });
      texts.push(...workbookToText(wb).map((t) => `### Archivo: ${f.name}\n${t}`));
    }
  }

  // Juntar textos pequeños en una sola lectura; partir los grandes
  let cur = "";
  for (const t of texts.flatMap((t) => splitText(t))) {
    if (cur && cur.length + t.length > MAX_TEXT) {
      chunks.unshift({ text: cur });
      cur = "";
    }
    cur += (cur ? "\n\n" : "") + t;
  }
  if (cur) chunks.unshift({ text: cur });
  for (let i = 0; i < images.length; i += IMAGES_PER_CHUNK) chunks.push({ images: images.slice(i, i + IMAGES_PER_CHUNK) });
  return chunks;
}

// ---------- 2. Leer con la IA ----------

async function readChunk(chunk: Chunk, meta: { filename: string; part: number; parts: number; hint?: string }): Promise<AiReadResult> {
  const { data, error } = await supabase.functions.invoke("plan-reader", {
    body: { ...chunk, ...meta, today: isoKey(new Date()) },
  });
  if (error) {
    // El cuerpo del error trae el motivo en español
    let message = error.message;
    let code = "";
    const ctx = (error as { context?: Response }).context;
    if (ctx && (ctx.status === 401 || ctx.status === 404)) code = "no_ai";
    try {
      const body = ctx ? await ctx.json() : null;
      if (body?.error) message = body.error;
      code = body?.code ?? code;
    } catch { /* sin cuerpo */ }
    if (code === "no_ai" || /Failed to send|not found|404/i.test(message)) throw new AiReaderUnavailable(message);
    throw new Error(message);
  }
  return data as AiReadResult;
}

export async function readPlanWithAi(
  chunks: Chunk[],
  opts: { filename: string; hint?: string; onProgress?: (done: number, total: number) => void },
): Promise<AiReadResult> {
  if (!chunks.length) throw new Error("No he encontrado contenido que leer en el archivo.");
  const results: AiReadResult[] = new Array(chunks.length);
  let done = 0;
  let next = 0;
  opts.onProgress?.(0, chunks.length);
  async function worker() {
    while (next < chunks.length) {
      const i = next++;
      results[i] = await readChunk(chunks[i], { filename: opts.filename, part: i + 1, parts: chunks.length, hint: opts.hint });
      opts.onProgress?.(++done, chunks.length);
    }
  }
  await Promise.all(Array.from({ length: Math.min(3, chunks.length) }, worker));

  const sessions: AiSession[] = [];
  let offset = 0;
  for (const r of results) {
    const list = Array.isArray(r?.sessions) ? r.sessions : [];
    for (const s of list) sessions.push({ ...s, order: offset + (Number(s.order) || 0) });
    offset += 10_000;
  }
  return {
    plan_name: results.find((r) => r?.plan_name)?.plan_name ?? "Mi plan",
    notes: [...new Set(results.flatMap((r) => r?.notes ?? []).filter(Boolean))],
    sessions,
  };
}

// ---------- 3. De sesiones a plan con fechas ----------

const WEEKDAY_INDEX: Record<string, number> = Object.fromEntries(DAY_KEYS.map((d, i) => [d, i]));

/** ¿Faltan fechas? Entonces hace falta preguntar cuándo empieza. */
export function needsStartDate(r: AiReadResult) {
  return r.sessions.some((s) => !s.rest && !parseISODate(s.date ?? ""));
}

function blockTitle(b: AiBlock) {
  const label = (b.label ?? "").trim();
  // Una sola letra (A, B, C) ya la pone la app
  return /^[A-Z][).:-]?$/i.test(label) ? "" : label;
}

/** Fecha de cada sesión: la que trae, o la deducida a partir del inicio. */
export function placeSessions(r: AiReadResult, startIso: string): Array<AiSession & { iso: string }> {
  const sorted = [...r.sessions].sort((a, b) => a.order - b.order);
  const dated = sorted.map((s) => parseISODate(s.date ?? "")).filter(Boolean) as Date[];
  const anchor = mondayOf(parseISODate(startIso) ?? (dated.length ? new Date(Math.min(...dated.map((d) => d.getTime()))) : new Date()));

  let seqWeek = 0;
  let lastWeekday = -1;
  let lastDate: Date | null = null;
  return sorted.map((s) => {
    const exact = parseISODate(s.date ?? "");
    if (exact) {
      lastDate = exact;
      lastWeekday = (exact.getDay() + 6) % 7;
      return { ...s, iso: isoKey(exact) };
    }
    const wd = s.weekday ? WEEKDAY_INDEX[s.weekday] : undefined;
    let date: Date;
    if (wd !== undefined && s.week && s.week > 0) {
      date = addDays(anchor, (s.week - 1) * 7 + wd);
    } else if (wd !== undefined) {
      if (lastDate) {
        // siguiente día con ese nombre después del anterior
        const base = mondayOf(lastDate);
        date = addDays(base, wd <= lastWeekday ? wd + 7 : wd);
      } else {
        if (wd <= lastWeekday) seqWeek++;
        date = addDays(anchor, seqWeek * 7 + wd);
      }
    } else {
      date = lastDate ? addDays(lastDate, 1) : parseISODate(startIso) ?? anchor;
    }
    lastDate = date;
    lastWeekday = (date.getDay() + 6) % 7;
    return { ...s, iso: isoKey(date) };
  });
}

export function toPlanState(r: AiReadResult, startIso: string, name?: string): PlanState {
  const placed = placeSessions(r, startIso);
  const byDate = new Map<string, PDay>();
  for (const s of placed) {
    const blocks = s.rest
      ? []
      : s.blocks
          .filter((b) => b.content?.trim())
          .map((b) => ({ id: pid(), kind: "texto" as const, title: blockTitle(b), text: b.content.trim() }));
    const existing = byDate.get(s.iso);
    if (existing) {
      // Dos lecturas del mismo día (sesión doble o partes solapadas): se juntan sin repetir
      const seen = new Set(existing.blocks.map((b) => (b.kind === "texto" ? `${b.title}|${b.text}` : "")));
      for (const b of blocks) if (!seen.has(`${b.title}|${b.text}`)) existing.blocks.push(b);
      existing.rest = existing.blocks.length === 0;
    } else {
      byDate.set(s.iso, { date: s.iso, rest: blocks.length === 0, blocks });
    }
  }
  const dates = [...byDate.keys()].sort();
  const first = mondayOf(parseISODate(dates[0] ?? startIso) ?? new Date());
  const last = parseISODate(dates[dates.length - 1] ?? startIso) ?? first;
  const weeks: PDay[][] = [];
  for (let monday = first; monday <= last; monday = addDays(monday, 7)) {
    weeks.push(
      DAY_KEYS.map((_, i) => {
        const iso = isoKey(addDays(monday, i));
        return byDate.get(iso) ?? { date: iso, rest: true, blocks: [] };
      }),
    );
  }
  return { v: 1, name: (name ?? r.plan_name ?? "Mi plan").trim() || "Mi plan", start: isoKey(first), weeks };
}

export function defaultStart() {
  return nextMonday();
}
