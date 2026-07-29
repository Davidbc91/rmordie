import { useEffect, useState, type ReactNode } from "react";

export function SplashScreen({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFading(true), 900);
    const hideTimer = setTimeout(() => setVisible(false), 1300);
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
          className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center transition-opacity duration-400 ${
            fading ? "opacity-0" : "opacity-100"
          }`}
          style={{ background: "#000000" }}
        >
          <div className="splash-mark flex flex-col items-center">
            <div
              className="text-white font-bold tracking-tight leading-none"
              style={{ fontSize: "72px", letterSpacing: "-0.06em" }}
            >
              RM
            </div>
            <div
              className="mt-2 text-white/70 text-[11px] uppercase"
              style={{ letterSpacing: "0.4em" }}
            >
              OR DIE
            </div>
          </div>
          <style>{`
            .splash-mark { animation: splash-in 500ms cubic-bezier(0.22, 1, 0.36, 1) both; }
            @keyframes splash-in {
              0% { transform: scale(0.96); opacity: 0; }
              100% { transform: scale(1); opacity: 1; }
            }
          `}</style>
        </div>
      )}
    </>
  );
}
