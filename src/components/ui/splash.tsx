import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import logoAsset from "@/assets/rmordie-logo.jpg.asset.json";

/*
 * Entrada de la app: la barra cruza la pantalla, entran los discos, el logo cae
 * sobre la barra con un golpe (destello, anillo y chispas), la barra sube como
 * en un clean y una cortina dorada abre la app. ~2,8 s. Tocar la salta.
 * Solo una vez por sesión.
 */

const TOTAL_MS = 2800; // la app aparece cuando la cortina cubre la pantalla
const REVEAL_MS = 2370;
const SPARKS = Array.from({ length: 14 }, (_, i) => {
  const a = (Math.PI * 2 * i) / 14 + ((i * 37) % 10) / 30;
  const r = 70 + ((i * 53) % 70);
  return { x: Math.cos(a) * r, y: Math.sin(a) * r, s: 4 + ((i * 29) % 6) };
});

export function SplashScreen({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(true);
  const [revealed, setRevealed] = useState(false);
  const [kg, setKg] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);

  const finish = useCallback(() => {
    timers.current.forEach((t) => window.clearTimeout(t));
    setRevealed(true);
    setVisible(false);
  }, []);

  useEffect(() => {
    try {
      if (sessionStorage.getItem("rmordie-splash-shown")) {
        setRevealed(true);
        setVisible(false);
        return;
      }
      sessionStorage.setItem("rmordie-splash-shown", "1");
    } catch { /* sin almacenamiento: se muestra igual */ }

    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      timers.current.push(window.setTimeout(() => setRevealed(true), 500));
      timers.current.push(window.setTimeout(() => setVisible(false), 800));
      return;
    }

    // Vibración en los golpes (Android; en iPhone no hace nada)
    const buzz = (p: number | number[]) => { try { navigator.vibrate?.(p); } catch { /* sin vibración */ } };
    timers.current.push(window.setTimeout(() => buzz(18), 560));
    timers.current.push(window.setTimeout(() => buzz([40, 30, 20]), 1090));
    timers.current.push(window.setTimeout(() => setRevealed(true), REVEAL_MS));
    timers.current.push(window.setTimeout(() => setVisible(false), TOTAL_MS));

    // Contador 0 → 100 KG
    let raf = 0;
    const start = performance.now() + 1350;
    const tick = (t: number) => {
      const p = Math.min(1, Math.max(0, (t - start) / 650));
      setKg(Math.round(100 * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const ts = timers.current;
    return () => {
      cancelAnimationFrame(raf);
      ts.forEach((t) => window.clearTimeout(t));
    };
  }, []);

  return (
    <>
      <div className={"transition-opacity duration-200 " + (revealed ? "opacity-100" : "opacity-0")} aria-hidden={!revealed}>
        {children}
      </div>

      {visible && (
        <div
          ref={rootRef}
          aria-hidden
          onPointerDown={finish}
          className="rmd-intro fixed inset-0 z-[9999] overflow-hidden"
        >
          <div className="rmd-shake">
            <div className="rmd-bar" />
            <div className="rmd-plate rmd-l1" />
            <div className="rmd-plate rmd-l2" />
            <div className="rmd-plate rmd-r1" />
            <div className="rmd-plate rmd-r2" />
            <div className="rmd-logo-wrap">
              <img src={logoAsset.url} alt="" className="rmd-logo" draggable={false} />
            </div>
            <div className="rmd-ring" />
            <div className="rmd-flash" />
            <div className="rmd-sparks">
              {SPARKS.map((s, i) => (
                <span
                  key={i}
                  className="rmd-spark"
                  style={{ width: s.s, height: s.s, ["--x" as string]: `${s.x}px`, ["--y" as string]: `${s.y}px` }}
                />
              ))}
            </div>
          </div>
          <div className="rmd-count">{kg} KG</div>
          <div className="rmd-tag">ENTRENA · REGISTRA · SUPÉRATE</div>
          <div className="rmd-wipe" />

          <style>{`
            .rmd-intro { background: #000; --gold: #C8B38A; --gold-soft: #E8DDC8; animation: rmd-out 380ms ease-in 2420ms both; }
            .rmd-shake { position: absolute; inset: 0; animation: rmd-shake 260ms 560ms both, rmd-shake 380ms 1090ms both; }
            .rmd-bar { position: absolute; left: 50%; top: 50%; height: 4px; width: 84%; max-width: 520px; translate: -50% -50%;
              background: linear-gradient(90deg, transparent, var(--gold) 12%, var(--gold-soft) 50%, var(--gold) 88%, transparent);
              box-shadow: 0 0 24px rgba(200,179,138,.6);
              animation: rmd-bar 420ms cubic-bezier(.7,0,.2,1) 80ms both, rmd-lift 520ms cubic-bezier(.3,0,.2,1) 1500ms both; }
            .rmd-plate { position: absolute; top: 50%; width: 14px; border-radius: 3px; background: #F2F0EA; translate: 0 -50%; }
            .rmd-l1, .rmd-r1 { height: min(120px, 30vw); }
            .rmd-l2, .rmd-r2 { height: min(92px, 23vw); background: var(--gold); }
            .rmd-l1 { left: max(8%, calc(50% - 260px)); animation: rmd-plateL 260ms cubic-bezier(.5,0,.2,1.2) 420ms both, rmd-lift 520ms cubic-bezier(.3,0,.2,1) 1500ms both; }
            .rmd-l2 { left: calc(max(8%, calc(50% - 260px)) + 18px); animation: rmd-plateL 260ms cubic-bezier(.5,0,.2,1.2) 520ms both, rmd-lift 520ms cubic-bezier(.3,0,.2,1) 1500ms both; }
            .rmd-r1 { right: max(8%, calc(50% - 260px)); animation: rmd-plateR 260ms cubic-bezier(.5,0,.2,1.2) 420ms both, rmd-lift 520ms cubic-bezier(.3,0,.2,1) 1500ms both; }
            .rmd-r2 { right: calc(max(8%, calc(50% - 260px)) + 18px); animation: rmd-plateR 260ms cubic-bezier(.5,0,.2,1.2) 520ms both, rmd-lift 520ms cubic-bezier(.3,0,.2,1) 1500ms both; }
            .rmd-logo-wrap { position: absolute; left: 50%; top: 50%; translate: -50% calc(-50% - min(32vw, 150px)); animation: rmd-lift 520ms cubic-bezier(.3,0,.2,1) 1500ms both; }
            .rmd-logo { display: block; width: min(46vw, 210px); height: min(46vw, 210px); object-fit: cover; border-radius: 22%;
              box-shadow: 0 0 0 1px rgba(200,179,138,.35), 0 20px 60px rgba(200,179,138,.25);
              animation: rmd-drop 380ms cubic-bezier(.7,0,.25,1.35) 720ms both; }
            .rmd-ring { position: absolute; left: 50%; top: 50%; width: min(46vw, 210px); height: min(46vw, 210px); border-radius: 22%;
              border: 2px solid var(--gold); translate: -50% calc(-50% - min(32vw, 150px)); opacity: 0; animation: rmd-ring 700ms ease-out 1090ms both; }
            .rmd-flash { position: absolute; inset: 0; background: var(--gold-soft); mix-blend-mode: screen; opacity: 0; animation: rmd-flash 380ms ease-out 1090ms both; }
            .rmd-sparks { position: absolute; inset: 0; }
            .rmd-spark { position: absolute; left: 50%; top: calc(50% - min(32vw, 150px)); border-radius: 50%; background: var(--gold); opacity: 0; animation: rmd-spark 560ms ease-out 1090ms both; }
            .rmd-count { position: absolute; top: 60%; left: 0; right: 0; text-align: center; font-family: var(--font-editorial); font-weight: 800; font-size: 18px; letter-spacing: .2em; color: var(--gold); font-variant-numeric: tabular-nums; animation: rmd-tag 300ms ease-out 1350ms both; }
            .rmd-tag { position: absolute; bottom: 22%; left: 0; right: 0; text-align: center; font-family: var(--font-display); font-weight: 800; font-size: 12px; letter-spacing: .42em; color: #8E8B83; animation: rmd-tag 500ms ease-out 1350ms both, rmd-lift 520ms cubic-bezier(.3,0,.2,1) 1500ms both; }
            .rmd-wipe { position: absolute; inset: 0; background: var(--gold); transform: translateY(100%); animation: rmd-wipe 640ms cubic-bezier(.8,0,.2,1) 2050ms both; }

            @keyframes rmd-bar { from { scale: 0 1; opacity: 0; } to { scale: 1 1; opacity: 1; } }
            @keyframes rmd-plateL { from { translate: -100vw -50%; } to { translate: 0 -50%; } }
            @keyframes rmd-plateR { from { translate: 100vw -50%; } to { translate: 0 -50%; } }
            @keyframes rmd-drop { 0% { transform: translateY(-160%) scale(2.2) rotate(-8deg); opacity: 0; filter: blur(8px); } 70% { opacity: 1; filter: blur(0); } 100% { transform: none; opacity: 1; } }
            @keyframes rmd-ring { 0% { opacity: .9; transform: scale(1); } 100% { opacity: 0; transform: scale(1.9); } }
            @keyframes rmd-shake { 0%,100% { transform: none; } 20% { transform: translate(-6px, 3px); } 40% { transform: translate(5px, -4px); } 60% { transform: translate(-3px, 2px); } 80% { transform: translate(2px, -1px); } }
            @keyframes rmd-flash { 0% { opacity: .55; } 100% { opacity: 0; } }
            @keyframes rmd-spark { 0% { opacity: 1; transform: translate(-50%,-50%); } 100% { opacity: 0; transform: translate(-50%,-50%) translate(var(--x), var(--y)) scale(.2); } }
            @keyframes rmd-tag { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
            @keyframes rmd-lift { from { transform: translateY(0); } 40% { transform: translateY(12px); } to { transform: translateY(-40px); } }
            @keyframes rmd-wipe { 0% { transform: translateY(100%); } 50% { transform: translateY(0); } 100% { transform: translateY(-100%); } }
            @keyframes rmd-out { to { opacity: 0; visibility: hidden; } }
            @media (prefers-reduced-motion: reduce) {
              .rmd-intro, .rmd-intro * { animation: none !important; }
              .rmd-wipe, .rmd-ring, .rmd-flash, .rmd-sparks { display: none; }
            }
          `}</style>
        </div>
      )}
    </>
  );
}
