/**
 * Motor OCR compartido para la importación de planificaciones.
 *
 * - Tesseract.js 7 solo devuelve texto plano por defecto: aquí pedimos también
 *   la salida `blocks` para conocer la posición de cada línea y palabra, que es
 *   lo que permite separar las columnas de cada día.
 * - El worker se reutiliza entre importaciones (cargar el idioma cuesta varios
 *   segundos) y se libera tras un rato sin uso.
 * - Las fotos se preparan antes de reconocerlas: orientación EXIF, tamaño
 *   adecuado, escala de grises y contraste.
 */

export type OcrSegment = { text: string; x: number; y: number };

export type OcrPageResult = {
  /** Fragmentos de línea con posición, separados por huecos grandes (columnas). */
  segments: OcrSegment[];
  /** Líneas en el orden de lectura que propone Tesseract. */
  nativeLines: string[];
  /** Texto plano completo, como último recurso. */
  text: string;
  width: number;
};

type Bbox = { x0: number; y0: number; x1: number; y1: number };
type TessWord = { text?: string; confidence?: number; bbox?: Bbox };
type TessLine = { text?: string; bbox?: Bbox; words?: TessWord[] };
type TessBlock = { paragraphs?: Array<{ lines?: TessLine[] }> };

type TessWorker = {
  recognize: (
    image: HTMLCanvasElement,
    options?: { rotateAuto?: boolean },
    output?: { text?: boolean; blocks?: boolean },
  ) => Promise<{ data: { text?: string; blocks?: TessBlock[] | null } }>;
  setParameters: (params: Record<string, string>) => Promise<unknown>;
  terminate: () => Promise<unknown>;
};

type BrowserTesseract = {
  createWorker: (
    langs?: string | string[],
    oem?: number,
    options?: { logger?: (message: { status?: string; progress?: number }) => void },
  ) => Promise<TessWorker>;
};

const TESSERACT_URL = "https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/tesseract.min.js";
const WORKER_IDLE_MS = 90_000;

let tesseractPromise: Promise<BrowserTesseract> | null = null;
let workerPromise: Promise<TessWorker> | null = null;
let idleTimer: ReturnType<typeof setTimeout> | null = null;
let activeProgress: ((progress: number) => void) | null = null;
let queue: Promise<unknown> = Promise.resolve();

function loadBrowserTesseract(): Promise<BrowserTesseract> {
  const getTesseract = () => (globalThis as typeof globalThis & { Tesseract?: BrowserTesseract }).Tesseract;
  const existing = getTesseract();
  if (existing) return Promise.resolve(existing);
  if (typeof document === "undefined") {
    return Promise.reject(new Error("El OCR solo está disponible en el navegador."));
  }

  if (!tesseractPromise) {
    tesseractPromise = new Promise<BrowserTesseract>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = TESSERACT_URL;
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

function getWorker(): Promise<TessWorker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const Tesseract = await loadBrowserTesseract();
      const worker = await Tesseract.createWorker(["spa", "eng"], 1, {
        logger: (message) => {
          if (message.status === "recognizing text" && typeof message.progress === "number") {
            activeProgress?.(Math.max(0, Math.min(1, message.progress)));
          }
        },
      });
      await worker.setParameters({
        // Conserva los huecos entre columnas en el texto plano.
        preserve_interword_spaces: "1",
        // Las imágenes que preparamos rondan esta densidad; evita el aviso
        // "estimating resolution" y mejora la segmentación.
        user_defined_dpi: "300",
      });
      return worker;
    })().catch((error) => {
      workerPromise = null;
      throw error;
    });
  }
  return workerPromise;
}

function scheduleIdleShutdown() {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    const pending = workerPromise;
    workerPromise = null;
    idleTimer = null;
    pending?.then((worker) => worker.terminate()).catch(() => undefined);
  }, WORKER_IDLE_MS);
}

/**
 * Ejecuta trabajos OCR de uno en uno con el worker compartido.
 * `onProgress` recibe el avance del reconocimiento de la página actual (0–1).
 */
export function withOcrWorker<T>(
  job: (recognize: (canvas: HTMLCanvasElement) => Promise<OcrPageResult>) => Promise<T>,
  onProgress?: (progress: number) => void,
): Promise<T> {
  const run = async () => {
    if (idleTimer) clearTimeout(idleTimer);
    const worker = await getWorker();
    activeProgress = onProgress ?? null;
    try {
      return await job(async (canvas) => {
        const result = await worker.recognize(canvas, { rotateAuto: true }, { text: true, blocks: true });
        return pageFromBlocks(result.data.blocks ?? [], result.data.text ?? "", canvas.width);
      });
    } finally {
      activeProgress = null;
      scheduleIdleShutdown();
    }
  };
  const next = queue.then(run, run);
  queue = next.catch(() => undefined);
  return next;
}

export function normalizeOcrText(value: string): string {
  return value
    .replace(/[×✕]/g, "x")
    .replace(/[‘’´`]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[—–]/g, "-")
    .replace(/^[\s|¦!:;,.·•_~-]+(?=[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9])/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function usableWord(word: TessWord): word is Required<Pick<TessWord, "text" | "bbox">> & TessWord {
  const text = word.text?.trim();
  if (!text || !word.bbox) return false;
  const confidence = word.confidence ?? 100;
  const hasLetterOrDigit = /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9%]/.test(text);
  // Manchas, bordes de tabla y sombras suelen salir como símbolos sueltos de
  // baja confianza: los descartamos sin tocar palabras reales.
  if (!hasLetterOrDigit && confidence < 60) return false;
  return confidence >= 15;
}

function pageFromBlocks(blocks: TessBlock[], text: string, width: number): OcrPageResult {
  const segments: OcrSegment[] = [];
  const nativeLines: string[] = [];

  for (const block of blocks) {
    for (const paragraph of block.paragraphs ?? []) {
      for (const line of paragraph.lines ?? []) {
        const words = (line.words ?? []).filter(usableWord);
        if (!words.length) continue;

        const lineText = normalizeOcrText(words.map((word) => word.text).join(" "));
        if (lineText) nativeLines.push(lineText);

        // Tesseract a veces une en una sola línea texto de columnas distintas
        // (p. ej. "LUNES   MARTES   MIÉRCOLES"). Cortamos donde el hueco entre
        // palabras es claramente mayor que el espacio normal.
        const height = median(words.map((word) => word.bbox.y1 - word.bbox.y0)) || 20;
        const gapLimit = Math.max(height * 1.6, 18);
        let current: typeof words = [];
        const flush = () => {
          if (!current.length) return;
          const segmentText = normalizeOcrText(current.map((word) => word.text).join(" "));
          if (segmentText) {
            segments.push({
              text: segmentText,
              x: current[0].bbox.x0,
              y: Math.min(...current.map((word) => word.bbox.y0)),
            });
          }
          current = [];
        };
        for (const word of words) {
          const previous = current.at(-1);
          if (previous && word.bbox.x0 - previous.bbox.x1 > gapLimit) flush();
          current.push(word);
        }
        flush();
      }
    }
  }

  return { segments, nativeLines, text, width };
}

// ---------------------------------------------------------------------------
// Preparación de imágenes
// ---------------------------------------------------------------------------

const MIN_OCR_WIDTH = 1800;
const MAX_OCR_SIDE = 3200;

async function decodeImage(file: Blob): Promise<{ source: CanvasImageSource; width: number; height: number; release: () => void }> {
  if (typeof createImageBitmap === "function") {
    try {
      // `from-image` aplica la orientación EXIF de las fotos del móvil.
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
    } catch {
      // Algunos navegadores no aceptan la opción; seguimos con <img>.
    }
  }

  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = url;
    await image.decode();
    return { source: image, width: image.naturalWidth, height: image.naturalHeight, release: () => undefined };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Pasa a gris y estira el contraste usando percentiles (ignora reflejos y sombras extremas). */
export function enhanceCanvasForOcr(canvas: HTMLCanvasElement) {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return;
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  const data = image.data;
  const histogram = new Uint32Array(256);
  const pixels = data.length / 4;

  for (let i = 0; i < data.length; i += 4) {
    const gray = (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000;
    const value = gray | 0;
    data[i] = value;
    histogram[value]++;
  }

  const percentile = (fraction: number) => {
    const target = pixels * fraction;
    let total = 0;
    for (let value = 0; value < 256; value++) {
      total += histogram[value];
      if (total >= target) return value;
    }
    return 255;
  };
  const low = percentile(0.02);
  const high = percentile(0.98);
  const range = Math.max(1, high - low);

  for (let i = 0; i < data.length; i += 4) {
    const stretched = Math.max(0, Math.min(255, ((data[i] - low) * 255) / range));
    data[i] = data[i + 1] = data[i + 2] = stretched;
    data[i + 3] = 255;
  }
  context.putImageData(image, 0, 0);
}

export async function imageFileToOcrCanvas(file: Blob): Promise<HTMLCanvasElement> {
  const decoded = await decodeImage(file);
  try {
    let scale = 1;
    const longest = Math.max(decoded.width, decoded.height);
    if (longest > MAX_OCR_SIDE) scale = MAX_OCR_SIDE / longest;
    else if (decoded.width < MIN_OCR_WIDTH) scale = Math.min(3, MIN_OCR_WIDTH / Math.max(1, decoded.width));

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(decoded.width * scale));
    canvas.height = Math.max(1, Math.round(decoded.height * scale));
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("El navegador no permite procesar la imagen.");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(decoded.source, 0, 0, canvas.width, canvas.height);
    enhanceCanvasForOcr(canvas);
    return canvas;
  } finally {
    decoded.release();
  }
}

/** Escala para renderizar una página PDF con texto suficientemente grande para el OCR. */
export function pdfOcrScale(pageWidthAtScale1: number): number {
  return Math.max(2, Math.min(4, 2500 / Math.max(1, pageWidthAtScale1)));
}
