// Imagen del entreno para Instagram: historia (9:16), publicación (4:5) o cuadrado,
// con el logo de la app y fondo oscuro, lima o una foto tuya.

export type InstaFormat = "story" | "post" | "square";
export type InstaBg = "dark" | "lime" | "photo";

export type InstaBlock = { key: string; title: string; desc: string; result: string | null };

export type InstaInput = {
  format: InstaFormat;
  bg: InstaBg;
  photo?: HTMLImageElement | null;
  title: string;
  dateLabel: string | null;
  weekLabel: string | null;
  blocks: InstaBlock[];
  stats: { volume: number; rpe: number | null; blocks: number } | null;
  pr: string | null;
  showResults: boolean;
};

export const FORMAT_SIZE: Record<InstaFormat, [number, number]> = {
  story: [1080, 1920],
  post: [1080, 1350],
  square: [1080, 1080],
};

const LIME = "#C6FF00";
const INK = "#0C0C0E";
const NUM = "'Big Shoulders Display', 'Plus Jakarta Sans', system-ui, sans-serif";
const TXT = "'Plus Jakarta Sans', system-ui, sans-serif";

let logoPromise: Promise<HTMLImageElement | null> | null = null;
function loadLogo() {
  logoPromise ??= new Promise((res) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => res(null);
    img.src = "/icon-512.png";
  });
  return logoPromise;
}

export function loadImageFile(file: File): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => rej(new Error("No se pudo abrir la foto"));
    img.src = url;
  });
}

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrap(ctx: CanvasRenderingContext2D, text: string, max: number): string[] {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    const words = para.trim().split(/\s+/).filter(Boolean);
    let line = "";
    for (const w of words) {
      const t = line ? `${line} ${w}` : w;
      if (ctx.measureText(t).width > max && line) { out.push(line); line = w; } else line = t;
    }
    if (line) out.push(line);
  }
  return out;
}

function fitFont(ctx: CanvasRenderingContext2D, text: string, weight: number, family: string, start: number, min: number, max: number) {
  let size = start;
  while (size > min) {
    ctx.font = `${weight} ${size}px ${family}`;
    if (ctx.measureText(text).width <= max) break;
    size -= 4;
  }
  return size;
}

export async function renderInstaCard(input: InstaInput, mime: "image/png" | "image/jpeg" = "image/png"): Promise<Blob> {
  try {
    await Promise.all([
      (document as any).fonts?.load?.(`800 80px 'Big Shoulders Display'`),
      (document as any).fonts?.load?.(`800 40px 'Plus Jakarta Sans'`),
      (document as any).fonts?.load?.(`600 40px 'Plus Jakarta Sans'`),
    ]);
  } catch { /* sin fuentes: se usan las del sistema */ }
  const logo = await loadLogo();
  const [W, H] = FORMAT_SIZE[input.format];
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("Canvas no disponible");

  const lime = input.bg === "lime";
  const FG = lime ? INK : "#F5F5F7";
  const MUTED = lime ? "rgba(12,12,14,.62)" : "rgba(245,245,247,.68)";
  const ACC = lime ? INK : LIME;
  const PANEL = lime ? "rgba(12,12,14,.08)" : input.bg === "photo" ? "rgba(0,0,0,.45)" : "rgba(255,255,255,.065)";

  // Fondo
  if (input.bg === "lime") {
    ctx.fillStyle = LIME; ctx.fillRect(0, 0, W, H);
  } else if (input.bg === "photo" && input.photo) {
    const p = input.photo;
    const s = Math.max(W / p.naturalWidth, H / p.naturalHeight);
    const pw = p.naturalWidth * s, ph = p.naturalHeight * s;
    ctx.drawImage(p, (W - pw) / 2, (H - ph) / 2, pw, ph);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "rgba(0,0,0,.45)"); g.addColorStop(0.45, "rgba(0,0,0,.6)"); g.addColorStop(1, "rgba(0,0,0,.85)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  } else {
    ctx.fillStyle = INK; ctx.fillRect(0, 0, W, H);
    let g = ctx.createRadialGradient(W * 0.8, 0, 40, W * 0.8, 0, H * 0.6);
    g.addColorStop(0, "rgba(26,34,45,1)"); g.addColorStop(1, "rgba(26,34,45,0)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    g = ctx.createRadialGradient(0, H, 40, 0, H, H * 0.5);
    g.addColorStop(0, "rgba(198,255,0,.13)"); g.addColorStop(1, "rgba(198,255,0,0)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }

  const P = 70;
  const top = input.format === "story" ? 250 : 76; // en historias, fuera de la zona del nombre
  const bottomLimit = H - (input.format === "story" ? 300 : 70);
  let y = top;

  // Marca: logo + RM OR DIE + fecha
  const L = 118;
  if (logo) {
    ctx.save(); rr(ctx, P, y, L, L, 28); ctx.clip(); ctx.drawImage(logo, P, y, L, L); ctx.restore();
  }
  ctx.textBaseline = "middle"; ctx.textAlign = "left";
  ctx.font = `800 58px ${TXT}`;
  let x = P + (logo ? L + 26 : 0);
  ctx.fillStyle = FG; ctx.fillText("RM ", x, y + L / 2); x += ctx.measureText("RM ").width;
  ctx.fillStyle = ACC; ctx.fillText("OR", x, y + L / 2);
  if (lime) { const w = ctx.measureText("OR").width; ctx.fillRect(x, y + L / 2 + 30, w, 6); }
  x += ctx.measureText("OR ").width;
  ctx.fillStyle = FG; ctx.fillText("DIE", x, y + L / 2);
  if (input.dateLabel || input.weekLabel) {
    ctx.textAlign = "right"; ctx.fillStyle = MUTED; ctx.font = `600 34px ${TXT}`;
    if (input.dateLabel) ctx.fillText(input.dateLabel, W - P, y + L / 2 - (input.weekLabel ? 22 : 0));
    if (input.weekLabel) ctx.fillText(input.weekLabel, W - P, y + L / 2 + (input.dateLabel ? 24 : 0));
  }
  ctx.textBaseline = "alphabetic"; ctx.textAlign = "left";
  y += L + 70;

  // Título
  const tSize = fitFont(ctx, input.title, 800, TXT, 112, 64, W - P * 2);
  const titleLines = wrap(ctx, input.title, W - P * 2).slice(0, 2);
  ctx.fillStyle = FG;
  titleLines.forEach((l, i) => ctx.fillText(l, P, y + tSize * 0.85 + i * tSize * 1.02));
  y += tSize * 0.85 + (titleLines.length - 1) * tSize * 1.02 + 30;

  if (input.pr) {
    ctx.font = `800 36px ${TXT}`;
    const label = `🏆  ${input.pr}`;
    const w = ctx.measureText(label).width + 52;
    rr(ctx, P, y, w, 66, 33); ctx.fillStyle = ACC; ctx.fill();
    ctx.fillStyle = lime ? LIME : INK; ctx.fillText(label, P + 26, y + 45);
    y += 66 + 30;
  }
  y += 10;

  // Cifras (se omiten si quitarían sitio a los bloques elegidos)
  const roomIfStats = bottomLimit - 60 - (y + 200);
  if (input.stats && input.blocks.length * 100 <= roomIfStats) {
    const tiles: [string, string, boolean][] = [
      [input.stats.volume > 0 ? Math.round(input.stats.volume).toLocaleString("es-ES") : "—", "kg movidos", false],
      [input.stats.rpe != null ? String(Math.round(input.stats.rpe * 10) / 10).replace(".", ",") : "—", "RPE", true],
      [String(input.stats.blocks), input.stats.blocks === 1 ? "bloque" : "bloques", false],
    ];
    const gap = 22, tw = (W - P * 2 - gap * 2) / 3, th = 170;
    tiles.forEach(([v, l, acc], i) => {
      const tx = P + i * (tw + gap);
      rr(ctx, tx, y, tw, th, 34); ctx.fillStyle = PANEL; ctx.fill();
      ctx.fillStyle = acc ? ACC : FG; ctx.font = `800 ${fitFont(ctx, v, 800, NUM, 84, 48, tw - 60)}px ${NUM}`;
      ctx.fillText(v, tx + 30, y + 98);
      ctx.fillStyle = MUTED; ctx.font = `700 30px ${TXT}`; ctx.fillText(l, tx + 30, y + 142);
    });
    y += th + 30;
  }

  // Bloques: primero se acorta la descripción y, si aún no caben, se reduce la letra
  const avail = bottomLimit - 60 - y;
  const gapB = 20;
  const layout = (scale: number, maxDesc: number) => {
    const fT = 46 * scale, fD = 36 * scale, fR = 60 * scale, lh = 1.36, pad = 30 * scale;
    const ks = 54 * scale;
    const inner = W - P * 2 - 34 - ks - 26 - 30;
    let total = 0;
    const items = input.blocks.map((b) => {
      ctx.font = `600 ${fD}px ${TXT}`;
      let desc = b.desc ? wrap(ctx, b.desc, inner) : [];
      if (desc.length > maxDesc) desc = [...desc.slice(0, Math.max(0, maxDesc - 1)), ...(maxDesc > 0 ? [desc[maxDesc - 1] + (desc.length > maxDesc ? " …" : "")] : [])];
      ctx.font = `800 ${fT}px ${TXT}`;
      const title = wrap(ctx, b.title, inner).slice(0, 2);
      const hasRes = input.showResults && !!b.result;
      const h = pad * 2 + title.length * fT * 1.18 + desc.length * fD * lh + (hasRes ? fR * 1.15 : 0);
      total += h + gapB;
      return { b, desc, title, hasRes, h };
    });
    return { items, total: total - gapB, fT, fD, fR, lh, pad, ks };
  };
  let lay = layout(1, 6);
  for (const maxDesc of [4, 3, 2, 1, 0]) { if (lay.total <= avail) break; lay = layout(1, maxDesc); }
  for (let sc = 0.95; lay.total > avail && sc >= 0.5; sc -= 0.05) lay = layout(sc, 0);
  // Si sobra mucho sitio, se agranda un poco (hasta un 25 %)
  if (lay.total < avail * 0.6) {
    const maxDesc = lay.items.reduce((m, it) => Math.max(m, it.desc.length), 0);
    for (let sc = 1.05; sc <= 1.25; sc += 0.05) { const t = layout(sc, Math.max(maxDesc, 6)); if (t.total > avail * 0.85) break; lay = t; }
  }
  for (const it of lay.items) {
    if (y + it.h > bottomLimit - 50) break;
    rr(ctx, P, y, W - P * 2, it.h, 36 * Math.min(1, lay.fT / 46)); ctx.fillStyle = PANEL; ctx.fill();
    const kx = P + 30, ky = y + lay.pad;
    rr(ctx, kx, ky, lay.ks, lay.ks, 14 * (lay.ks / 54)); ctx.fillStyle = ACC; ctx.fill();
    ctx.fillStyle = lime ? LIME : INK; ctx.font = `800 ${lay.ks * 0.56}px ${TXT}`; ctx.textAlign = "center";
    ctx.fillText(it.b.key, kx + lay.ks / 2, ky + lay.ks * 0.7); ctx.textAlign = "left";
    const tx = kx + lay.ks + 26;
    let ty = ky + lay.fT * 0.92;
    ctx.fillStyle = FG; ctx.font = `800 ${lay.fT}px ${TXT}`;
    it.title.forEach((l) => { ctx.fillText(l, tx, ty); ty += lay.fT * 1.18; });
    ctx.fillStyle = lime ? "rgba(12,12,14,.8)" : "rgba(245,245,247,.85)"; ctx.font = `600 ${lay.fD}px ${TXT}`;
    ty += lay.fD * 0.05;
    it.desc.forEach((l) => { ctx.fillText(l, tx, ty); ty += lay.fD * lay.lh; });
    if (it.hasRes) {
      ctx.fillStyle = ACC; ctx.font = `800 ${lay.fR}px ${NUM}`;
      ctx.fillText(it.b.result!, tx, ty + lay.fR * 0.62);
    }
    y += it.h + gapB;
  }

  // Pie
  ctx.fillStyle = MUTED; ctx.font = `700 30px ${TXT}`;
  ctx.textAlign = "left"; ctx.fillText("Entrenado con RM OR DIE", P, bottomLimit);
  ctx.textAlign = "right"; ctx.fillText("rmordie.lovable.app", W - P, bottomLimit);

  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("No se pudo generar la imagen"))), mime, 0.92));
}

/** Guarda la imagen en el móvil (descarga). */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/** Abre el menú de compartir del móvil (Instagram incluido); si no se puede, descarga. */
export async function shareImage(blob: Blob, filename: string): Promise<"shared" | "downloaded"> {
  const file = new File([blob], filename, { type: blob.type });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (typeof nav.share === "function" && nav.canShare?.({ files: [file] })) {
    await nav.share({ files: [file] });
    return "shared";
  }
  downloadBlob(blob, filename);
  return "downloaded";
}
