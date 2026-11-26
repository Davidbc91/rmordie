import { PlateSheet } from "@/components/workout/PlateSheet";
import { PickerField } from "@/components/ui/wheel-picker";
import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useEffect, useRef, useState } from "react";
import { Play, Pause, RotateCcw, Timer as TimerIcon, Plus, Minus } from "lucide-react";

export const Route = createFileRoute("/timers")({
  head: () => ({
    meta: [
      { title: "Temporizador — RM OR DIE" },
      { name: "description", content: "AMRAP, EMOM, For Time, Tabata e Intervalos para tus WODs." },
      { property: "og:title", content: "Temporizador — RM OR DIE" },
      { property: "og:description", content: "Temporizadores CrossFit: AMRAP, EMOM, Tabata y más." },
    ],
  }),
  component: TimersPage,
});

type Mode = "amrap" | "emom" | "fortime" | "tabata" | "intervals" | "countdown" | "stopwatch";

const MODES: { id: Mode; label: string; desc: string }[] = [
  { id: "amrap", label: "AMRAP", desc: "Máximas rondas en tiempo" },
  { id: "emom", label: "EMOM", desc: "Cada minuto en el minuto" },
  { id: "fortime", label: "For Time", desc: "Cuenta atrás con cap" },
  { id: "tabata", label: "Tabata", desc: "Trabajo y descanso a tu medida" },
  { id: "intervals", label: "Intervalos", desc: "Trabajo/descanso custom" },
  { id: "countdown", label: "Cuenta atrás", desc: "Un solo bloque" },
  { id: "stopwatch", label: "Cronómetro", desc: "Tiempo libre ascendente" },
];

function fmt(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

// Audio beep via WebAudio
function useBeeper() {
  const ctxRef = useRef<AudioContext | null>(null);
  const ensure = () => {
    if (!ctxRef.current) {
      const AC = (window.AudioContext || (window as any).webkitAudioContext);
      if (AC) ctxRef.current = new AC();
    }
    return ctxRef.current;
  };
  const beep = (freq = 880, dur = 0.15, gain = 0.25) => {
    const ctx = ensure();
    if (!ctx) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = freq;
    o.type = "sine";
    g.gain.value = gain;
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + dur);
  };
  return { beep, unlock: ensure };
}

function TimersPage() {
  const [mode, setMode] = useState<Mode>("amrap");
  const [plates, setPlates] = useState(false);
  return (
    <AppShell>
      <div className="space-y-6">
        <header className="space-y-2">
          <div className="flex items-center gap-2">
            <TimerIcon className="h-6 w-6" style={{ color: "var(--gold)" }} />
            <h1 className="page-title" style={{ fontSize: "2rem" }}>Temporizador</h1>
            <button type="button" onClick={() => setPlates(true)} className="pressable ml-auto min-h-10 rounded-full bg-white/[0.07] px-3.5 text-[13.5px] font-bold">Discos</button>
          </div>
          <p className="text-sm text-muted-foreground">
            Elige el formato de tu WOD.
          </p>
        </header>
        {plates && <PlateSheet initial={60} onClose={() => setPlates(false)} />}

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {MODES.map((m) => {
            const active = mode === m.id;
            return (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className="rounded-xl border p-3 text-left transition"
                style={{
                  borderColor: active ? "var(--gold)" : "var(--border)",
                  background: active ? "color-mix(in oklab, var(--gold) 12%, transparent)" : "var(--card)",
                }}
              >
                <div className="text-sm font-semibold" style={{ color: active ? "var(--gold)" : "inherit" }}>{m.label}</div>
                <div className="text-xs text-muted-foreground leading-tight mt-0.5">{m.desc}</div>
              </button>
            );
          })}
        </div>

        <TimerRunner key={mode} mode={mode} />
      </div>
    </AppShell>
  );
}

function TimerRunner({ mode }: { mode: Mode }) {
  // Config
  const [minutes, setMinutes] = useState(mode === "emom" ? 10 : mode === "amrap" ? 12 : mode === "fortime" ? 15 : 10);
  const [rounds, setRounds] = useState(mode === "tabata" ? 8 : 10);
  const [work, setWork] = useState(mode === "tabata" ? 20 : 40);
  const [rest, setRest] = useState(mode === "tabata" ? 10 : 20);
  const [countdownSec, setCountdownSec] = useState(60);
  const [emomInterval, setEmomInterval] = useState(60); // seconds per EMOM round

  // State
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0); // seconds since start (running time)
  const [rounds_done, setRoundsDone] = useState(0);
  const [prep, setPrep] = useState<number | null>(null); // 10s countdown before start
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const { beep, unlock } = useBeeper();
  const lastTickRef = useRef<number>(-1);

  const reset = () => {
    setRunning(false);
    setPrep(null);
    setElapsed(0);
    setRoundsDone(0);
    startRef.current = null;
    lastTickRef.current = -1;
  };

  useEffect(() => { reset(); /* on mode change */ }, [mode]);

  // Prep countdown (10s) before the official mode starts
  useEffect(() => {
    if (prep == null) return;
    if (prep <= 0) {
      beep(1400, 0.35, 0.35);
      setPrep(null);
      startRef.current = performance.now();
      setRunning(true);
      return;
    }
    beep(prep <= 3 ? 1100 : 700, 0.12, 0.25);
    const t = setTimeout(() => setPrep((p) => (p == null ? null : p - 1)), 1000);
    return () => clearTimeout(t);
  }, [prep]);

  useEffect(() => {
    if (!running) return;
    const tick = () => {
      if (startRef.current == null) startRef.current = performance.now();
      const now = performance.now();
      const e = (now - startRef.current) / 1000;
      setElapsed(e);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [running]);

  const toggle = () => {
    unlock();
    if (prep != null) {
      setPrep(null);
      return;
    }
    if (running) {
      setRunning(false);
    } else if (elapsed > 0) {
      startRef.current = performance.now() - elapsed * 1000;
      setRunning(true);
    } else {
      setPrep(10);
    }
  };

  // Derived per mode
  let display = "00:00";
  let sub = "";
  let phase: "work" | "rest" | "done" | "run" = "run";
  let total = 0;
  let progress = 0;

  if (mode === "amrap") {
    total = minutes * 60;
    const remain = Math.max(0, total - elapsed);
    display = fmt(remain);
    sub = `AMRAP ${minutes}'`;
    progress = Math.min(1, elapsed / total);
    if (elapsed >= total) phase = "done";
  } else if (mode === "fortime" || mode === "countdown") {
    total = mode === "countdown" ? countdownSec : minutes * 60;
    const remain = Math.max(0, total - elapsed);
    display = fmt(remain);
    sub = mode === "countdown" ? "Cuenta atrás" : `Cap ${minutes}'`;
    progress = Math.min(1, elapsed / total);
    if (elapsed >= total) phase = "done";
  } else if (mode === "emom") {
    const iv = Math.max(5, emomInterval);
    total = minutes * iv;
    const currentMin = Math.floor(elapsed / iv);
    const inMin = elapsed - currentMin * iv;
    const remain = iv - inMin;
    display = fmt(remain);
    sub = `EMOM ${Math.min(currentMin + 1, minutes)}/${minutes} · ${iv}s`;
    progress = inMin / iv;
    if (elapsed >= total) phase = "done";
  } else if (mode === "stopwatch") {
    display = fmt(elapsed);
    sub = "Cronómetro";
    progress = 0;
  } else {
    // tabata / intervals
    const cycle = work + rest;
    total = cycle * rounds;
    const round = Math.floor(elapsed / cycle);
    const inCycle = elapsed - round * cycle;
    if (round >= rounds) {
      phase = "done";
      display = "00:00";
      sub = `${rounds}/${rounds}`;
      progress = 1;
    } else if (inCycle < work) {
      phase = "work";
      display = fmt(work - inCycle);
      sub = `Trabajo · Ronda ${round + 1}/${rounds}`;
      progress = inCycle / work;
    } else {
      phase = "rest";
      display = fmt(cycle - inCycle);
      sub = `Descanso · Ronda ${round + 1}/${rounds}`;
      progress = (inCycle - work) / rest;
    }
  }

  // Rondas: en qué ronda vas y cuántas quedan (Tabata, intervalos y EMOM);
  // en AMRAP, For Time y cronómetro las cuentas tú tocando la pantalla.
  let roundNow: number | null = null;
  let roundTotal: number | null = null;
  if (mode === "tabata" || mode === "intervals") {
    const cycle = work + rest;
    roundTotal = rounds;
    roundNow = Math.min(rounds, Math.floor(elapsed / Math.max(1, cycle)) + 1);
  } else if (mode === "emom") {
    const iv = Math.max(5, emomInterval);
    roundTotal = minutes;
    roundNow = Math.min(minutes, Math.floor(elapsed / iv) + 1);
  }
  const countsRounds = mode === "amrap" || mode === "fortime" || mode === "stopwatch";

  const isPrep = prep != null;
  if (isPrep) {
    display = String(prep);
    sub = "Preparados";
    phase = "run";
    progress = (10 - (prep ?? 0)) / 10;
  }



  // Auto-stop + beeps
  useEffect(() => {
    if (!running) return;
    const secTick = Math.floor(elapsed);
    if (secTick !== lastTickRef.current) {
      lastTickRef.current = secTick;
      // Beep at last 3 seconds of each key segment
      if (mode === "emom") {
        const iv = Math.max(5, emomInterval);
        const inMin = secTick % iv;
        const remain = iv - inMin;
        if (remain <= 3 && remain > 0) beep(880, 0.12);
        if (inMin === 0 && secTick > 0) beep(1400, 0.25, 0.3);
      } else if (mode === "tabata" || mode === "intervals") {
        const cycle = work + rest;
        const inCycle = secTick % cycle;
        if (inCycle === 0 && secTick > 0) beep(1400, 0.25, 0.3);
        else if (inCycle === work) beep(660, 0.2, 0.3);
        else {
          const remainSeg = inCycle < work ? work - inCycle : cycle - inCycle;
          if (remainSeg <= 3 && remainSeg > 0) beep(880, 0.1);
        }
      } else if (mode === "amrap" || mode === "fortime" || mode === "countdown") {
        const remain = total - secTick;
        if (remain <= 3 && remain > 0) beep(880, 0.12);
      }
    }
    if (phase === "done") {
      beep(500, 0.6, 0.35);
      setRunning(false);
    }
  }, [elapsed, running, mode, work, rest, total, phase, beep, emomInterval]);

  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    if (!running && !isPrep) return;
    setFullscreen(true);
  }, [running, isPrep]);

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFullscreen(false);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [fullscreen]);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border p-4 space-y-3" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
        {(mode === "amrap" || mode === "fortime") && (
          <PickerField label="Minutos" unit="min" value={minutes} onChange={(n) => { reset(); setMinutes(n); }} min={1} max={120} />
        )}
        {mode === "emom" && (
          <>
            <PickerField label="Rondas" value={minutes} onChange={(n) => { reset(); setMinutes(n); }} min={1} max={120} />
            <PickerField kind="duration" label="Cada" value={emomInterval} onChange={(n) => { reset(); setEmomInterval(n); }} min={5} max={600} />
            <div className="flex flex-wrap gap-2">
              {[30, 60, 90, 120, 180].map((s) => (
                <button
                  key={s}
                  onClick={() => { reset(); setEmomInterval(s); }}
                  className="rounded-lg border px-3 py-1.5 text-xs font-medium"
                  style={{
                    borderColor: emomInterval === s ? "var(--gold)" : "var(--border)",
                    color: emomInterval === s ? "var(--gold)" : "var(--muted-foreground)",
                  }}
                >
                  {s % 60 === 0 ? `E${s / 60 === 1 ? "" : s / 60}MOM` : `${s}s`}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Duración total: {Math.floor((minutes * emomInterval) / 60)}:{String((minutes * emomInterval) % 60).padStart(2, "0")}
            </p>
          </>
        )}
        {mode === "countdown" && (
          <PickerField kind="duration" label="Tiempo" value={countdownSec} onChange={(n) => { reset(); setCountdownSec(n); }} min={1} max={3599} big />
        )}
        {(mode === "tabata" || mode === "intervals") && (
          <>
            <PickerField label="Rondas" value={rounds} onChange={(n) => { reset(); setRounds(n); }} min={1} max={50} />
            <PickerField kind="duration" label="Trabajo" value={work} onChange={(n) => { reset(); setWork(n); }} min={1} max={600} />
            <PickerField kind="duration" label="Descanso" value={rest} onChange={(n) => { reset(); setRest(n); }} min={0} max={600} />
            {mode === "tabata" && (
              <div className="grid grid-cols-4 gap-1.5">
                {[[20, 10], [30, 15], [40, 20], [45, 15]].map(([w, r]) => (
                  <button
                    key={`${w}/${r}`}
                    type="button"
                    onClick={() => { reset(); setWork(w); setRest(r); }}
                    className={`min-h-11 rounded-[12px] text-sm font-bold ${work === w && rest === r ? "gold-gradient" : "bg-white/[0.06]"}`}
                  >
                    {w}/{r}
                  </button>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">Total: {fmt((work + rest) * rounds)}</p>
          </>
        )}
        {mode === "stopwatch" && (
          <p className="text-sm text-muted-foreground">Sin configuración. Pulsa play para empezar.</p>
        )}
        {(running || elapsed > 0) && (
          <p className="text-xs text-muted-foreground">Editar reinicia el temporizador.</p>
        )}
      </div>

      <div
        className="relative rounded-2xl border p-8 text-center overflow-hidden"
        style={{
          borderColor: phase === "work" ? "var(--gold)" : phase === "rest" ? "var(--border)" : "var(--border)",
          background: "var(--card)",
        }}
      >
        <div className="absolute inset-x-0 bottom-0 h-1" style={{ background: "var(--border)" }}>
          <div
            className="h-full transition-[width] duration-200"
            style={{
              width: `${Math.min(100, progress * 100)}%`,
              background: phase === "rest" ? "#6B6B70" : "var(--gold)",
            }}
          />
        </div>
        <div className="text-xs tracking-widest text-muted-foreground">{sub}</div>
        <div
          className="mt-2 text-8xl font-black tabular-nums"
          style={{
            fontFamily: "var(--font-num)",
            color: phase === "done" ? "var(--gold)" : phase === "rest" ? "var(--muted-foreground)" : "inherit",
          }}
        >
          {display}
        </div>
        {phase === "done" && <div className="mt-2 text-sm" style={{ color: "var(--gold)" }}>¡Completado!</div>}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={toggle}
          className="flex-1 flex items-center justify-center gap-2 rounded-xl py-4 font-semibold"
          style={{ background: "var(--gold)", color: "var(--aurora-ink)" }}
        >
          {isPrep ? <><Pause className="h-5 w-5" /> Cancelar</> : running ? <><Pause className="h-5 w-5" /> Pausar</> : <><Play className="h-5 w-5" /> {elapsed > 0 ? "Reanudar" : "Empezar"}</>}
        </button>
        <button
          onClick={reset}
          aria-label="Reiniciar temporizador"
          className="flex items-center justify-center gap-2 rounded-xl border px-5 py-4"
          style={{ borderColor: "var(--border)" }}
        >
          <RotateCcw className="h-5 w-5" />
        </button>
      </div>

      {fullscreen && (
        <div
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center"
          style={{ background: "#0C0C0E" }}
        >
          <div
            className="absolute inset-x-0 top-0 h-1"
            style={{ background: "rgba(255,255,255,0.08)" }}
          >
            <div
              className="h-full transition-[width] duration-200"
              style={{
                width: `${Math.min(100, progress * 100)}%`,
                background: phase === "rest" ? "#6B6B70" : "var(--gold)",
              }}
            />
          </div>
          {!isPrep && (roundTotal != null || countsRounds) && (
            <div className="mb-4 text-center" aria-live="polite">
              {(phase === "work" || phase === "rest") && (
                <div
                  className="mx-auto mb-3 w-fit rounded-full px-4 py-1.5 text-sm font-extrabold"
                  style={{ background: phase === "work" ? "var(--gold)" : "rgba(255,255,255,0.12)", color: phase === "work" ? "#0a0a0a" : "#fff" }}
                >
                  {phase === "work" ? "TRABAJO" : "DESCANSO"}
                </div>
              )}
              {roundTotal != null && roundNow != null ? (
                <>
                  <div className="font-black leading-none tabular-nums" style={{ fontFamily: "var(--font-num)", fontSize: "min(16vw, 12vh)", color: "var(--gold)" }}>
                    RONDA {roundNow}<span style={{ color: "rgba(255,255,255,0.45)" }}>/{roundTotal}</span>
                  </div>
                  <div className="mt-1 text-base font-bold" style={{ color: "rgba(255,255,255,0.7)" }}>
                    {phase === "done" ? "¡Terminado!" : roundTotal - roundNow === 0 ? "Última ronda" : `Quedan ${roundTotal - roundNow} ${roundTotal - roundNow === 1 ? "ronda" : "rondas"}`}
                  </div>
                </>
              ) : (
                <div className="font-black leading-none tabular-nums" style={{ fontFamily: "var(--font-num)", fontSize: "min(14vw, 10vh)", color: "var(--gold)" }}>
                  {rounds_done} {rounds_done === 1 ? "RONDA" : "RONDAS"}
                </div>
              )}
            </div>
          )}
          <div
            className="font-black tabular-nums leading-none text-center px-4 max-w-full"
            style={{
              fontFamily: "var(--font-num)",
              fontSize: roundTotal != null || countsRounds ? "min(32vw, 42vh)" : "min(38vw, 55vh)",
              color: phase === "done" ? "var(--gold)" : phase === "rest" ? "#FFFFFF" : isPrep ? "#fff" : "var(--gold)",
              textShadow: phase === "work" || (!isPrep && phase !== "rest" && phase !== "done") ? "0 0 40px rgba(198,255,0,.28)" : "none",
              letterSpacing: "0.01em",
            }}
          >
            {display}
          </div>
          {countsRounds && !isPrep && phase !== "done" && (
            <div className="mt-6 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setRoundsDone((n) => Math.max(0, n - 1))}
                aria-label="Quitar una ronda"
                className="grid h-16 w-16 place-items-center rounded-2xl text-2xl font-black"
                style={{ background: "rgba(255,255,255,0.08)", color: "#fff" }}
              >
                −
              </button>
              <button
                type="button"
                onClick={() => setRoundsDone((n) => n + 1)}
                className="h-16 rounded-2xl px-8 text-2xl font-black"
                style={{ background: "var(--gold)", color: "var(--aurora-ink)", fontFamily: "var(--font-num)" }}
              >
                + RONDA
              </button>
            </div>
          )}
          <div className="mt-8 flex items-center gap-3">
            <button
              onClick={toggle}
              className="flex items-center justify-center gap-2 rounded-xl px-6 py-3 font-semibold"
              style={{ background: "var(--gold)", color: "var(--aurora-ink)" }}
            >
              {isPrep ? <><Pause className="h-5 w-5" /> Cancelar</> : running ? <><Pause className="h-5 w-5" /> Pausar</> : <><Play className="h-5 w-5" /> Reanudar</>}
            </button>
            <button
              onClick={() => { reset(); setFullscreen(false); }}
              aria-label="Reiniciar y salir de pantalla completa"
              className="flex items-center justify-center gap-2 rounded-xl border px-5 py-3"
              style={{ borderColor: "rgba(255,255,255,0.2)", color: "#fff" }}
            >
              <RotateCcw className="h-5 w-5" />
            </button>
            <button
              onClick={() => setFullscreen(false)}
              className="rounded-xl border px-4 py-3 text-sm"
              style={{ borderColor: "rgba(255,255,255,0.2)", color: "#fff" }}
            >
              Salir
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


function NumberField({
  label, value, onChange, min = 0, max = 999, step = 1, disabled = false,
}: {
  label: string; value: number; onChange: (n: number) => void;
  min?: number; max?: number; step?: number; disabled?: boolean;
}) {
  const clamp = (n: number) => Math.max(min, Math.min(max, n));
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <div className="flex items-center justify-between gap-3">
      <label className="text-sm text-muted-foreground">{label}</label>
      <div className="flex items-center gap-2">
        <button
          disabled={disabled}
          aria-label={`Restar ${step} a ${label}`}
          onClick={() => onChange(clamp(value - step))}
          className="grid h-11 w-11 place-items-center rounded-lg border disabled:opacity-40"
          style={{ borderColor: "var(--border)" }}
        >
          <Minus className="h-4 w-4" />
        </button>
        <input
          disabled={disabled}
          value={draft ?? String(value)}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => {
            const raw = e.target.value.replace(/[^0-9]/g, "");
            setDraft(raw);
            if (raw !== "") onChange(clamp(parseInt(raw, 10)));
          }}
          onBlur={() => setDraft(null)}
          aria-label={label}
          className="h-11 w-16 rounded-lg border bg-transparent px-2 text-center font-mono text-base disabled:opacity-40"
          style={{ borderColor: "var(--border)" }}
          inputMode="numeric"
        />
        <button
          disabled={disabled}
          aria-label={`Sumar ${step} a ${label}`}
          onClick={() => onChange(clamp(value + step))}
          className="grid h-11 w-11 place-items-center rounded-lg border disabled:opacity-40"
          style={{ borderColor: "var(--border)" }}
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export default TimersPage;
