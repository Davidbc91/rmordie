import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import logoAsset from "@/assets/rmordie-logo.jpg.asset.json";

/*
 * Entrada de la app (~3,7 s, una vez por sesión, tocar la salta):
 *  1. El reloj del box cuenta 03 · 02 · 01 · GO (en el oro de la app).
 *  2. El logo se forma con 36 piezas que vuelan y encajan de golpe:
 *     sacudida, anillos, chispas, rayos y nube de magnesio.
 *  3. Cae una barra cargada (disco grande dentro, pequeño fuera, cierre
 *     dorado) que rebota bajo el logo y levanta magnesio en los extremos.
 *  4. Un brillo recorre el logo, entra «RM OR DIE» letra a letra y el lema.
 *  5. El logo se acerca hasta llenar la pantalla y aparece la app.
 */

const REVEAL_MS = 3300;
const TOTAL_MS = 3750;
const N = 6; // piezas por lado

/** Aleatorio fijo (mismo resultado en servidor y navegador). */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

type Vars = CSSProperties & Record<`--${string}`, string>;

export function SplashScreen({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(true);
  const [revealed, setRevealed] = useState(false);
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
      timers.current.push(window.setTimeout(() => setRevealed(true), 600));
      timers.current.push(window.setTimeout(() => setVisible(false), 900));
      return;
    }
    // Vibración en los golpes (Android; en iPhone no hace nada)
    const buzz = (p: number | number[]) => { try { navigator.vibrate?.(p); } catch { /* sin vibración */ } };
    timers.current.push(window.setTimeout(() => buzz([35, 25, 20]), 1500));
    timers.current.push(window.setTimeout(() => buzz(30), 2040));
    timers.current.push(window.setTimeout(() => setRevealed(true), REVEAL_MS));
    timers.current.push(window.setTimeout(() => setVisible(false), TOTAL_MS));
    const ts = timers.current;
    return () => ts.forEach((t) => window.clearTimeout(t));
  }, []);

  const parts = useMemo(() => {
    const rnd = seeded(91);
    const tiles: Vars[] = [];
    for (let r = 0; r < N; r++)
      for (let c = 0; c < N; c++) {
        const dx = c - (N - 1) / 2, dy = r - (N - 1) / 2;
        const ang = Math.atan2(dy, dx) + (rnd() - 0.5) * 0.9;
        const far = 60 + rnd() * 90;
        tiles.push({
          left: `${(c / N) * 100}%`,
          top: `${(r / N) * 100}%`,
          width: `${100 / N + 0.4}%`,
          height: `${100 / N + 0.4}%`,
          backgroundImage: `url(${logoAsset.url})`,
          backgroundPosition: `${(c / (N - 1)) * 100}% ${(r / (N - 1)) * 100}%`,
          animationDelay: `${Math.round(640 + Math.hypot(dx, dy) * 70 + rnd() * 90)}ms`,
          "--x": `${Math.cos(ang) * far}cqw`,
          "--y": `${Math.sin(ang) * far}cqw`,
          "--z": `${Math.round(rnd() * 300)}px`,
          "--r": `${Math.round((rnd() - 0.5) * 220)}deg`,
          "--ry": `${Math.round((rnd() - 0.5) * 160)}deg`,
        });
      }
    const sparks: Vars[] = Array.from({ length: 26 }, (_, i) => {
      const a = (i / 26) * Math.PI * 2 + rnd() * 0.2, d = 30 + rnd() * 30, z = 3 + rnd() * 6;
      return { width: z, height: z, animationDelay: `${Math.round(1500 + rnd() * 80)}ms`, "--sx": `${Math.cos(a) * d}cqw`, "--sy": `${Math.sin(a) * d}cqw` };
    });
    const puff = (left: string, top: string, n: number, t: number, spread: number): Vars[] =>
      Array.from({ length: n }, () => {
        const a = rnd() * Math.PI * 2, d = spread * (0.4 + rnd() * 0.6), sz = 14 + rnd() * 18;
        return {
          left, top, width: `${sz}cqw`, height: `${sz}cqw`,
          animationDelay: `${Math.round(t + rnd() * 90)}ms`,
          "--cx": `${Math.cos(a) * d}cqw`, "--cy": `${Math.sin(a) * d * 0.6 - 4}cqw`, "--cs": String(1.4 + rnd()),
        };
      });
    const barY = "calc(44% + var(--L) / 2 + 12cqw)";
    const chalk = [...puff("50%", "44%", 10, 1500, 34), ...puff("14%", barY, 6, 2040, 18), ...puff("86%", barY, 6, 2040, 18)];
    return { tiles, sparks, chalk };
  }, []);

  // Barra: tope interior, disco grande, mediano, pequeño dorado y cierre por fuera
  const side = (dir: "left" | "right") => (
    <>
      <div className="rmd-stop" style={{ [dir]: "18cqw" }} />
      {([["#2A2F3D", 16, 13.8], ["#353A4B", 14.5, 10], ["#3BB8F5", 12.5, 6.2]] as const).map(([c, h, o]) => (
        <div key={`${c}${o}`} className="rmd-plate" style={{ [dir]: `${o}cqw`, height: `${h}cqw`, background: c }} />
      ))}
      <div className="rmd-collar" style={{ [dir]: "3.6cqw" }} />
    </>
  );

  return (
    <>
      <div className={"transition-opacity duration-200 " + (revealed ? "opacity-100" : "opacity-0")} aria-hidden={!revealed}>
        {children}
      </div>

      {visible && (
        <div aria-hidden onPointerDown={finish} className="rmd-intro fixed inset-0 z-[9999] overflow-hidden">
          <div className="rmd-box">
            <div className="rmd-clock">
              <span className="rmd-ghost">88</span>
              <span className="rmd-c3">03</span>
              <span className="rmd-c2">02</span>
              <span className="rmd-c1">01</span>
              <span className="rmd-go">GO</span>
            </div>
            <div className="rmd-shake">
              <div className="rmd-glow" />
              <div className="rmd-rays" />
              <div className="rmd-ring rmd-r1" />
              <div className="rmd-ring rmd-r2" />
              <div className="rmd-ring rmd-r3" />
              <div className="rmd-stage">
                <div className="rmd-logo" style={{ backgroundImage: `url(${logoAsset.url})` }} />
                {parts.tiles.map((st, i) => <div key={i} className="rmd-tile" style={st} />)}
                <div className="rmd-shine" />
              </div>
              <div className="rmd-barbell">
                <div className="rmd-bar" />
                {side("left")}
                {side("right")}
              </div>
              {parts.sparks.map((st, i) => <div key={i} className="rmd-spark" style={st} />)}
              {parts.chalk.map((st, i) => <div key={i} className="rmd-chalk" style={st} />)}
              <div className="rmd-flash" />
            </div>
            <div className="rmd-tag">
              {"RM OR DIE".split("").map((ch, i) =>
                ch === " " ? " " : (
                  <span key={i} className={i >= 3 && i <= 4 ? "rmd-g" : ""} style={{ animationDelay: `${2200 + i * 45}ms` }}>{ch}</span>
                ),
              )}
            </div>
            <div className="rmd-sub">Entrena · Registra · Supérate</div>
          </div>

          <style>{SPLASH_CSS}</style>
        </div>
      )}
    </>
  );
}

const SPLASH_CSS = `
.rmd-intro{--gold:#C6FF00;--gold-soft:#DBFF66;--ink:#F5F5F7;--muted:#99999A;background:radial-gradient(120% 80% at 50% 40%,#1A222D 0%,#0C0C0E 62%);animation:rmd-out 450ms ease-in 3300ms both}
.rmd-box{position:absolute;top:0;bottom:0;left:50%;width:min(100vw,480px);translate:-50% 0;container-type:inline-size;perspective:900px;--L:60cqw}
.rmd-glow{position:absolute;left:50%;top:44%;width:150cqw;height:150cqw;translate:-50% -50%;border-radius:50%;background:radial-gradient(circle,rgba(255,138,61,.32) 0%,rgba(59,184,245,.12) 38%,transparent 64%);opacity:0;animation:rmd-glow 1.6s ease-out 1420ms both}
.rmd-rays{position:absolute;left:50%;top:44%;width:180cqw;height:180cqw;translate:-50% -50%;border-radius:50%;background:repeating-conic-gradient(from 0deg,rgba(198,255,0,.12) 0 4deg,transparent 4deg 16deg);-webkit-mask:radial-gradient(circle,#000 0 30%,transparent 62%);mask:radial-gradient(circle,#000 0 30%,transparent 62%);opacity:0;animation:rmd-rays 2.6s linear 1460ms both}
.rmd-ring{position:absolute;left:50%;top:44%;width:var(--L);height:var(--L);translate:-50% -50%;border-radius:24%;border:2px solid var(--gold);opacity:0}
.rmd-r2{border-color:#DBFF66}.rmd-r3{border-color:#3BB8F5}
.rmd-r1{animation:rmd-ring 900ms cubic-bezier(.2,.7,.3,1) 1500ms both}
.rmd-r2{animation:rmd-ring 1100ms cubic-bezier(.2,.7,.3,1) 1620ms both}
.rmd-r3{border-width:1px;animation:rmd-ring 1300ms cubic-bezier(.2,.7,.3,1) 1750ms both}
.rmd-stage{position:absolute;left:50%;top:44%;width:var(--L);height:var(--L);translate:-50% -50%;transform-style:preserve-3d;animation:rmd-tilt 1.4s cubic-bezier(.2,.8,.2,1) 1500ms both,rmd-zoom 700ms cubic-bezier(.7,0,.3,1) 3050ms both}
.rmd-tile{position:absolute;background-size:var(--L) var(--L);will-change:transform,opacity;animation:rmd-fly 760ms cubic-bezier(.25,1.2,.35,1) both}
.rmd-logo{position:absolute;inset:0;border-radius:22%;background-size:cover;opacity:0;box-shadow:0 0 0 1px rgba(198,255,0,.4),0 30px 80px rgba(198,255,0,.25);animation:rmd-show 1ms linear 1500ms both}
.rmd-shine{position:absolute;inset:0;border-radius:22%;overflow:hidden;opacity:0;animation:rmd-show 1ms linear 1500ms both}
.rmd-shine::after{content:"";position:absolute;top:-20%;bottom:-20%;width:40%;left:-60%;background:linear-gradient(100deg,transparent,rgba(255,250,235,.75),transparent);transform:skewX(-18deg);animation:rmd-shine 700ms ease-in-out 2250ms both}
.rmd-flash{position:absolute;inset:0;background:var(--gold-soft);opacity:0;mix-blend-mode:screen;animation:rmd-flash 420ms ease-out 1500ms both}
.rmd-spark{position:absolute;left:50%;top:44%;border-radius:50%;background:var(--gold-soft);opacity:0;box-shadow:0 0 8px var(--gold);animation:rmd-spark 800ms cubic-bezier(.1,.7,.3,1) both}
.rmd-shake{position:absolute;inset:0;animation:rmd-shake 420ms 1500ms both,rmd-shake 300ms 2050ms both}
.rmd-tag{position:absolute;left:0;right:0;top:calc(44% + var(--L) / 2 + 26cqw);text-align:center;font-family:var(--font-editorial);font-weight:800;font-size:8cqw;line-height:1;letter-spacing:-.02em;color:var(--ink)}
.rmd-tag span{display:inline-block;opacity:0;animation:rmd-letter 420ms cubic-bezier(.2,.9,.3,1.3) both}
.rmd-tag .rmd-g{background:linear-gradient(135deg,#D8FF4D,#C6FF00 55%,#AEE600);-webkit-background-clip:text;background-clip:text;color:transparent}
.rmd-sub{position:absolute;left:0;right:0;top:calc(44% + var(--L) / 2 + 37cqw);text-align:center;font-family:var(--font-display);font-weight:700;font-size:3.8cqw;letter-spacing:0;color:var(--muted);opacity:0;animation:rmd-fade 500ms ease-out 2500ms both}
.rmd-clock{position:absolute;left:50%;top:max(13%,calc(env(safe-area-inset-top) + 12px));translate:-50% 0;padding:2.4cqw 5cqw;border-radius:4cqw;background:#1B1B1D;border:1px solid rgba(198,255,0,.25);box-shadow:inset 0 0 0 1px #000,0 0 30px rgba(198,255,0,.12);font-family:var(--font-num);font-weight:900;font-size:13cqw;line-height:1;font-variant-numeric:tabular-nums;color:var(--gold-soft);text-shadow:0 0 10px rgba(198,255,0,.9),0 0 26px rgba(198,255,0,.45);letter-spacing:.1em;display:grid;animation:rmd-clockout 400ms ease-in 2900ms both}
.rmd-clock span{grid-area:1/1;text-align:center;opacity:0}
.rmd-clock .rmd-ghost{opacity:.08;text-shadow:none}
.rmd-c3{animation:rmd-blink 350ms steps(1) 100ms both}.rmd-c2{animation:rmd-blink 350ms steps(1) 450ms both}.rmd-c1{animation:rmd-blink 350ms steps(1) 800ms both}
.rmd-clock .rmd-go{animation:rmd-show 1ms linear 1150ms both,rmd-pulse 600ms ease-out 1150ms both}
.rmd-barbell{position:absolute;left:50%;top:calc(44% + var(--L) / 2 + 12cqw);width:92cqw;height:20cqw;translate:-50% -50%;animation:rmd-drop 620ms cubic-bezier(.55,0,1,.45) 1420ms both,rmd-bounce 520ms cubic-bezier(.2,.8,.3,1) 2040ms both}
.rmd-bar{position:absolute;left:0;right:0;top:50%;height:1.3cqw;translate:0 -50%;border-radius:1cqw;background:linear-gradient(#F5F5F7,#8E8B83 60%,#C9C6BE)}
.rmd-plate{position:absolute;top:50%;translate:0 -50%;width:3.6cqw;border-radius:1cqw;box-shadow:inset -0.6cqw 0 0 rgba(0,0,0,.35),inset 0 0 0 .35cqw rgba(198,255,0,.55)}
.rmd-stop{position:absolute;top:50%;translate:0 -50%;width:1.4cqw;height:4cqw;border-radius:.5cqw;background:#C9C6BE}
.rmd-collar{position:absolute;top:50%;translate:0 -50%;width:2cqw;height:5cqw;border-radius:.6cqw;background:var(--gold)}
.rmd-chalk{position:absolute;border-radius:50%;background:radial-gradient(circle,rgba(242,240,234,.8),rgba(232,221,200,.3) 45%,transparent 70%);opacity:0;filter:blur(1.5px);animation:rmd-chalk 1400ms cubic-bezier(.1,.6,.3,1) both}

@keyframes rmd-fly{from{transform:translate3d(var(--x),var(--y),var(--z)) rotate(var(--r)) rotateY(var(--ry)) scale(.4);opacity:0;filter:blur(6px)}60%{opacity:1;filter:blur(0)}to{transform:none;opacity:1}}
@keyframes rmd-show{to{opacity:1}}
@keyframes rmd-tilt{0%{transform:scale(1.12) rotateX(14deg) rotateY(-16deg)}35%{transform:scale(.96) rotateX(-4deg) rotateY(6deg)}100%{transform:none}}
@keyframes rmd-zoom{to{transform:scale(9);opacity:0}}
@keyframes rmd-glow{0%{opacity:0;transform:scale(.4)}40%{opacity:1}100%{opacity:.7;transform:scale(1)}}
@keyframes rmd-rays{0%{opacity:0;rotate:0deg}20%{opacity:1}100%{opacity:.6;rotate:40deg}}
@keyframes rmd-ring{0%{opacity:.95;transform:scale(1)}100%{opacity:0;transform:scale(2.6)}}
@keyframes rmd-shine{to{left:130%}}
@keyframes rmd-flash{0%{opacity:.35}100%{opacity:0}}
@keyframes rmd-spark{0%{opacity:1;transform:translate(-50%,-50%)}100%{opacity:0;transform:translate(-50%,-50%) translate(var(--sx),var(--sy)) scale(.3)}}
@keyframes rmd-shake{0%,100%{transform:none}15%{transform:translate(-7px,4px)}30%{transform:translate(6px,-5px)}45%{transform:translate(-4px,3px)}60%{transform:translate(3px,-2px)}80%{transform:translate(-1px,1px)}}
@keyframes rmd-letter{from{opacity:0;transform:translateY(60%) scale(1.6)}to{opacity:1;transform:none}}
@keyframes rmd-fade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
@keyframes rmd-out{to{opacity:0;visibility:hidden}}
@keyframes rmd-blink{0%{opacity:1}99%{opacity:1}100%{opacity:0}}
@keyframes rmd-pulse{0%{transform:scale(1.35)}100%{transform:none}}
@keyframes rmd-clockout{to{opacity:0;transform:translateY(-6cqw)}}
@keyframes rmd-drop{from{transform:translateY(-95cqw) rotate(-7deg);opacity:0}15%{opacity:1}to{transform:none;opacity:1}}
@keyframes rmd-bounce{0%{transform:none}35%{transform:translateY(-3.5cqw) rotate(1.2deg)}70%{transform:translateY(0)}85%{transform:translateY(-.8cqw)}100%{transform:none}}
@keyframes rmd-chalk{0%{opacity:.9;transform:translate(-50%,-50%) scale(.2)}100%{opacity:0;transform:translate(-50%,-50%) translate(var(--cx),var(--cy)) scale(var(--cs))}}
@media (prefers-reduced-motion:reduce){
  .rmd-intro,.rmd-intro *{animation:none!important}
  .rmd-intro .rmd-logo{opacity:1}
  .rmd-tile,.rmd-ring,.rmd-flash,.rmd-spark,.rmd-chalk,.rmd-rays,.rmd-clock{display:none}
  .rmd-tag span,.rmd-sub,.rmd-glow{opacity:1}
}
`;
