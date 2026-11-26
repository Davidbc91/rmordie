import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { FAMILIES, nextMedal, type MedalFamily, type MedalState } from "@/lib/medals";
import { useMedals, useStoreMedals } from "@/lib/use-medals";
import { getCurrentUserId } from "@/lib/pin-gate";
import { MedalIcon } from "./MedalIcon";

const TIER_LABEL = { bronce: "Bronce", plata: "Plata", oro: "Oro", leyenda: "Leyenda" } as const;

const fmtDate = (iso: string | null | undefined) =>
  iso ? new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" }) : null;

function earnedDate(m: MedalState, savedAt: Map<string, string>) {
  return m.earnedOn ?? savedAt.get(m.code) ?? null;
}

/* ---------------- Tira del perfil ---------------- */

export function MedalsStrip({ onOpen }: { onOpen: () => void }) {
  const { list, savedAt } = useMedals();
  const earned = list.filter((m) => m.earned);
  const latest = [...earned].sort((a, b) => (earnedDate(b, savedAt) ?? "").localeCompare(earnedDate(a, savedAt) ?? "")).slice(0, 4);
  const next = nextMedal(list);

  return (
    <section className="rise rise-3 mt-4">
      <button type="button" onClick={onOpen} className="mb-2 flex min-h-9 w-full items-baseline justify-between px-1 text-left">
        <span className="text-[17px] font-extrabold tracking-tight">Medallas</span>
        <span className="flex items-center gap-0.5 text-[13.5px] font-semibold text-muted-foreground">
          {earned.length} de {list.length} <ChevronRight className="h-4 w-4" />
        </span>
      </button>
      {latest.length > 0 ? (
        <button type="button" onClick={onOpen} className="grid w-full grid-cols-4 gap-1.5">
          {latest.map((m) => (
            <span key={m.code} className="flex min-w-0 flex-col items-center gap-1.5 text-center">
              <MedalIcon family={m.family} tier={m.tier} code={m.code} badge={m.badge} earned size={68} />
              <span className="line-clamp-2 text-xs font-semibold leading-tight">{m.name}</span>
            </span>
          ))}
        </button>
      ) : (
        <p className="px-1 text-sm text-muted-foreground">Completa tu primer entreno y empieza la colección.</p>
      )}
      {next && (
        <button
          type="button"
          onClick={onOpen}
          className="pressable mt-3 flex w-full items-center gap-3 rounded-[20px] border p-3.5 text-left"
          style={{ background: "#262C12", borderColor: "rgba(198,255,0,.2)" }}
        >
          <MedalIcon family={next.family} tier={next.tier} code={next.code} badge={next.badge} earned={false} size={54} />
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] text-muted-foreground">Siguiente medalla</span>
            <span className="block truncate text-[15.5px] font-bold">{next.name}</span>
            <span className="mt-1.5 block h-[7px] overflow-hidden rounded-full bg-white/[0.08]">
              <span className="block h-full rounded-full" style={{ width: `${Math.round(next.progress * 100)}%`, background: "var(--gold)" }} />
            </span>
            {next.progressText && <span className="mt-1 block text-[13px] text-muted-foreground">{next.progressText}</span>}
          </span>
        </button>
      )}
    </section>
  );
}

/* ---------------- Vitrina completa ---------------- */

export function MedalsShowcase() {
  const { list, savedAt } = useMedals();
  const [filter, setFilter] = useState<MedalFamily | "all">("all");
  const [open, setOpen] = useState<MedalState | null>(null);
  const earned = list.filter((m) => m.earned).length;
  const families = FAMILIES.filter((f) => filter === "all" || f.key === filter);

  return (
    <div className="space-y-5">
      <p className="-mt-2 text-[15px] text-muted-foreground">
        <span className="num mr-1 text-[24px] text-gold">{earned}</span>de {list.length} desbloqueadas
      </p>
      <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1" style={{ scrollbarWidth: "none" }}>
        {[{ key: "all" as const, label: "Todas" }, ...FAMILIES].map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className="min-h-9 shrink-0 rounded-full px-3.5 text-[13px] font-semibold"
            style={filter === f.key ? { background: "#333B18", color: "var(--gold)" } : { background: "rgba(255,255,255,0.07)", color: "var(--muted-foreground)" }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {families.map((f) => {
        const items = list.filter((m) => m.family === f.key);
        return (
          <section key={f.key}>
            <div className="mb-3 flex items-baseline justify-between px-1">
              <h2 className="text-[16px] font-extrabold tracking-tight">{f.label}</h2>
              <span className="text-[13px] text-muted-foreground">{items.filter((m) => m.earned).length} de {items.length}</span>
            </div>
            <div className="grid grid-cols-3 gap-x-1.5 gap-y-4">
              {items.map((m) => (
                <button key={m.code} type="button" onClick={() => setOpen(m)} className="pressable flex min-w-0 flex-col items-center gap-1.5 text-center">
                  <MedalIcon family={m.family} tier={m.tier} code={m.code} badge={m.badge} earned={m.earned} size={76} />
                  <span className={`line-clamp-2 text-xs font-semibold leading-tight ${m.earned ? "" : "text-muted-foreground"}`}>{m.name}</span>
                  {!m.earned && m.progress > 0 && (
                    <span className="block h-1 w-14 overflow-hidden rounded-full bg-white/[0.08]">
                      <span className="block h-full" style={{ width: `${Math.round(m.progress * 100)}%`, background: "var(--gold)" }} />
                    </span>
                  )}
                </button>
              ))}
            </div>
          </section>
        );
      })}

      {open && <MedalSheet medal={open} date={earnedDate(open, savedAt)} onClose={() => setOpen(null)} />}
    </div>
  );
}

function MedalSheet({ medal: m, date, onClose }: { medal: MedalState; date: string | null; onClose: () => void }) {
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end" role="dialog" aria-label={m.name}>
      <button aria-label="Cerrar" onClick={onClose} className="absolute inset-0 bg-black/60 backdrop-blur-[6px]" />
      <div className="animate-fade relative mx-auto w-full max-w-2xl rounded-t-[28px] border-t border-white/10 bg-[#141416] px-5 pt-3 text-center" style={{ paddingBottom: "max(env(safe-area-inset-bottom), 20px)" }}>
        <div aria-hidden className="mx-auto mb-4 h-[5px] w-10 rounded-full bg-white/20" />
        <div className="mx-auto w-fit"><MedalIcon family={m.family} tier={m.tier} code={m.code} badge={m.badge} earned={m.earned} size={120} /></div>
        <span className="mt-3 inline-block rounded-full px-3 py-1 text-[12.5px] font-bold" style={m.earned ? { background: "#333B18", color: "var(--gold)" } : { background: "rgba(255,255,255,.07)", color: "var(--muted-foreground)" }}>
          {m.earned ? TIER_LABEL[m.tier] : `Bloqueada · ${TIER_LABEL[m.tier]}`}
        </span>
        <h3 className="mt-2 text-[24px] font-extrabold tracking-tight">{m.name}</h3>
        <p className="mt-1 text-[15px] text-muted-foreground">{m.how}</p>
        {m.earned && date && <p className="mt-2 text-sm text-muted-foreground">Conseguida el {fmtDate(date)}</p>}
        {!m.earned && m.progressText && (
          <div className="mx-auto mt-4 max-w-xs text-left">
            <span className="block h-2 overflow-hidden rounded-full bg-white/[0.08]">
              <span className="block h-full rounded-full" style={{ width: `${Math.round(m.progress * 100)}%`, background: "var(--gold)" }} />
            </span>
            <span className="mt-1.5 block text-center text-[13px] text-muted-foreground">{m.progressText}</span>
          </div>
        )}
        <button type="button" onClick={onClose} className="mt-5 min-h-12 w-full rounded-full bg-white/[0.08] text-[15px] font-bold">Cerrar</button>
      </div>
    </div>,
    document.body,
  );
}

/* ---------------- Aviso al desbloquear ---------------- */

const SEEN_KEY = (uid: string) => `rmordie_medals_seen:${uid}`;
const readSeen = (uid: string): Set<string> | null => {
  try {
    const raw = localStorage.getItem(SEEN_KEY(uid));
    return raw ? new Set(JSON.parse(raw) as string[]) : null;
  } catch {
    return null;
  }
};
const writeSeen = (uid: string, codes: string[]) => {
  try { localStorage.setItem(SEEN_KEY(uid), JSON.stringify(codes)); } catch { /* sin almacenamiento */ }
};

/** Vigila las medallas: guarda las nuevas y celebra las que se ganan ahora. */
export function MedalWatcher() {
  const { list, ready, saved } = useMedals();
  const store = useStoreMedals();
  const [queue, setQueue] = useState<MedalState[]>([]);
  const storing = useRef(new Set<string>());

  useEffect(() => {
    const uid = getCurrentUserId();
    if (!ready || !uid) return;
    const earned = list.filter((m) => m.earned);
    const savedCodes = new Set(saved.map((s) => s.code));

    // 1) Guardar en la base de datos las que aún no están
    const missing = earned.filter((m) => !savedCodes.has(m.code) && !storing.current.has(m.code));
    if (missing.length) {
      missing.forEach((m) => storing.current.add(m.code));
      store.mutate(missing.map((m) => ({ code: m.code, achieved_at: m.earnedOn })));
    }

    // 2) Celebrar solo las nuevas. La primera vez se dan por vistas (no 20 avisos de golpe).
    const seen = readSeen(uid);
    const codes = earned.map((m) => m.code);
    if (!seen) {
      writeSeen(uid, codes);
      return;
    }
    const fresh = earned.filter((m) => !seen.has(m.code));
    if (fresh.length) {
      writeSeen(uid, [...new Set([...seen, ...codes])]);
      setQueue((q) => [...q, ...fresh]);
    }
  }, [ready, list, saved]);

  const current = queue[0];
  if (!current) return null;
  const next = nextMedal(list.filter((m) => m.family === current.family)) ?? null;
  return <MedalCelebration medal={current} next={next} onClose={() => setQueue((q) => q.slice(1))} />;
}

function MedalCelebration({ medal: m, next, onClose }: { medal: MedalState; next: MedalState | null; onClose: () => void }) {
  useEffect(() => {
    try { navigator.vibrate?.([30, 60, 30]); } catch { /* no disponible */ }
  }, []);

  const share = async () => {
    const text = `He desbloqueado la medalla «${m.name}» (${TIER_LABEL[m.tier]}) en RM OR DIE 🏅 ${m.how}.`;
    try {
      if (navigator.share) await navigator.share({ text });
      else { await navigator.clipboard.writeText(text); toast.success("Texto copiado para compartir"); }
    } catch (e: any) {
      if (e?.name !== "AbortError") toast.error("No se pudo compartir");
    }
  };

  const nextText = useMemo(() => {
    if (!next || next.code === m.code) return null;
    return next.progressText ? `La siguiente, ${next.name}: ${next.progressText}.` : `La siguiente: ${next.name}.`;
  }, [next, m.code]);

  return createPortal(
    <div
      className="fixed inset-0 z-[85] flex flex-col items-center justify-center gap-3 px-8 text-center"
      style={{ background: "radial-gradient(60% 40% at 50% 40%, rgba(198,255,0,.16), transparent 70%), rgba(0,0,0,.86)", backdropFilter: "blur(8px)" }}
      role="status"
      aria-live="polite"
    >
      <div aria-hidden className="medal-rays" />
      <div className="medal-pop relative" style={{ filter: "drop-shadow(0 0 30px rgba(198,255,0,.35))" }}>
        <MedalIcon family={m.family} tier={m.tier} code={m.code} badge={m.badge} earned size={170} />
      </div>
      <span className="relative rounded-full px-3 py-1 text-[12.5px] font-bold" style={{ background: "#333B18", color: "var(--gold)" }}>
        Nueva medalla · {TIER_LABEL[m.tier]}
      </span>
      <h2 className="relative text-[30px] font-extrabold leading-tight tracking-tight">{m.name}</h2>
      <p className="relative max-w-[30ch] text-[15px] text-muted-foreground">
        {m.how}.{nextText ? ` ${nextText}` : ""}
      </p>
      <div className="relative mt-3 flex w-full max-w-xs flex-col gap-2">
        <button type="button" onClick={share} className="min-h-[52px] rounded-full text-[16px] font-extrabold" style={{ background: "var(--gold)", color: "var(--gold-foreground)" }}>Compartir</button>
        <button type="button" onClick={onClose} className="min-h-[52px] rounded-full bg-white/[0.08] text-[16px] font-bold">Seguir</button>
      </div>
    </div>,
    document.body,
  );
}
