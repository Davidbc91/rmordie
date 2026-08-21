import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Calendar, Trophy, Timer, MessageCircle, Upload, Settings, User, Play, X } from "lucide-react";
import { useEffect, useState } from "react";
import { getActiveWorkout, clearActiveWorkout, type ActiveWorkout } from "@/lib/active-workout";

const tabs = [
  { to: "/", label: "Inicio", icon: Home },
  { to: "/calendar", label: "Calendario", icon: Calendar },
  { to: "/profile", label: "Perfil", icon: User },
  { to: "/records", label: "RM", icon: Trophy },
  
  { to: "/timers", label: "Timer", icon: Timer },
  { to: "/chat", label: "Chat", icon: MessageCircle },
  { to: "/import", label: "Importar", icon: Upload },
  { to: "/settings", label: "Ajustes", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [active, setActive] = useState<ActiveWorkout | null>(null);

  useEffect(() => {
    const read = () => setActive(getActiveWorkout());
    read();
    window.addEventListener("rmordie:active-workout", read);
    window.addEventListener("focus", read);
    return () => {
      window.removeEventListener("rmordie:active-workout", read);
      window.removeEventListener("focus", read);
    };
  }, [pathname]);

  const activePath = active ? `/workout/${active.month}/${active.week}/${active.day}` : null;
  const showResume = !!active && pathname !== activePath;

  return (
    <div className="grain relative min-h-screen pb-28">
      {/* Halo superior + rejilla muy tenue para dar profundidad al negro */}
      <div aria-hidden className="aura pointer-events-none absolute inset-x-0 top-0 h-[320px]" />
      <div
        aria-hidden
        className="dotgrid pointer-events-none absolute inset-x-0 top-0 h-[420px] opacity-[0.35]"
        style={{ maskImage: "linear-gradient(#000, transparent)", WebkitMaskImage: "linear-gradient(#000, transparent)" }}
      />
      <main className="relative mx-auto max-w-2xl px-5 pt-10">{children}</main>

      {showResume && active && (
        <div className="fixed inset-x-0 bottom-[72px] z-40 px-4 pb-2">
          <div
            className="mx-auto flex max-w-2xl items-center gap-3 rounded-[18px] border px-4 py-3"
            style={{
              background: "rgba(255,255,255,0.96)",
              borderColor: "rgba(255,255,255,0.2)",
              color: "#000",
              backdropFilter: "blur(18px)",
            }}
          >
            <Link
              to="/workout/$month/$week/$day"
              params={{ month: active.month, week: String(active.week), day: active.day }}
              className="flex min-w-0 flex-1 items-center gap-3"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black">
                <Play className="h-4 w-4 text-white" />
              </span>
              <span className="min-w-0">
                <span className="block text-[11px] uppercase tracking-[0.16em] opacity-60">Entreno en curso</span>
                <span className="block truncate text-sm font-semibold">{active.label}</span>
              </span>
            </Link>
            <button
              aria-label="Descartar entreno en curso"
              onClick={() => { clearActiveWorkout(); setActive(null); }}
              className="shrink-0 rounded-full p-1.5 opacity-50 hover:opacity-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}


      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t"
        style={{
          background: "rgba(0,0,0,0.72)",
          borderColor: "#1A1A1A",
          backdropFilter: "saturate(160%) blur(24px)",
          WebkitBackdropFilter: "saturate(160%) blur(24px)",
        }}
      >
        <div className="mx-auto flex max-w-2xl items-center gap-1 overflow-x-auto no-scrollbar px-2 py-2 safe-bottom">
          {tabs.map((t) => {
            const active = pathname === t.to || (t.to !== "/" && pathname.startsWith(t.to));
            const Icon = t.icon;
            return (
              <Link
                key={t.to}
                to={t.to}
                className="pressable relative flex min-w-[58px] flex-1 shrink-0 flex-col items-center gap-1 rounded-[14px] py-2 text-[10px]"
                style={{ color: active ? "#FFFFFF" : "#6F6F6F", letterSpacing: "0.02em" }}
              >
                <span
                  aria-hidden
                  className="absolute inset-x-1.5 inset-y-0.5 rounded-[14px] transition-opacity duration-300"
                  style={{ background: "rgba(255,255,255,0.08)", opacity: active ? 1 : 0 }}
                />
                <Icon className="relative h-[18px] w-[18px]" strokeWidth={active ? 2.2 : 1.5} />
                <span className="relative">{t.label}</span>
                <span
                  aria-hidden
                  className="absolute -top-px h-[2px] rounded-full bg-white transition-all duration-300"
                  style={{ width: active ? 18 : 0, opacity: active ? 1 : 0 }}
                />
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
