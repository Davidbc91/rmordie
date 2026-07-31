import { useEffect, useState, type ReactNode } from "react";

export function SplashScreen({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFading(true), 1000);
    const hideTimer = setTimeout(() => setVisible(false), 1450);
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
          <div className="splash-mark relative flex flex-col items-center">
            <div
              className="font-bold leading-none tracking-tight"
              style={{ fontSize: "76px", letterSpacing: "-0.06em", color: "#FFFFFF" }}
            >
              RM
            </div>
            <div className="splash-sub mt-3 text-[11px] uppercase" style={{ letterSpacing: "0.45em", color: "rgba(255,255,255,0.7)" }}>
              OR DIE
            </div>
            <div className="splash-line mt-6 h-px" style={{ background: "rgba(255,255,255,0.35)" }} />
          </div>
          <style>{`
            .splash-aura {
              background: radial-gradient(60% 40% at 50% 45%, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0) 70%);
              animation: splash-glow 1400ms ease-out both;
            }
            .splash-mark { animation: splash-in 620ms cubic-bezier(0.22, 1, 0.36, 1) both; }
            .splash-sub { animation: splash-in 620ms cubic-bezier(0.22, 1, 0.36, 1) 160ms both; }
            .splash-line { width: 0; animation: splash-rule 720ms cubic-bezier(0.22, 1, 0.36, 1) 260ms forwards; }
            @keyframes splash-in {
              0% { transform: scale(0.94) translateY(6px); opacity: 0; }
              100% { transform: scale(1) translateY(0); opacity: 1; }
            }
            @keyframes splash-rule { to { width: 132px; } }
            @keyframes splash-glow { 0% { opacity: 0; } 100% { opacity: 1; } }
            @media (prefers-reduced-motion: reduce) {
              .splash-mark, .splash-sub, .splash-aura, .splash-line { animation: none; opacity: 1; width: 132px; }
            }
          `}</style>
        </div>
      )}
    </>
  );
}
