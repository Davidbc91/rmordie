import { useEffect, useState, type ReactNode } from "react";
import logoAsset from "@/assets/rmordie-logo.jpg.asset.json";

export function SplashScreen({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFading(true), 1700);
    const hideTimer = setTimeout(() => setVisible(false), 2150);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  return (
    <>
      {children}
      {visible && (
        <div
          aria-hidden
          className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden transition-opacity duration-500 ${
            fading ? "opacity-0" : "opacity-100"
          }`}
          style={{ background: "#000000" }}
        >
          <div className="splash-aura pointer-events-none absolute inset-0" />
          <div className="splash-pulse pointer-events-none absolute h-56 w-56 rounded-[44px]" />
          <div className="splash-mark relative flex flex-col items-center">
            <img
              src={logoAsset.url}
              alt="RM OR DIE"
              className="splash-logo h-40 w-40 rounded-[28px] object-cover"
            />
            <div
              className="splash-sub mt-6 text-[11px] uppercase"
              style={{ letterSpacing: "0.45em", color: "rgba(255,255,255,0.7)" }}
            >
              RM OR DIE
            </div>
            <div className="splash-line mt-5 h-px" style={{ background: "rgba(255,255,255,0.35)" }} />
          </div>
          <style>{`
            .splash-aura {
              background: radial-gradient(60% 40% at 50% 45%, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0) 70%);
              animation: splash-glow 1400ms ease-out both;
            }
            .splash-pulse {
              border: 1px solid rgba(255,255,255,0.18);
              animation: splash-ring 1800ms cubic-bezier(0.22, 1, 0.36, 1) 320ms infinite;
            }
            .splash-mark { animation: splash-in 720ms cubic-bezier(0.22, 1, 0.36, 1) both; }
            .splash-logo {
              box-shadow: 0 24px 70px rgba(255,255,255,0.14);
              animation: splash-logo 1500ms cubic-bezier(0.22, 1, 0.36, 1) both;
            }
            .splash-sub { animation: splash-in 620ms cubic-bezier(0.22, 1, 0.36, 1) 360ms both; }
            .splash-line { width: 0; animation: splash-rule 720ms cubic-bezier(0.22, 1, 0.36, 1) 480ms forwards; }
            @keyframes splash-in {
              0% { transform: scale(0.94) translateY(8px); opacity: 0; }
              100% { transform: scale(1) translateY(0); opacity: 1; }
            }
            @keyframes splash-logo {
              0% { transform: scale(0.72) rotate(-6deg); opacity: 0; filter: blur(6px); }
              55% { transform: scale(1.06) rotate(1deg); opacity: 1; filter: blur(0); }
              100% { transform: scale(1) rotate(0deg); opacity: 1; filter: blur(0); }
            }
            @keyframes splash-ring {
              0% { transform: scale(0.85); opacity: 0.55; }
              100% { transform: scale(1.5); opacity: 0; }
            }
            @keyframes splash-rule { to { width: 132px; } }
            @keyframes splash-glow { 0% { opacity: 0; } 100% { opacity: 1; } }
            @media (prefers-reduced-motion: reduce) {
              .splash-mark, .splash-sub, .splash-aura, .splash-logo, .splash-pulse { animation: none; opacity: 1; }
              .splash-line { animation: none; width: 132px; }
            }
          `}</style>
        </div>
      )}
    </>
  );
}
