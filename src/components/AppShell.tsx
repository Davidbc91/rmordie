import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Calendar, Trophy, Timer, MessageCircle, Upload, Settings } from "lucide-react";

const tabs = [
  { to: "/", label: "Inicio", icon: Home },
  { to: "/calendar", label: "Calendario", icon: Calendar },
  { to: "/records", label: "RM", icon: Trophy },
  { to: "/timers", label: "Timer", icon: Timer },
  { to: "/chat", label: "Chat", icon: MessageCircle },
  { to: "/import", label: "Importar", icon: Upload },
  { to: "/settings", label: "Ajustes", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
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

      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t"
        style={{
          background: "rgba(0,0,0,0.72)",
          borderColor: "#1A1A1A",
          backdropFilter: "saturate(160%) blur(24px)",
          WebkitBackdropFilter: "saturate(160%) blur(24px)",
        }}
      >
        <div className="mx-auto flex max-w-2xl items-center justify-around px-2 py-2 safe-bottom">
          {tabs.map((t) => {
            const active = pathname === t.to || (t.to !== "/" && pathname.startsWith(t.to));
            const Icon = t.icon;
            return (
              <Link
                key={t.to}
                to={t.to}
                className="pressable relative flex flex-1 flex-col items-center gap-1 rounded-[14px] py-2 text-[10px]"
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
