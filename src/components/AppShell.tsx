import { Link, useRouterState } from "@tanstack/react-router";
import {
  Home, Calendar, Trophy, Timer, MessageCircle, Upload, Settings, User, Play, X, Users, MoreHorizontal, ChevronRight,
} from "lucide-react";
import { useEffect, useState } from "react";
import { getActiveWorkout, clearActiveWorkout, type ActiveWorkout } from "@/lib/active-workout";

const tabs = [
  { to: "/", label: "Inicio", icon: Home },
  { to: "/calendar", label: "Plan", icon: Calendar },
  { to: "/records", label: "RM", icon: Trophy },
  { to: "/social", label: "Social", icon: Users },
  { to: "/profile", label: "Perfil", icon: User },
];

const moreLinks = [
  { to: "/timers", label: "Temporizadores", hint: "AMRAP · EMOM · Tabata", icon: Timer },
  { to: "/chat", label: "Chat", hint: "Conversación del box", icon: MessageCircle },
  { to: "/import", label: "Importar planificación", hint: "Excel anual", icon: Upload },
  { to: "/settings", label: "Ajustes", hint: "Discos, barras y perfil", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [active, setActive] = useState<ActiveWorkout | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);

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

  useEffect(() => { setMoreOpen(false); }, [pathname]);

  const activePath = active ? `/workout/${active.month}/${active.week}/${active.day}` : null;
  const showResume = !!active && pathname !== activePath;
  const moreActive = moreLinks.some((l) => pathname.startsWith(l.to));

  return (
    <div className="grain relative min-h-[100dvh] pb-[104px]">
      <div aria-hidden className="aura pointer-events-none absolute inset-x-0 top-0 h-[300px]" />
      <div
        aria-hidden
        className="dotgrid pointer-events-none absolute inset-x-0 top-0 h-[360px] opacity-40"
        style={{ maskImage: "linear-gradient(#000, transparent)", WebkitMaskImage: "linear-gradient(#000, transparent)" }}
      />

      <main
        className="relative mx-auto max-w-2xl overflow-x-clip"
        style={{
          paddingLeft: "max(env(safe-area-inset-left), 1.25rem)",
          paddingRight: "max(env(safe-area-inset-right), 1.25rem)",
          paddingTop: "calc(env(safe-area-inset-top) + 2rem)",
        }}
      >
        {children}
      </main>

      {showResume && active && (
        <div className="fixed inset-x-0 bottom-[86px] z-40 px-4">
          <div className="glass-elevated glass-sheen animate-fade mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
            <Link
              to="/workout/$month/$week/$day"
              params={{ month: active.month, week: String(active.week), day: active.day }}
              className="flex min-w-0 flex-1 items-center gap-3"
            >
              <span className="gold-gradient flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
                <Play className="h-4 w-4" fill="currentColor" />
              </span>
              <span className="min-w-0">
                <span className="eyebrow block">Entreno en curso</span>
                <span className="mt-1 block truncate text-sm font-semibold">{active.label}</span>
              </span>
            </Link>
            <button
              aria-label="Descartar entreno en curso"
              onClick={() => { clearActiveWorkout(); setActive(null); }}
              className="tap grid shrink-0 place-items-center rounded-full text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {moreOpen && (
        <div className="fixed inset-0 z-50 flex items-end">
          <button aria-label="Cerrar menú" onClick={() => setMoreOpen(false)} className="absolute inset-0 bg-black/60 backdrop-blur-[6px]" />
          <div className="glass-elevated glass-sheen animate-fade relative mx-4 mb-[96px] max-w-2xl flex-1 p-3 sm:mx-auto">
            <p className="eyebrow px-2 pb-2 pt-1">Más</p>
            <div className="space-y-1.5">
              {moreLinks.map((l) => {
                const Icon = l.icon;
                const isActive = pathname.startsWith(l.to);
                return (
                  <Link
                    key={l.to}
                    to={l.to}
                    className="pressable flex items-center gap-3.5 rounded-[var(--r-md)] px-3 py-3"
                    style={{ background: isActive ? "rgba(216,180,107,0.10)" : "rgba(255,255,255,0.035)" }}
                  >
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[14px] border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)]">
                      <Icon className="h-[18px] w-[18px]" strokeWidth={1.7} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">{l.label}</span>
                      <span className="block truncate text-xs text-muted-foreground">{l.hint}</span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <nav className="fixed inset-x-0 bottom-0 z-50">
        <div
          className="safe-x border-t"
          style={{
            background: "rgba(8,9,11,0.72)",
            borderColor: "rgba(255,255,255,0.08)",
            backdropFilter: "blur(24px) saturate(170%)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.07)",
          }}
        >
          <div className="safe-bottom mx-auto flex max-w-2xl items-stretch gap-0.5 px-2 pt-1.5">
            {tabs.map((t) => {
              const isActive = pathname === t.to || (t.to !== "/" && pathname.startsWith(t.to));
              const Icon = t.icon;
              return (
                <Link
                  key={t.to}
                  to={t.to}
                  className="pressable relative flex flex-1 flex-col items-center justify-center gap-[5px] rounded-[16px] py-2"
                  style={{ color: isActive ? "var(--gold)" : "#7C7D83" }}
                >
                  <span
                    aria-hidden
                    className="absolute inset-x-1 inset-y-0 rounded-[16px] transition-opacity duration-200"
                    style={{ background: "rgba(216,180,107,0.10)", opacity: isActive ? 1 : 0 }}
                  />
                  <Icon className="relative h-[21px] w-[21px]" strokeWidth={isActive ? 2.1 : 1.6} />
                  <span
                    className="relative text-[10px] font-semibold"
                    style={{ letterSpacing: "0.03em", opacity: isActive ? 1 : 0.85 }}
                  >
                    {t.label}
                  </span>
                </Link>
              );
            })}
            <button
              onClick={() => setMoreOpen((v) => !v)}
              aria-label="Más secciones"
              className="pressable relative flex flex-1 flex-col items-center justify-center gap-[5px] rounded-[16px] py-2"
              style={{ color: moreActive || moreOpen ? "var(--gold)" : "#7C7D83" }}
            >
              <span
                aria-hidden
                className="absolute inset-x-1 inset-y-0 rounded-[16px] transition-opacity duration-200"
                style={{ background: "rgba(216,180,107,0.10)", opacity: moreActive || moreOpen ? 1 : 0 }}
              />
              <MoreHorizontal className="relative h-[21px] w-[21px]" strokeWidth={moreActive || moreOpen ? 2.1 : 1.6} />
              <span className="relative text-[10px] font-semibold" style={{ letterSpacing: "0.03em" }}>Más</span>
            </button>
          </div>
        </div>
      </nav>
    </div>
  );
}
