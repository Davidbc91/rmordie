import { Link, useRouterState } from "@tanstack/react-router";
import {
  Home, Calendar, Trophy, Timer, MessageCircle, Upload, Settings, User, Play, X, Users, ChevronRight, BookOpen, Film, FileText, HeartPulse, LogOut,
} from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getActiveWorkout, clearActiveWorkout, type ActiveWorkout } from "@/lib/active-workout";
import { useChatUnread } from "@/lib/chat-unread";
import { SyncIndicator } from "@/components/SyncIndicator";
import { getCurrentUserId, signOut } from "@/lib/pin-gate";
import { isVideoAdmin } from "@/lib/admin-videos";
import { useProfiles } from "@/lib/store";

// El Temporizador va en el centro, destacado.
const tabs = [
  { to: "/", label: "Inicio", icon: Home },
  { to: "/calendar", label: "Plan", icon: Calendar },
  { to: "/timers", label: "Timer", icon: Timer, center: true },
  { to: "/records", label: "Récords", icon: Trophy },
  { to: "/social", label: "Social", icon: Users },
];

// Todo lo que antes estaba en «Más» vive ahora en el menú del perfil (círculo de arriba a la derecha).
const profileLinks = [
  { to: "/profile", label: "Mi perfil y progreso", hint: "Progreso y datos del atleta", icon: User },
  { to: "/chat", label: "Chat", hint: "Conversación del box", icon: MessageCircle },
  { to: "/dictionary", label: "Diccionario de movimientos", hint: "Movimientos CrossFit", icon: BookOpen },
  { to: "/import", label: "Importar planificación", hint: "Excel, PDF o foto", icon: Upload },
  { to: "/athlete-report", label: "Informe para entrenador", hint: "Generar informe completo", icon: FileText },
  { to: "/health", label: "Salud", hint: "Datos de recuperación", icon: HeartPulse },
  { to: "/settings", label: "Ajustes", hint: "Discos, barras y contraseña", icon: Settings },
];

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

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

const BottomNavigation = memo(function BottomNavigation({ pathname, keyboardOpen }: { pathname: string; keyboardOpen: boolean }) {
  return (
    <nav aria-hidden={keyboardOpen} aria-label="Navegación principal" data-main-navigation className={"pointer-events-none fixed inset-x-0 bottom-0 px-0 transition-opacity duration-150 " + (keyboardOpen ? "pointer-events-none opacity-0" : "opacity-100")} style={{ zIndex: 50, bottom: "max(env(safe-area-inset-bottom), 12px)", transform: "translateZ(0)" }}>
      <div className="pointer-events-auto mx-auto w-[calc(100vw-32px)] max-w-[380px] rounded-[26px] border" style={{ background: "rgba(14,14,13,.92)", borderColor: "rgba(255,255,255,0.14)", backdropFilter: "blur(24px) saturate(160%)", WebkitBackdropFilter: "blur(24px) saturate(160%)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.12), 0 18px 55px -22px rgba(0,0,0,.98)" }}>
        <div className="relative flex items-stretch gap-0.5 px-1.5 pt-1.5">
          {tabs.map((t) => {
            const isActive = pathname === t.to || (t.to !== "/" && pathname.startsWith(t.to));
            const Icon = t.icon;
            if (t.center) {
              return <Link key={t.to} to={t.to} aria-label="Temporizador" className="pressable relative flex min-w-0 flex-1 flex-col items-center justify-end gap-[3px] pb-2">
                <span className="gold-gradient -mt-6 grid h-[54px] w-[54px] place-items-center rounded-full" style={{ boxShadow: "0 10px 26px -8px rgba(0,0,0,.9), 0 0 0 4px rgba(8,8,7,.9)" }}>
                  <Icon className="h-6 w-6" strokeWidth={2.2} style={{ color: "var(--gold-foreground)" }} />
                </span>
                <span className="text-xs font-bold" style={{ color: "var(--gold-soft)" }}>{t.label}</span>
              </Link>;
            }
            return <Link key={t.to} to={t.to} className="pressable relative flex min-h-[56px] min-w-0 flex-1 flex-col items-center justify-center gap-[4px] rounded-[18px] py-2" style={{ color: isActive ? "var(--gold)" : "var(--muted-foreground)" }}>
              <span aria-hidden className="absolute inset-0 rounded-[18px] transition-opacity duration-300" style={{ background: "rgba(200,179,138,.10)", opacity: isActive ? 1 : 0 }} />
              <Icon className="relative h-[20px] w-[20px]" strokeWidth={isActive ? 2.1 : 1.7} />
              <span className="relative text-xs font-semibold">{t.label}</span>
            </Link>;
          })}
        </div>
      </div>
    </nav>
  );
});

const ProfileOverlay = memo(function ProfileOverlay({ name, links, chatUnread, onClose, onSignOut }: { name: string; links: typeof profileLinks; chatUnread: number; onClose: () => void; onSignOut: () => void }) {
  return (
    <div className="fixed inset-0 flex items-end" style={{ zIndex: 60 }}>
      <button aria-label="Cerrar menú del perfil" onClick={onClose} className="absolute inset-0 bg-black/60 backdrop-blur-[6px]" />
      <div role="dialog" aria-label="Menú del perfil" className="animate-fade relative mx-auto max-h-[85dvh] w-full max-w-2xl overflow-y-auto overscroll-contain rounded-t-[28px] border-t border-white/10 bg-[#141412] px-4 pt-3" style={{ paddingBottom: "max(env(safe-area-inset-bottom), 16px)" }}>
        <div aria-hidden className="mx-auto mb-3 h-[5px] w-10 rounded-full bg-white/20" />
        <div className="mb-3 flex items-center gap-3 px-1">
          <span className="grid h-[52px] w-[52px] shrink-0 place-items-center rounded-full border border-[color:var(--gold)]/50 bg-[color:var(--gold)]/12 text-[22px] font-extrabold text-[color:var(--gold-soft)]" style={{ fontFamily: "var(--font-editorial)" }}>{initials(name)}</span>
          <span className="min-w-0 flex-1"><span className="block truncate text-[17px] font-bold">{name}</span><span className="block text-[13px] text-muted-foreground">Perfil activo</span></span>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="tap grid place-items-center rounded-full text-muted-foreground"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-1.5">
          {links.map((item) => { const Icon = item.icon; return <Link key={item.to} to={item.to as any} className="pressable flex min-h-[56px] items-center gap-3 rounded-[16px] bg-white/[0.05] px-3"><Icon className="h-[19px] w-[19px] shrink-0 text-muted-foreground" strokeWidth={1.8} /><span className="min-w-0 flex-1 text-[15px] font-semibold">{item.label}</span>{item.to === "/chat" && chatUnread > 0 && <span className="grid h-6 min-w-6 shrink-0 place-items-center rounded-full px-1.5 text-xs font-bold gold-gradient" style={{ color: "var(--gold-foreground)" }}>{chatUnread > 99 ? "99+" : chatUnread}</span>}<ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" /></Link>; })}
        </div>
        <button type="button" onClick={onSignOut} className="mt-2 flex min-h-11 w-full items-center gap-2 px-3 text-left text-sm text-muted-foreground"><LogOut className="h-4 w-4" />Cerrar sesión</button>
      </div>
    </div>
  );
});

export function AppShell({ children, hideBottomNav = false }: AppShellProps) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [active, setActive] = useState<ActiveWorkout | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const keyboardOpen = hideBottomNav;
  const chatUnread = useChatUnread(!pathname.startsWith("/chat"));
  const currentProfileId = getCurrentUserId();
  const { data: profiles = [] } = useProfiles();
  const currentProfile = profiles.find((profile) => profile.id === currentProfileId);
  const { data: isAdmin } = useQuery({
    queryKey: ["video-admin", currentProfileId],
    queryFn: isVideoAdmin,
    // El administrador es el perfil guardado en video_admins, nunca un nombre.
    enabled: !!currentProfileId,
    staleTime: 5 * 60 * 1000,
  });
  const visibleProfileLinks = useMemo(
    () => isAdmin ? [...profileLinks, { to: "/admin/videos", label: "Administración de vídeos", hint: "Gestionar vídeos", icon: Film }] : profileLinks,
    [isAdmin],
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

  useEffect(() => { setProfileOpen(false); }, [pathname]);

  const dismissActiveWorkout = useCallback(() => { clearActiveWorkout(); setActive(null); }, []);
  const closeProfile = useCallback(() => setProfileOpen(false), []);
  const signOutProfile = useCallback(async () => { setProfileOpen(false); await signOut(); window.location.assign("/"); }, []);

  const activePath = active ? `/workout/${active.month}/${active.week}/${active.day}` : null;
  const showResume = !!active && pathname !== activePath;

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
          <span className="text-[24px] font-extrabold leading-none" style={{ fontFamily: "var(--font-editorial)" }}>RM <span className="text-gold">OR</span> DIE</span>
          <SyncIndicator />
          <button
            type="button"
            onClick={() => setProfileOpen((v) => !v)}
            aria-expanded={profileOpen}
            aria-label="Abrir tu perfil y el menú"
            className="pressable relative grid h-11 w-11 place-items-center rounded-full border-[1.5px] border-[color:var(--gold)] bg-[color:var(--gold)]/12 text-[19px] font-extrabold text-[color:var(--gold-soft)]"
            style={{ fontFamily: "var(--font-editorial)" }}
          >
            {initials(currentProfile?.name ?? "Atleta")}
            {chatUnread > 0 && <span aria-label={`${chatUnread} mensajes sin leer`} className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full px-1 text-[11px] font-bold gold-gradient" style={{ color: "var(--gold-foreground)", fontFamily: "var(--font-display)" }}>{chatUnread > 9 ? "9+" : chatUnread}</span>}
          </button>
        </header>
        {children}
      </main>

      {showResume && active && <ResumeWorkout active={active} onDismiss={dismissActiveWorkout} />}

      {profileOpen && <ProfileOverlay name={currentProfile?.name ?? "Atleta"} links={visibleProfileLinks as typeof profileLinks} chatUnread={chatUnread} onClose={closeProfile} onSignOut={signOutProfile} />}

      <BottomNavigation pathname={pathname} keyboardOpen={keyboardOpen} />
    </div>
  );
}
