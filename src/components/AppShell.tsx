import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Calendar, Upload, Settings } from "lucide-react";

const tabs = [
  { to: "/", label: "Inicio", icon: Home },
  { to: "/calendar", label: "Calendario", icon: Calendar },
  { to: "/import", label: "Importar", icon: Upload },
  { to: "/settings", label: "Ajustes", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="min-h-screen pb-24">
      <main className="mx-auto max-w-2xl px-5 pt-8">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 backdrop-blur-xl" style={{ background: "color-mix(in oklab, var(--background) 85%, transparent)" }}>
        <div className="mx-auto flex max-w-2xl items-center justify-around px-2 py-2 safe-bottom">
          {tabs.map((t) => {
            const active = pathname === t.to || (t.to !== "/" && pathname.startsWith(t.to));
            const Icon = t.icon;
            return (
              <Link
                key={t.to}
                to={t.to}
                className="flex flex-1 flex-col items-center gap-1 rounded-lg py-2 text-[11px] transition"
                style={{ color: active ? "var(--gold)" : "var(--muted-foreground)" }}
              >
                <Icon className="h-5 w-5" strokeWidth={active ? 2.2 : 1.6} />
                <span>{t.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
