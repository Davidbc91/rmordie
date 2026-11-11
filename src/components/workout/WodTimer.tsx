import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Minus, Plus, SlidersHorizontal, Volume2, VolumeX, X } from "lucide-react";
import { timerLabel, type WodTimerConfig } from "@/lib/wod-timer";

/** Lo que el timer deja apuntado en el bloque al terminar. */
export type WodTimerResult =
  | { kind: "rounds"; rounds: number; reps: number }
  | { kind: "time"; seconds: number; cap: boolean }
  | { kind: "none" };

const PREP = 10;
const font = { fontFamily: "var(--font-editorial)" } as const;

function clock(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

function useBeeper(muted: boolean) {
  const ctxRef = useRef<AudioContext | null>(null);
  const unlock = useCallback(() => {
    if (!ctxRef.current) {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      if (AC) ctxRef.current = new AC();
    }
    void ctxRef.current?.resume?.();
  }, []);
  const beep = useCallback((freq = 880, dur = 0.15, gain = 0.3) => {
    if (muted) return;
    const ctx = ctxRef.current;
    if (!ctx) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = freq;
    g.gain.value = gain;
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + dur);
  }, [muted]);
  return { beep, unlock };
}

/** Mantiene la pantalla encendida mientras corre el timer (si el móvil lo permite). */
function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    let lock: any = null;
    let cancelled = false;
    const request = async () => {
      try {
        lock = await (navigator as any).wakeLock?.request("screen");
        if (cancelled) await lock?.release();
      } catch { /* no disponible */ }
    };
    void request();
    const onVisible = () => { if (document.visibilityState === "visible") void request(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      void lock?.release?.().catch?.(() => undefined);
    };
  }, [active]);
}

type Phase = "setup" | "prep" | "run" | "paused" | "done";

export function WodTimer({
  config, title, onClose, onApply, prCheck,
}: {
  config: WodTimerConfig;
  title: string;
  onClose: () => void;
  onApply: (r: WodTimerResult) => void;
  /** Texto si el resultado sería récord (o null). */
  prCheck?: (r: WodTimerResult) => string | null;
}) {
  const [cfg, setCfg] = useState<WodTimerConfig>(config);
  const [phase, setPhase] = useState<Phase>("prep");
  const [prepLeft, setPrepLeft] = useState(PREP);
  const [elapsed, setElapsed] = useState(0);
  const [rounds, setRounds] = useState(0);
  const [extraReps, setExtraReps] = useState(0);
  const [roundTimes, setRoundTimes] = useState<number[]>([]);
  const [stoppedAt, setStoppedAt] = useState<number | null>(null);
  const [capHit, setCapHit] = useState(false);
  const [muted, setMuted] = useState(false);
  const startRef = useRef<number | null>(null);
  const pausedElapsed = useRef(0);
  const lastSec = useRef(-1);
  const { beep, unlock } = useBeeper(muted);

  useWakeLock(phase === "prep" || phase === "run");

  useEffect(() => {
    unlock();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [unlock]);

  const total =
    cfg.kind === "amrap" ? cfg.totalSec
      : cfg.kind === "fortime" ? cfg.capSec
        : cfg.kind === "emom" ? cfg.intervalSec * cfg.rounds
          : (cfg.work + cfg.rest) * cfg.rounds;

  // Cuenta atrás de preparación
  useEffect(() => {
    if (phase !== "prep") return;
    if (prepLeft <= 0) {
      beep(1400, 0.35, 0.35);
      startRef.current = performance.now();
      setPhase("run");
      return;
    }
    if (prepLeft <= 3) beep(1100, 0.12);
    const t = window.setTimeout(() => setPrepLeft((p) => p - 1), 1000);
    return () => window.clearTimeout(t);
  }, [phase, prepLeft, beep]);

  // Reloj
  useEffect(() => {
    if (phase !== "run") return;
    let raf = 0;
    const tick = () => {
      const e = pausedElapsed.current + (performance.now() - (startRef.current ?? performance.now())) / 1000;
      setElapsed(e);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  const finish = useCallback((opts?: { cap?: boolean }) => {
    setPhase("done");
    setStoppedAt(elapsed);
    if (opts?.cap) setCapHit(true);
    beep(500, 0.6, 0.35);
    try { navigator.vibrate?.([300, 120, 300]); } catch { /* sin vibración */ }
  }, [elapsed, beep]);

  // Pitidos y final automático
  useEffect(() => {
    if (phase !== "run") return;
    const sec = Math.floor(elapsed);
    if (sec === lastSec.current) return;
    lastSec.current = sec;
    if (cfg.kind === "emom") {
      const inMin = sec % cfg.intervalSec;
      const remain = cfg.intervalSec - inMin;
      if (remain <= 3 && remain > 0) beep(880, 0.12);
      if (inMin === 0 && sec > 0) beep(1400, 0.25);
    } else if (cfg.kind === "tabata") {
      const cycle = cfg.work + cfg.rest;
      const inCycle = sec % cycle;
      if (inCycle === 0 && sec > 0) beep(1400, 0.25);
      else if (inCycle === cfg.work) beep(660, 0.2);
    } else if (total != null) {
      const remain = total - sec;
      if (remain <= 3 && remain > 0) beep(880, 0.12);
    }
    if (total != null && elapsed >= total) finish({ cap: cfg.kind === "fortime" });
  }, [elapsed, phase, cfg, total, beep, finish]);

  const pause = () => {
    if (phase === "run") {
      pausedElapsed.current = elapsed;
      setPhase("paused");
    } else if (phase === "paused") {
      unlock();
      startRef.current = performance.now();
      setPhase("run");
    }
  };

  const addRound = () => {
    if (phase !== "run") return;
    setRounds((r) => r + 1);
    setRoundTimes((t) => [...t, elapsed]);
    try { navigator.vibrate?.(40); } catch { /* sin vibración */ }
  };
  const removeRound = () => {
    setRounds((r) => Math.max(0, r - 1));
    setRoundTimes((t) => t.slice(0, -1));
  };

  // ---------- Pantalla final ----------
  if (phase === "done") {
    const result: WodTimerResult =
      cfg.kind === "amrap" ? { kind: "rounds", rounds, reps: extraReps }
        : cfg.kind === "fortime" ? { kind: "time", seconds: Math.round(stoppedAt ?? elapsed), cap: capHit }
          : { kind: "none" };
    const pr = result.kind !== "none" ? prCheck?.(result) ?? null : null;
    return createPortal(
      <div className="fixed inset-0 z-[100] flex flex-col overflow-y-auto bg-[#050504] px-4" style={{ paddingTop: "max(env(safe-area-inset-top), 24px)", paddingBottom: "max(env(safe-area-inset-bottom), 20px)" }}>
        <div className="mt-6 text-center">
          <p className="text-[22px] font-extrabold text-gold" style={font}>{timerLabel(cfg).toUpperCase()} · {capHit ? "CAP" : "TIEMPO"}</p>
          <p className="text-[96px] font-black leading-[0.9] tabular" style={font}>
            {cfg.kind === "fortime" ? clock(stoppedAt ?? elapsed) : "00:00"}
          </p>
        </div>

        {cfg.kind === "amrap" && (
          <section className="mt-6 space-y-3.5 rounded-[24px] border border-white/10 bg-[#141412] p-4">
            <p className="text-[15px] font-bold">¿Cuánto has hecho?</p>
            <div className="grid grid-cols-2 gap-2.5">
              <Counter label="Rondas" value={rounds} onChange={setRounds} gold />
              <Counter label="Reps de la ronda a medias" value={extraReps} onChange={setExtraReps} />
            </div>
            {pr && <p className="rounded-[14px] bg-[color:var(--gold)]/12 px-3.5 py-3 text-sm font-bold text-[color:var(--gold-soft)]">{pr}</p>}
          </section>
        )}
        {cfg.kind === "fortime" && (
          <section className="mt-6 space-y-2 rounded-[24px] border border-white/10 bg-[#141412] p-4">
            <p className="text-[15px]">{capHit ? "Se acabó el time cap: se apunta como no terminado dentro del cap." : "Se apunta el tiempo en el que paraste el reloj."}</p>
            {pr && <p className="rounded-[14px] bg-[color:var(--gold)]/12 px-3.5 py-3 text-sm font-bold text-[color:var(--gold-soft)]">{pr}</p>}
          </section>
        )}

        <div className="mt-auto space-y-1 pt-6">
          {result.kind !== "none" ? (
            <>
              <button type="button" onClick={() => onApply(result)} className="pressable gold-gradient cta-display min-h-16 w-full rounded-[18px]">APUNTAR Y VOLVER AL ENTRENO</button>
              <button type="button" onClick={onClose} className="min-h-12 w-full text-[15px] text-muted-foreground">Volver sin apuntar</button>
            </>
          ) : (
            <button type="button" onClick={onClose} className="pressable gold-gradient cta-display min-h-16 w-full rounded-[18px]">VOLVER AL ENTRENO</button>
          )}
        </div>
      </div>,
      document.body,
    );
  }

  // ---------- Reloj ----------
  let big = clock(elapsed);
  let caption = "";
  let progress = 0;
  let resting = false;
  if (cfg.kind === "amrap") {
    big = clock(cfg.totalSec - elapsed);
    caption = "QUEDAN";
    progress = elapsed / cfg.totalSec;
  } else if (cfg.kind === "fortime") {
    big = clock(elapsed);
    caption = cfg.capSec ? `CAP ${clock(cfg.capSec)}` : "TIEMPO";
    progress = cfg.capSec ? elapsed / cfg.capSec : 0;
  } else if (cfg.kind === "emom") {
    const idx = Math.floor(elapsed / cfg.intervalSec);
    big = clock(cfg.intervalSec - (elapsed - idx * cfg.intervalSec));
    caption = `RONDA ${Math.min(idx + 1, cfg.rounds)} DE ${cfg.rounds}`;
    progress = (elapsed - idx * cfg.intervalSec) / cfg.intervalSec;
  } else {
    const cycle = cfg.work + cfg.rest;
    const idx = Math.floor(elapsed / cycle);
    const inCycle = elapsed - idx * cycle;
    resting = inCycle >= cfg.work;
    big = clock(resting ? cycle - inCycle : cfg.work - inCycle);
    caption = `${resting ? "DESCANSO" : "TRABAJO"} · ${Math.min(idx + 1, cfg.rounds)} DE ${cfg.rounds}`;
    progress = resting ? (inCycle - cfg.work) / cfg.rest : inCycle / cfg.work;
  }
  if (phase === "prep") {
    big = String(prepLeft);
    caption = "PREPARADOS";
    progress = (PREP - prepLeft) / PREP;
  }
  const lastRound = roundTimes.length ? roundTimes[roundTimes.length - 1] - (roundTimes[roundTimes.length - 2] ?? 0) : null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex flex-col bg-[#050504] px-4 text-foreground" style={{ paddingTop: "max(env(safe-area-inset-top), 20px)", paddingBottom: "max(env(safe-area-inset-bottom), 16px)" }}>
      <div className="flex items-center justify-between">
        <button type="button" onClick={onClose} aria-label="Salir del timer" className="grid h-11 w-11 place-items-center rounded-full bg-white/[0.08]"><X className="h-5 w-5" /></button>
        <div className="min-w-0 px-2 text-center">
          <p className="text-[22px] font-extrabold text-gold" style={font}>{timerLabel(cfg).toUpperCase()}</p>
          <p className="truncate text-xs text-muted-foreground">{title}</p>
        </div>
        <button type="button" onClick={() => setMuted((m) => !m)} aria-label={muted ? "Activar pitidos" : "Silenciar pitidos"} className="grid h-11 w-11 place-items-center rounded-full bg-white/[0.08]">
          {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
        </button>
      </div>

      <div className={`mt-5 text-center ${phase === "setup" ? "hidden" : ""}`}>
        <p className="text-[13px] tracking-[0.16em] text-muted-foreground">{caption}</p>
        <p className={`font-black leading-[0.9] tabular ${resting ? "text-muted-foreground" : ""}`} style={{ ...font, fontSize: "min(38vw, 30vh)" }} role="timer">{big}</p>
        <div className="mx-auto mt-3 h-1.5 w-[80%] overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full transition-[width] duration-200" style={{ width: `${Math.min(100, progress * 100)}%`, background: resting ? "#6B6860" : "var(--gold)" }} />
        </div>
      </div>

      {phase === "prep" && (
        <button
          type="button"
          onClick={() => { setPhase("setup"); setPrepLeft(PREP); }}
          className="mx-auto mt-4 flex min-h-11 items-center gap-2 rounded-full bg-white/[0.08] px-4 text-sm font-bold"
        >
          <SlidersHorizontal className="h-4 w-4" /> Ajustar tiempos
        </button>
      )}

      {phase === "setup" ? (
        <div className="mt-5 flex flex-1 flex-col gap-3 overflow-y-auto">
          <TimerSettings cfg={cfg} onChange={setCfg} />
          <button
            type="button"
            onClick={() => { setPrepLeft(PREP); setPhase("prep"); }}
            className="gold-gradient mt-auto min-h-14 rounded-[16px] text-2xl font-extrabold"
            style={font}
          >
            EMPEZAR
          </button>
        </div>
      ) : cfg.kind === "amrap" ? (
        <button
          type="button"
          onClick={addRound}
          disabled={phase !== "run"}
          className="mt-6 flex flex-1 flex-col items-center justify-center gap-1 rounded-[28px] border-[1.5px] border-[color:var(--gold)]/55 bg-[color:var(--gold)]/10 active:bg-[color:var(--gold)]/20 disabled:opacity-60"
        >
          <span className="text-sm font-bold tracking-[0.14em] text-gold">RONDAS</span>
          <span className="text-[min(30vw,120px)] font-black leading-[0.85] text-[color:var(--gold-soft)]" style={font}>{rounds}</span>
          <span className="text-base font-bold">Toca en cualquier sitio: +1 ronda</span>
          {lastRound != null && <span className="text-[13px] text-muted-foreground">Última ronda: {clock(lastRound)}</span>}
        </button>
      ) : cfg.kind === "fortime" ? (
        <button
          type="button"
          onClick={() => finish()}
          disabled={phase !== "run"}
          className="mt-6 flex flex-1 flex-col items-center justify-center gap-2 rounded-[28px] border-[1.5px] border-[color:var(--gold)]/55 bg-[color:var(--gold)]/10 active:bg-[color:var(--gold)]/20 disabled:opacity-60"
        >
          <span className="text-[44px] font-black leading-none text-[color:var(--gold-soft)]" style={font}>¡HECHO!</span>
          <span className="text-base font-bold">Toca al terminar para parar el reloj</span>
        </button>
      ) : (
        <div className="flex-1" />
      )}

      {phase !== "setup" && <div className="mt-3.5 grid grid-cols-[1fr_1.4fr_1fr] gap-2.5">
        {cfg.kind === "amrap" ? (
          <button type="button" onClick={removeRound} disabled={rounds === 0} className="min-h-14 rounded-[16px] bg-white/[0.08] text-[15px] font-bold disabled:opacity-40">−1 ronda</button>
        ) : <span />}
        <button type="button" onClick={phase === "prep" ? onClose : pause} className="min-h-14 rounded-[16px] bg-[#F2F0EA] text-2xl font-extrabold text-[#0B0A08]" style={font}>
          {phase === "prep" ? "CANCELAR" : phase === "paused" ? "SEGUIR" : "PAUSA"}
        </button>
        <button type="button" onClick={() => finish()} disabled={phase === "prep"} className="min-h-14 rounded-[16px] bg-white/[0.08] text-[15px] font-bold disabled:opacity-40">Terminar</button>
      </div>}
    </div>,
    document.body,
  );
}

function Counter({ label, value, onChange, gold }: { label: string; value: number; onChange: (n: number) => void; gold?: boolean }) {
  return (
    <div>
      <span className="mb-1.5 block text-[13px] text-muted-foreground">{label}</span>
      <div className={`flex h-16 items-center justify-between rounded-[14px] border px-1 ${gold ? "border-[color:var(--gold)]/60 bg-[color:var(--gold)]/8" : "border-white/[0.14] bg-white/[0.06]"}`}>
        <button type="button" aria-label={`${label}: uno menos`} onClick={() => onChange(Math.max(0, value - 1))} className="grid h-14 w-11 place-items-center"><Minus className="h-5 w-5" /></button>
        <span className={`text-[40px] font-black ${gold ? "text-[color:var(--gold-soft)]" : ""}`} style={font}>{value}</span>
        <button type="button" aria-label={`${label}: uno más`} onClick={() => onChange(value + 1)} className="grid h-14 w-11 place-items-center"><Plus className="h-5 w-5" /></button>
      </div>
    </div>
  );
}

/** Ajustes del reloj: todo editable (tiempos, rondas, descansos). */
function TimerSettings({ cfg, onChange }: { cfg: WodTimerConfig; onChange: (c: WodTimerConfig) => void }) {
  if (cfg.kind === "tabata") {
    return (
      <>
        <SecondsField label="Rondas" value={cfg.rounds} min={1} max={50} step={1} unit="" onChange={(rounds) => onChange({ ...cfg, rounds })} />
        <SecondsField label="Trabajo" value={cfg.work} min={1} max={600} step={5} onChange={(work) => onChange({ ...cfg, work })} />
        <SecondsField label="Descanso" value={cfg.rest} min={0} max={600} step={5} onChange={(rest) => onChange({ ...cfg, rest })} />
        <div className="grid grid-cols-4 gap-1.5">
          {[[20, 10], [30, 15], [40, 20], [45, 15]].map(([w, r]) => (
            <button key={`${w}/${r}`} type="button" onClick={() => onChange({ ...cfg, work: w, rest: r })} className={`min-h-11 rounded-[12px] text-sm font-bold ${cfg.work === w && cfg.rest === r ? "gold-gradient" : "bg-white/[0.06]"}`}>{w}/{r}</button>
          ))}
        </div>
        <p className="text-center text-[13px] text-muted-foreground">Total {clock((cfg.work + cfg.rest) * cfg.rounds)}</p>
      </>
    );
  }
  if (cfg.kind === "emom") {
    return (
      <>
        <SecondsField label="Rondas" value={cfg.rounds} min={1} max={120} step={1} unit="" onChange={(rounds) => onChange({ ...cfg, rounds })} />
        <SecondsField label="Cada" value={cfg.intervalSec} min={5} max={1200} step={15} onChange={(intervalSec) => onChange({ ...cfg, intervalSec })} />
        <p className="text-center text-[13px] text-muted-foreground">Total {clock(cfg.intervalSec * cfg.rounds)}</p>
      </>
    );
  }
  if (cfg.kind === "amrap") {
    return <SecondsField label="Minutos" value={Math.round(cfg.totalSec / 60)} min={1} max={180} step={1} unit="min" onChange={(m) => onChange({ ...cfg, totalSec: m * 60 })} />;
  }
  return (
    <SecondsField
      label="Time cap (0 = sin cap)"
      value={cfg.capSec ? Math.round(cfg.capSec / 60) : 0}
      min={0}
      max={180}
      step={1}
      unit="min"
      onChange={(m) => onChange({ ...cfg, capSec: m > 0 ? m * 60 : null })}
    />
  );
}

function SecondsField({
  label, value, min, max, step, unit = "s", onChange,
}: { label: string; value: number; min: number; max: number; step: number; unit?: string; onChange: (n: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const clamp = (n: number) => Math.max(min, Math.min(max, n));
  return (
    <div>
      <span className="mb-1.5 block text-[13px] text-muted-foreground">{label}</span>
      <div className="flex h-16 items-center justify-between rounded-[14px] border border-white/[0.14] bg-white/[0.06] px-1">
        <button type="button" aria-label={`${label}: menos`} onClick={() => onChange(clamp(value - step))} className="grid h-14 w-12 place-items-center"><Minus className="h-5 w-5" /></button>
        <span className="flex items-baseline gap-1">
          <input
            value={draft ?? String(value)}
            inputMode="numeric"
            aria-label={label}
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => {
              const raw = e.target.value.replace(/[^0-9]/g, "");
              setDraft(raw);
              if (raw !== "") onChange(clamp(parseInt(raw, 10)));
            }}
            onBlur={() => setDraft(null)}
            className="w-24 bg-transparent text-center text-[40px] font-black outline-none"
            style={font}
          />
          {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
        </span>
        <button type="button" aria-label={`${label}: más`} onClick={() => onChange(clamp(value + step))} className="grid h-14 w-12 place-items-center"><Plus className="h-5 w-5" /></button>
      </div>
    </div>
  );
}
