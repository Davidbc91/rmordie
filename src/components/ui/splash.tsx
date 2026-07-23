import { useEffect, useState, type ReactNode } from "react";

export function SplashScreen({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFading(true), 1400);
    const hideTimer = setTimeout(() => setVisible(false), 1900);
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
          className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center transition-opacity duration-500 ${
            fading ? "opacity-0" : "opacity-100"
          }`}
          style={{
            background:
              "radial-gradient(ellipse at center, #14101f 0%, #050508 70%)",
          }}
        >
          <div className="relative flex flex-col items-center">
            <div
              className="absolute inset-0 -m-8 rounded-full blur-2xl opacity-40 animate-pulse"
              style={{
                background:
                  "radial-gradient(circle, var(--gold, #d4af37) 0%, transparent 70%)",
              }}
            />
            <img
              src="/icon-512.png"
              alt="Malitos Premium Check"
              className="relative w-32 h-32 rounded-3xl shadow-2xl splash-icon"
              style={{
                boxShadow:
                  "0 20px 60px rgba(0,0,0,0.6), 0 0 40px rgba(212,175,55,0.25)",
              }}
            />
          </div>
          <div className="mt-8 text-center splash-text">
            <h1
              className="text-2xl font-bold tracking-wide"
              style={{
                background:
                  "linear-gradient(135deg, #f5d97a 0%, #d4af37 50%, #a17f1a 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              MALITOS PREMIUM
            </h1>
            <p className="mt-1 text-xs uppercase tracking-[0.3em] text-white/50">
              Check
            </p>
          </div>
          <div className="absolute bottom-16 flex gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--gold,#d4af37)] animate-bounce" style={{ animationDelay: "0ms" }} />
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--gold,#d4af37)] animate-bounce" style={{ animationDelay: "150ms" }} />
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--gold,#d4af37)] animate-bounce" style={{ animationDelay: "300ms" }} />
          </div>
          <style>{`
            .splash-icon {
              animation: splash-in 700ms cubic-bezier(0.22, 1, 0.36, 1) both;
            }
            .splash-text {
              animation: splash-fade 900ms ease-out 200ms both;
            }
            @keyframes splash-in {
              0% { transform: scale(0.6); opacity: 0; }
              100% { transform: scale(1); opacity: 1; }
            }
            @keyframes splash-fade {
              0% { transform: translateY(8px); opacity: 0; }
              100% { transform: translateY(0); opacity: 1; }
            }
          `}</style>
        </div>
      )}
    </>
  );
}
