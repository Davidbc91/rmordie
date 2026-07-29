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
    <div className="min-h-screen pb-28">
      <main className="mx-auto max-w-2xl px-5 pt-10">{children}</main>
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t"
        style={{
          background: "rgba(0,0,0,0.85)",
          borderColor: "#1A1A1A",
          backdropFilter: "saturate(140%) blur(20px)",
          WebkitBackdropFilter: "saturate(140%) blur(20px)",
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
                className="flex flex-1 flex-col items-center gap-1 rounded-lg py-2 text-[10px] transition"
                style={{ color: active ? "#FFFFFF" : "#6F6F6F", letterSpacing: "0.02em" }}
              >
                <Icon className="h-[18px] w-[18px]" strokeWidth={active ? 2 : 1.5} />
                <span>{t.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
