import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Download, ImagePlus, Share2, X } from "lucide-react";
import { toast } from "sonner";
import { downloadBlob, FORMAT_SIZE, loadImageFile, renderInstaCard, shareImage, type InstaBg, type InstaBlock, type InstaFormat } from "@/lib/insta-card";
import type { WorkoutResult } from "@/lib/store";

const FORMATS: { key: InstaFormat; label: string; ratio: string }[] = [
  { key: "story", label: "Historia", ratio: "9:16" },
  { key: "post", label: "Publicación", ratio: "4:5" },
  { key: "square", label: "Cuadrado", ratio: "1:1" },
];
const BGS: { key: InstaBg; label: string }[] = [
  { key: "dark", label: "Oscuro" },
  { key: "lime", label: "Lima" },
  { key: "photo", label: "Tu foto" },
];
const PREFS = "rmordie_insta_prefs";

const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
const n = (v: number) => String(Math.round(v * 100) / 100).replace(".", ",");

/** Lo que hiciste en un bloque, en una línea corta. */
export function blockResult(rows: WorkoutResult[]): string | null {
  const done = rows.filter((r) => r.status === "completed");
  if (!done.length) return null;
  const r = [...done].sort((a, b) => (Number(b.weight) || 0) - (Number(a.weight) || 0))[0];
  if (r.weight && Number(r.weight) > 0) {
    const parts = [`${n(Number(r.weight))} kg`];
    if (r.reps) parts.push(String(r.reps));
    if (r.sets && r.sets > 1) parts.push(String(r.sets));
    return parts.join(" × ");
  }
  if (r.time_seconds) return fmtTime(r.time_seconds);
  if (r.reps) return `${r.reps} reps`;
  return "Hecho ✓";
}

function splitBlock(content: string) {
  const lines = content.split("\n").map((l) => l.trim()).filter(Boolean);
  return { title: lines[0] ?? "", desc: lines.slice(1).join("\n") };
}

export function InstaShareSheet({
  blocks, results, prLabel, title, dateLabel, weekLabel, filename, onDone, onClose,
}: {
  blocks: { key: string; content: string }[];
  results: WorkoutResult[];
  prLabel: string | null;
  title: string;
  dateLabel: string | null;
  weekLabel: string | null;
  filename: string;
  onDone?: () => void;
  onClose: () => void;
}) {
  const saved = (() => { try { return JSON.parse(localStorage.getItem(PREFS) ?? "{}"); } catch { return {}; } })();
  const [sel, setSel] = useState<string[]>(() => blocks.map((b) => b.key));
  const [format, setFormat] = useState<InstaFormat>(saved.format ?? "story");
  const [bg, setBg] = useState<InstaBg>(saved.bg === "photo" ? "dark" : saved.bg ?? "dark");
  const [show, setShow] = useState<{ res: boolean; stats: boolean; date: boolean; pr: boolean }>({ res: true, stats: true, date: true, pr: true, ...(saved.show ?? {}) });
  const [photo, setPhoto] = useState<HTMLImageElement | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | "share" | "png" | "jpg">(null);
  const photoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try { localStorage.setItem(PREFS, JSON.stringify({ format, bg, show })); } catch { /* sin almacenamiento */ }
  }, [format, bg, show]);

  const input = useMemo(() => {
    const chosen = blocks.filter((b) => sel.includes(b.key));
    const items: InstaBlock[] = chosen.map((b) => {
      const { title: t, desc } = splitBlock(b.content);
      return { key: b.key, title: t, desc, result: blockResult(results.filter((r) => r.block_key === b.key)) };
    });
    const rows = results.filter((r) => sel.includes(r.block_key) && r.status === "completed");
    const volume = rows.reduce((a, r) => a + (Number(r.weight) || 0) * (Number(r.sets) || 1) * (Number(r.reps) || 0), 0);
    const rpes = rows.map((r) => r.rpe).filter((x): x is number => x != null);
    const autoTitle = items.length === blocks.length || items.length === 0 ? title : items.slice(0, 2).map((i) => i.title.replace(/\s*[@(].*$/, "")).join(" + ");
    return {
      format, bg, photo: bg === "photo" ? photo : null,
      title: autoTitle || title,
      dateLabel: show.date ? dateLabel : null,
      weekLabel: show.date ? weekLabel : null,
      blocks: items,
      stats: show.stats ? { volume, rpe: rpes.length ? rpes.reduce((a, b) => a + b, 0) / rpes.length : null, blocks: items.length } : null,
      pr: show.pr ? prLabel : null,
      showResults: show.res,
    };
  }, [blocks, sel, results, format, bg, photo, show, title, dateLabel, weekLabel, prLabel]);

  // Vista previa en vivo (con una pequeña espera para no regenerar en cada toque)
  useEffect(() => {
    if (!sel.length) { setPreview(null); return; }
    let alive = true;
    let url: string | null = null;
    const t = setTimeout(async () => {
      try {
        const blob = await renderInstaCard(input, "image/jpeg");
        if (!alive) return;
        url = URL.createObjectURL(blob);
        setPreview((old) => { if (old) URL.revokeObjectURL(old); return url; });
      } catch { /* la vista previa no es crítica */ }
    }, 180);
    return () => { alive = false; clearTimeout(t); };
  }, [input, sel.length]);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function act(kind: "share" | "png" | "jpg") {
    if (!sel.length) return;
    setBusy(kind);
    try {
      const mime = kind === "png" ? "image/png" : "image/jpeg";
      const blob = await renderInstaCard(input, mime);
      const name = `${filename}-${format}.${kind === "png" ? "png" : "jpg"}`;
      if (kind === "share") {
        const out = await shareImage(blob, name);
        toast.success(out === "shared" ? "Listo para Instagram" : "Imagen descargada");
      } else {
        downloadBlob(blob, name);
        toast.success(`Imagen ${kind.toUpperCase()} descargada`);
      }
      onDone?.();
    } catch (e: any) {
      if (e?.name !== "AbortError") toast.error(e?.message ?? "No se pudo crear la imagen");
    } finally {
      setBusy(null);
    }
  }

  const chip = (on: boolean) => (on ? { background: "#333B18", color: "var(--gold)" } : { background: "rgba(255,255,255,.07)", color: "var(--muted-foreground)" });
  const [w, h] = FORMAT_SIZE[format];

  return createPortal(
    <div className="fixed inset-0 z-[75] flex items-end" role="dialog" aria-label="Compartir entreno">
      <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={async (e) => {
        const f = e.target.files?.[0]; e.target.value = "";
        if (!f) return;
        try { setPhoto(await loadImageFile(f)); setBg("photo"); } catch (err: any) { toast.error(err?.message ?? "No se pudo abrir la foto"); }
      }} />
      <button aria-label="Cerrar" onClick={onClose} className="absolute inset-0 bg-black/70 backdrop-blur-[4px]" />
      <div className="animate-fade relative mx-auto max-h-[94dvh] w-full max-w-2xl overflow-y-auto overscroll-contain rounded-t-[28px] border-t border-white/10 bg-[#141416] px-4 pt-3" style={{ paddingBottom: "max(env(safe-area-inset-bottom), 18px)" }}>
        <div aria-hidden className="mx-auto mb-2 h-[5px] w-10 rounded-full bg-white/20" />
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[19px] font-extrabold">Compartir entreno</h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="grid h-10 w-10 place-items-center rounded-full bg-white/[0.07]"><X className="h-[18px] w-[18px]" /></button>
        </div>

        {/* Vista previa */}
        <div className="mx-auto mb-4 overflow-hidden rounded-[16px] bg-black/40 shadow-[0_12px_40px_rgba(0,0,0,.5)]" style={{ width: format === "story" ? "52%" : format === "post" ? "62%" : "66%", aspectRatio: `${w} / ${h}` }}>
          {preview ? <img src={preview} alt="Vista previa de la imagen" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center p-4 text-center text-[13px] text-muted-foreground">{sel.length ? "Creando vista previa…" : "Elige al menos un bloque"}</div>}
        </div>

        <div className="flex flex-col gap-3.5">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[13px] font-bold text-muted-foreground">Qué bloques</span>
              <button type="button" onClick={() => setSel(sel.length === blocks.length ? [] : blocks.map((b) => b.key))} className="min-h-9 px-1 text-[13px] font-bold text-gold">{sel.length === blocks.length ? "Ninguno" : "Todos"}</button>
            </div>
            <div className="flex flex-col gap-1.5">
              {blocks.map((b) => {
                const on = sel.includes(b.key);
                const { title: t } = splitBlock(b.content);
                const res = blockResult(results.filter((r) => r.block_key === b.key));
                return (
                  <button key={b.key} type="button" aria-pressed={on} onClick={() => setSel(on ? sel.filter((k) => k !== b.key) : blocks.map((x) => x.key).filter((k) => k === b.key || sel.includes(k)))} className="flex min-h-14 w-full items-center gap-2.5 rounded-[14px] px-3 text-left" style={on ? { background: "#262C12", boxShadow: "inset 0 0 0 1px rgba(198,255,0,.25)" } : { background: "rgba(255,255,255,.04)" }}>
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-[9px] text-[13px] font-extrabold" style={on ? { background: "var(--gold)", color: "var(--gold-foreground)" } : { background: "rgba(255,255,255,.08)" }}>{b.key}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14.5px] font-bold">{t}</span>
                      {res && <span className="block truncate text-[12.5px] text-muted-foreground">{res}</span>}
                    </span>
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-[8px] border-2" style={on ? { background: "var(--gold)", borderColor: "var(--gold)", color: "var(--gold-foreground)" } : { borderColor: "rgba(255,255,255,.25)" }}>{on && <Check className="h-3.5 w-3.5" strokeWidth={3} />}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="mb-2 text-[13px] font-bold text-muted-foreground">Formato</p>
            <div className="flex gap-1 rounded-[14px] bg-white/[0.05] p-1">
              {FORMATS.map((f) => (
                <button key={f.key} type="button" onClick={() => setFormat(f.key)} className="flex min-h-12 flex-1 flex-col items-center justify-center rounded-[10px] text-[13px] font-bold" style={format === f.key ? { background: "#333B18", color: "var(--gold)" } : { color: "var(--muted-foreground)" }}>
                  {f.label}<span className="text-[11px] font-semibold opacity-80">{f.ratio}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-[13px] font-bold text-muted-foreground">Fondo</p>
            <div className="flex gap-1 rounded-[14px] bg-white/[0.05] p-1">
              {BGS.map((b) => (
                <button key={b.key} type="button" onClick={() => (b.key === "photo" && !photo ? photoRef.current?.click() : setBg(b.key))} className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-[10px] text-[13px] font-bold" style={bg === b.key ? { background: "#333B18", color: "var(--gold)" } : { color: "var(--muted-foreground)" }}>
                  {b.key === "photo" && <ImagePlus className="h-4 w-4" />}{b.label}
                </button>
              ))}
            </div>
            {bg === "photo" && photo && <button type="button" onClick={() => photoRef.current?.click()} className="mt-1.5 min-h-9 text-[13px] font-semibold text-gold">Cambiar foto</button>}
          </div>

          <div>
            <p className="mb-2 text-[13px] font-bold text-muted-foreground">Mostrar</p>
            <div className="flex flex-wrap gap-1.5">
              {([["res", "Mis resultados"], ["stats", "Kilos y RPE"], ["date", "Fecha"], ...(prLabel ? [["pr", "Récord"]] : [])] as [keyof typeof show, string][]).map(([k, l]) => (
                <button key={k} type="button" onClick={() => setShow({ ...show, [k]: !show[k] })} className="min-h-9 rounded-full px-3 text-[13px] font-bold" style={chip(show[k])}>{show[k] ? "✓ " : ""}{l}</button>
              ))}
            </div>
          </div>

          <button type="button" disabled={!sel.length || !!busy} onClick={() => act("share")} className="pressable mt-1 flex min-h-[54px] items-center justify-center gap-2 rounded-full text-[16px] font-extrabold disabled:opacity-50" style={{ background: "var(--gold)", color: "var(--gold-foreground)" }}>
            <Share2 className="h-5 w-5" />{busy === "share" ? "Creando…" : "Compartir en Instagram"}
          </button>
          <div className="grid grid-cols-2 gap-2">
            {(["png", "jpg"] as const).map((k) => (
              <button key={k} type="button" disabled={!sel.length || !!busy} onClick={() => act(k)} className="pressable flex min-h-12 items-center justify-center gap-1.5 rounded-full bg-white/[0.08] text-[14px] font-extrabold disabled:opacity-50">
                <Download className="h-4 w-4" />{busy === k ? "Creando…" : k.toUpperCase()}
              </button>
            ))}
          </div>
          <p className="text-center text-[12px] text-muted-foreground">«Compartir» abre el menú del móvil, donde eliges Instagram. PNG y JPG guardan la imagen.</p>
        </div>
      </div>
    </div>,
    document.body,
  );
}
