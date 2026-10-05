import { Link, useRouterState } from "@tanstack/react-router";
import {
  Home, Calendar, Trophy, Timer, MessageCircle, Upload, Settings, User, Play, X, Users, MoreHorizontal, ChevronRight, BookOpen, Film, FileText, HeartPulse, LogOut, ChevronDown,
} from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getActiveWorkout, clearActiveWorkout, type ActiveWorkout } from "@/lib/active-workout";
import { useChatUnread } from "@/lib/chat-unread";
import { SyncIndicator } from "@/components/SyncIndicator";
import { getCurrentUserId, signOut } from "@/lib/pin-gate";
import { isVideoAdmin } from "@/lib/admin-videos";
import { useProfiles } from "@/lib/store";

const tabs = [
  { to: "/", label: "Inicio", icon: Home },
  { to: "/calendar", label: "Plan", icon: Calendar },
  { to: "/records", label: "RM", icon: Trophy },
  { to: "/social", label: "Social", icon: Users },
];

const moreLinks = [
  { to: "/dictionary", label: "Diccionario", hint: "Movimientos CrossFit", icon: BookOpen },
  { to: "/timers", label: "Temporizadores", hint: "AMRAP · EMOM · Tabata", icon: Timer },
  { to: "/chat", label: "Chat", hint: "Conversación del box", icon: MessageCircle },
  { to: "/import", label: "Importar planificación", hint: "Excel anual", icon: Upload },
  { to: "/settings", label: "Ajustes", hint: "Discos, barras y perfil", icon: Settings },
];

type AppShellProps = { children: React.ReactNode; hideBottomNav?: boolean };

const ResumeWorkout = memo(function ResumeWorkout({ active, onDismiss }: { active: ActiveWorkout; onDismiss: () => void }) {
  return (
    <div className="fixed inset-x-0 z-40 px-4" style={{ bottom: "calc(max(env(safe-area-inset-bottom), 12px) + 76px)" }}>
      <div className="glass-elevated glass-sheen animate-fade mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
        <Link to="/workout/$month/$week/$day" params={{ month: active.month, week: String(active.week), day: active.day }} className="flex min-w-0 flex-1 items-center gap-3">
          <span className="gold-gradient flex h-10 w-10 shrink-0 items-center justify-center rounded-full"><Play className="h-4 w-4" fill="currentColor" /></span>
          <span className="min-w-0"><span className="eyebrow block">Entreno en curso</span><span className="mt-1 block truncate text-sm font-semibold">{active.label}</span></span>
        </Link>
        <button aria-label="Descartar entreno en curso" onClick={onDismiss} className="tap grid shrink-0 place-items-center rounded-full text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
      </div>
    </div>
  );
});

const BottomNavigation = memo(function BottomNavigation({ pathname, keyboardOpen, moreOpen, moreActive, chatUnread, onToggleMore }: { pathname: string; keyboardOpen: boolean; moreOpen: boolean; moreActive: boolean; chatUnread: number; onToggleMore: () => void }) {
  return (
    <nav aria-hidden={keyboardOpen} aria-label="Navegación principal" data-main-navigation className={"pointer-events-none fixed inset-x-0 bottom-0 px-0 transition-opacity duration-150 " + (keyboardOpen ? "pointer-events-none opacity-0" : "opacity-100")} style={{ zIndex: 2147483000, bottom: "max(env(safe-area-inset-bottom), 12px)", transform: "translateZ(0)" }}>
      <div className="pointer-events-auto mx-auto w-[calc(100vw-32px)] max-w-[360px] overflow-hidden rounded-[26px] border" style={{ background: "linear-gradient(135deg, rgba(255,255,255,.14), rgba(255,255,255,.045) 45%, rgba(200,179,138,.055)), rgba(10,10,12,.58)", borderColor: "rgba(255,255,255,0.22)", backdropFilter: "blur(24px) saturate(165%)", WebkitBackdropFilter: "blur(24px) saturate(165%)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.28), inset 0 -1px 0 rgba(0,0,0,.28), inset 0 0 42px rgba(255,255,255,.025), 0 18px 55px -22px rgba(0,0,0,.98), 0 8px 28px -16px rgba(200,179,138,.18)" }}>
        <div className="relative flex items-stretch gap-1 px-2 pt-2">
          <span aria-hidden className="pointer-events-none absolute inset-x-10 top-0 h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,.42), transparent)" }} />
          {tabs.map((t) => {
            const isActive = pathname === t.to || (t.to !== "/" && pathname.startsWith(t.to));
            const Icon = t.icon;
            return <Link key={t.to} to={t.to} className="pressable relative flex min-w-0 flex-1 flex-col items-center justify-center gap-[4px] rounded-[18px] py-2" style={{ color: isActive ? "var(--gold)" : "#85858B" }}>
              <span aria-hidden className="absolute inset-0 rounded-[18px] transition-all duration-300" style={{ background: "linear-gradient(145deg, rgba(255,255,255,.105), rgba(200,179,138,.075) 55%, rgba(255,255,255,.018))", opacity: isActive ? 1 : 0, boxShadow: isActive ? "inset 0 1px 0 rgba(255,255,255,.18), inset 0 0 18px rgba(200,179,138,.035), 0 0 22px -14px rgba(200,179,138,.75)" : "none" }} />
              <Icon className="relative h-[19px] w-[19px]" strokeWidth={isActive ? 2.1 : 1.6} />
              <span className="relative text-[10px] font-semibold" style={{ letterSpacing: "0.04em", opacity: isActive ? 1 : 0.82 }}>{t.label}</span>
            </Link>;
          })}
          <button onClick={onToggleMore} aria-label="Más secciones" className="pressable relative flex min-w-0 flex-1 flex-col items-center justify-center gap-[4px] rounded-[18px] py-2" style={{ color: moreActive || moreOpen ? "var(--gold)" : "#85858B" }}>
            <span aria-hidden className="absolute inset-0 rounded-[18px] transition-all duration-300" style={{ background: "linear-gradient(145deg, rgba(255,255,255,.105), rgba(200,179,138,.075))", opacity: moreActive || moreOpen ? 1 : 0, boxShadow: moreActive || moreOpen ? "inset 0 1px 0 rgba(255,255,255,.18), 0 0 22px -14px rgba(200,179,138,.75)" : "none" }} />
            <MoreHorizontal className="relative h-[19px] w-[19px]" strokeWidth={moreActive || moreOpen ? 2.1 : 1.6} />
            {chatUnread > 0 && <span aria-hidden className="absolute right-[24%] top-[4px] grid h-4 min-w-4 place-items-center rounded-full px-1 text-[9px] font-bold gold-gradient" style={{ color: "var(--gold-foreground)" }}>{chatUnread > 9 ? "9+" : chatUnread}</span>}
            <span className="relative text-[10px] font-semibold" style={{ letterSpacing: "0.04em", opacity: moreActive || moreOpen ? 1 : 0.82 }}>Más</span>
          </button>
        </div>
      </div>
    </nav>
  );
});

export function AppShell({ children, hideBottomNav = false }: AppShellProps) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [active, setActive] = useState<ActiveWorkout | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const keyboardOpen = hideBottomNav;
  const chatUnread = useChatUnread(!pathname.startsWith("/chat"));
  const currentProfileId = getCurrentUserId();
  const { data: profiles = [] } = useProfiles();
  const currentProfile = profiles.find((profile) => profile.id === currentProfileId);
  const isBcProfile = currentProfile?.name.trim().toLowerCase() === "bc";
  const { data: isAdmin } = useQuery({
    queryKey: ["video-admin", currentProfileId],
    queryFn: isVideoAdmin,
    enabled: !!currentProfileId && moreOpen,
    staleTime: 5 * 60 * 1000,
  });
  const visibleMoreLinks = useMemo(
    () => isBcProfile || isAdmin ? [...moreLinks, { to: "/admin/videos", label: "Administración", hint: "Gestionar vídeos", icon: Film }] : moreLinks,
    [isAdmin, isBcProfile],
  );

  useEffect(() => {
    const read = () => setActive(getActiveWorkout());
    read();
    window.addEventListener("rmordie:active-workout", read);
    window.addEventListener("focus", read);
    return () => {
      window.removeEventListener("rmordie:active-workout", read);
      window.removeEventListener("focus", read);
    };
  }, []);

  useEffect(() => { setMoreOpen(false); setProfileOpen(false); }, [pathname]);

  const activePath = active ? `/workout/${active.month}/${active.week}/${active.day}` : null;
  const showResume = !!active && pathname !== activePath;
  const moreActive = visibleMoreLinks.some((l) => pathname.startsWith(l.to));

  return (
    <div className={"grain relative min-h-[100dvh] overflow-x-hidden " + (keyboardOpen ? "pb-0" : "pb-[calc(88px+env(safe-area-inset-bottom))]")}>
      <div aria-hidden className="aura pointer-events-none absolute inset-x-0 top-0 h-[520px]" />
      <div aria-hidden className="pointer-events-none absolute -left-32 top-28 h-80 w-80 rounded-full bg-[radial-gradient(circle,rgba(200,179,138,.09),transparent_68%)] blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -right-36 top-[34rem] h-96 w-96 rounded-full bg-[radial-gradient(circle,rgba(150,160,180,.07),transparent_68%)] blur-3xl" />
      <div
        aria-hidden
        className="dotgrid pointer-events-none absolute inset-x-0 top-0 h-[420px] opacity-25"
        style={{ maskImage: "linear-gradient(#000, transparent)", WebkitMaskImage: "linear-gradient(#000, transparent)" }}
      />

      <main
        className="relative mx-auto w-full min-w-0 max-w-2xl"
        style={{
          paddingLeft: "max(env(safe-area-inset-left), 1.25rem)",
          paddingRight: "max(env(safe-area-inset-right), 1.25rem)",
          paddingTop: "calc(env(safe-area-inset-top) + 2rem)",
        }}
      >
        <header className="mb-5 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setProfileOpen((v) => !v)}
            aria-expanded={profileOpen}
            className="pressable flex items-center gap-2 rounded-full px-1 py-1 text-left"
          >
            <span className="eyebrow tracking-[0.34em] text-gold/90">RM / OR DIE</span>
            <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${profileOpen ? "rotate-180" : ""}`} />
          </button>
          <SyncIndicator />
        </header>
        {children}
      </main>

      {showResume && active && <ResumeWorkout active={active} onDismiss={dismissActiveWorkout} />}

      {profileOpen && (
        <div className="fixed inset-0" style={{ zIndex: 2147482999 }}>
          <button aria-label="Cerrar perfil" onClick={() => setProfileOpen(false)} className="absolute inset-0 bg-black/55 backdrop-blur-[5px]" />
          <div className="glass-elevated glass-sheen animate-fade absolute left-4 right-4 top-[calc(env(safe-area-inset-top)+4.75rem)] mx-auto max-w-sm rounded-[26px] p-3">
            <div className="mb-2 rounded-[18px] border border-white/8 bg-white/[0.025] px-3 py-3"><p className="eyebrow">Perfil activo</p><p className="mt-1 text-base font-semibold">{currentProfile?.name ?? "Atleta"}</p></div>
            <div className="space-y-1.5">
              {[{ to: "/profile", label: "Mi perfil", hint: "Progreso y datos del atleta", icon: User }, { to: "/athlete-report", label: "Informe para entrenador", hint: "Generar informe completo", icon: FileText }, { to: "/health", label: "Salud", hint: "Datos de recuperación", icon: HeartPulse }, { to: "/settings", label: "Ajustes", hint: "Discos, barras y configuración", icon: Settings }].map((item) => { const Icon=item.icon; return <Link key={item.to} to={item.to as any} className="pressable flex items-center gap-3 rounded-[16px] bg-white/[0.035] px-3 py-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-[12px] border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)]"><Icon className="h-4 w-4" strokeWidth={1.7} /></span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{item.label}</span><span className="block truncate text-xs text-muted-foreground">{item.hint}</span></span><ChevronRight className="h-4 w-4 text-muted-foreground" /></Link>; })}
              <button type="button" onClick={() => { setProfileOpen(false); signOut(); window.location.assign("/"); }} className="pressable mt-1 flex w-full items-center gap-3 rounded-[16px] bg-white/[0.025] px-3 py-3 text-left"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-[12px] border border-red-400/15 bg-red-400/5"><LogOut className="h-4 w-4 text-red-300" /></span><span className="text-sm font-semibold text-red-200">Cerrar sesión</span></button>
            </div>
          </div>
        </div>
      )}

      {moreOpen && (
        <div className="fixed inset-0 flex items-end" style={{ zIndex: 2147483001 }}>
          <button aria-label="Cerrar menú" onClick={() => setMoreOpen(false)} className="absolute inset-0 bg-black/60 backdrop-blur-[6px]" />
          <div className="glass-elevated glass-sheen animate-fade relative mx-3 mb-[96px] max-w-2xl flex-1 rounded-[28px] p-3 sm:mx-auto"><p className="eyebrow px-2 pb-2 pt-1">Más</p><div className="space-y-1.5">
            {visibleMoreLinks.map((l) => { const Icon=l.icon; const isActive=pathname.startsWith(l.to); return <Link key={l.to} to={l.to as any} className="pressable flex items-center gap-3.5 rounded-[var(--r-md)] px-3 py-3" style={{ background: isActive ? "rgba(200,179,138,0.09)" : "rgba(255,255,255,0.035)" }}><span className="grid h-10 w-10 shrink-0 place-items-center rounded-[14px] border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)]"><Icon className="h-[18px] w-[18px]" strokeWidth={1.7} /></span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{l.label}</span><span className="block truncate text-xs text-muted-foreground">{l.hint}</span></span>{l.to === "/chat" && chatUnread > 0 && <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full px-1.5 text-[10px] font-bold gold-gradient" style={{ color: "var(--gold-foreground)" }}>{chatUnread > 99 ? "99+" : chatUnread}</span>}<ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" /></Link>; })}
          </div></div>
        </div>
      )}

      <BottomNavigation pathname={pathname} keyboardOpen={keyboardOpen} moreOpen={moreOpen} moreActive={moreActive} chatUnread={chatUnread} onToggleMore={toggleMore} />
    </div>
  );
}
