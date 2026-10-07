// Generates a premium RM OR DIE workout card as a PNG image, ready to
// download or share through WhatsApp / social networks via the Web Share API.

export type ShareCardLoad = {
  block: string;
  weight: number | null;
  sets: number | null;
  reps: number | null;
};

export type ShareCardBlock = {
  key: string;
  content: string;
};

export type ShareCardInput = {
  title: string; // e.g. "LUNES"
  subtitle: string; // e.g. "1. OCT · Semana 1"
  date: string; // e.g. "05/10/2026"
  blocks: ShareCardBlock[];
  loads: ShareCardLoad[];
  volume: number | null;
  athlete?: string | null;
};

const W = 1080;
const H = 1350;
const BG = "#0b0d12";
const PANEL = "#14181f";
const BORDER = "rgba(255,255,255,0.08)";
const GOLD = "#d4af37";
const TEXT = "#f2f3f5";
const MUTED = "rgba(242,243,245,0.55)";

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export async function renderWorkoutCard(input: ShareCardInput): Promise<Blob> {
  const W = 1080;
  const pad = 64;
  const contentWidth = W - pad * 2 - 64;
  const contentFont = "500 30px system-ui, sans-serif";
  const lineHeight = 40;

  // Measure the complete workout before creating the canvas. The old renderer
  // used a fixed 1350px canvas and stopped when it reached the footer, which
  // silently clipped blocks E/F and long prescriptions.
  const measureCanvas = document.createElement("canvas");
  measureCanvas.width = 1;
  measureCanvas.height = 1;
  const measureCtx = measureCanvas.getContext("2d");
  if (!measureCtx) throw new Error("Canvas no disponible");

  const wrapMultiline = (text: string): string[] => {
    measureCtx.font = contentFont;
    return text
      .split(/\n+/)
      .flatMap((paragraph) => wrapText(measureCtx, paragraph.trim(), contentWidth));
  };

  const preparedBlocks = input.blocks.map((block) => {
    const content = block.content.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
    const lines = wrapMultiline(content);
    const load = input.loads.find((l) => l.block === block.key);
    const cardH = Math.max(128, 64 + lines.length * lineHeight + (load?.weight ? 76 : 0) + 28);
    return { block, lines, load, cardH };
  });

  const statsHeight = 120;
  const headerBottom = 320 + statsHeight + 40;
  const blocksHeight = preparedBlocks.reduce((sum, item) => sum + item.cardH + 24, 0);
  const footerSpace = 150;
  const H = Math.max(1350, headerBottom + blocksHeight + footerSpace);

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas no disponible");

  // Background with a subtle gold glow.
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, -120, 80, W / 2, -120, 720);
  glow.addColorStop(0, "rgba(212,175,55,0.22)");
  glow.addColorStop(1, "rgba(212,175,55,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Brand.
  ctx.textAlign = "center";
  ctx.fillStyle = GOLD;
  ctx.font = "700 30px system-ui, -apple-system, sans-serif";
  ctx.fillText("R M  O R  D I E", W / 2, 96);
  ctx.strokeStyle = "rgba(212,175,55,0.5)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 140, 122);
  ctx.lineTo(W / 2 + 140, 122);
  ctx.stroke();

  // Title.
  ctx.fillStyle = TEXT;
  ctx.font = "800 76px system-ui, -apple-system, sans-serif";
  ctx.fillText(input.title.toUpperCase(), W / 2, 210);
  ctx.fillStyle = MUTED;
  ctx.font = "500 34px system-ui, -apple-system, sans-serif";
  ctx.fillText(`${input.subtitle} · ${input.date}`, W / 2, 262);

  let y = 320;

  // Stats row.
  const stats: { label: string; value: string }[] = [
    { label: "BLOQUES", value: String(input.blocks.length) },
    {
      label: "VOLUMEN",
      value: input.volume && input.volume > 0 ? `${Math.round(input.volume).toLocaleString("es-ES")} kg` : "—",
    },
  ];
  const statW = (W - pad * 2 - 24) / stats.length;
  stats.forEach((s, i) => {
    const x = pad + i * (statW + 24);
    ctx.fillStyle = PANEL;
    roundRect(ctx, x, y, statW, statsHeight, 24);
    ctx.fill();
    ctx.strokeStyle = BORDER;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = MUTED;
    ctx.font = "600 22px system-ui, sans-serif";
    ctx.fillText(s.label, x + statW / 2, y + 42);
    ctx.fillStyle = s.label === "VOLUMEN" ? GOLD : TEXT;
    ctx.font = "800 44px system-ui, sans-serif";
    ctx.fillText(s.value, x + statW / 2, y + 94);
  });
  y += statsHeight + 40;

  // Render EVERY block. There is deliberately no "maxY" cut-off and no
  // slice() on the text lines, so long sessions remain fully shareable.
  ctx.textAlign = "left";
  for (const item of preparedBlocks) {
    const { block, lines: contentLines, load, cardH } = item;

    ctx.fillStyle = PANEL;
    roundRect(ctx, pad, y, W - pad * 2, cardH, 24);
    ctx.fill();
    ctx.strokeStyle = BORDER;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = GOLD;
    roundRect(ctx, pad, y, 8, cardH, 4);
    ctx.fill();

    ctx.fillStyle = GOLD;
    ctx.font = "700 24px system-ui, sans-serif";
    ctx.fillText(block.key.toUpperCase(), pad + 36, y + 42);

    ctx.fillStyle = TEXT;
    ctx.font = contentFont;
    contentLines.forEach((line, i) => {
      ctx.fillText(line, pad + 36, y + 64 + (i + 1) * lineHeight - 8);
    });

    if (load?.weight) {
      const ly = y + 64 + contentLines.length * lineHeight + 48;
      ctx.fillStyle = GOLD;
      ctx.font = "800 36px system-ui, sans-serif";
      const parts = [`${load.weight} kg`];
      if (load.sets && load.reps) parts.push(`${load.sets}×${load.reps}`);
      ctx.fillText(parts.join("  ·  "), pad + 36, ly);
    }

    y += cardH + 24;
  }

  // Footer is positioned after the final block, not at a fixed canvas
  // coordinate that can overlap or hide the last part of the workout.
  ctx.textAlign = "center";
  ctx.fillStyle = MUTED;
  ctx.font = "500 26px system-ui, sans-serif";
  const footer = input.athlete ? `${input.athlete} · Entrenado con RM OR DIE` : "Entrenado con RM OR DIE";
  ctx.fillText(footer, W / 2, y + 48);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("No se pudo generar la imagen"))), "image/png");
  });
}

export async function shareOrDownloadCard(blob: Blob, filename: string): Promise<"shared" | "downloaded"> {
  const file = new File([blob], filename, { type: "image/png" });
  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
  if (typeof nav.share === "function" && nav.canShare?.({ files: [file] })) {
    await nav.share({ files: [file], title: "Mi entreno — RM OR DIE" });
    return "shared";
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return "downloaded";
}
