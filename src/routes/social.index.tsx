import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Compass, Bell, Trophy, Settings2, Plus, Bookmark } from "lucide-react";
import { PostCard } from "@/components/social/PostCard";
import { Composer } from "@/components/social/Composer";
import { useFeed, useNotifications, useMySocialProfile, useSavedPosts, type FeedTab } from "@/lib/social";

export const Route = createFileRoute("/social/")({
  head: () => ({
    meta: [
      { title: "Comunidad — RM OR DIE" },
      { name: "description", content: "Feed de la comunidad RM OR DIE: entrenos, PRs, WODs y progresión de atletas de CrossFit." },
      { property: "og:title", content: "Comunidad RM OR DIE" },
      { property: "og:description", content: "Entrenos, PRs y benchmarks compartidos por la comunidad." },
    ],
  }),
  component: SocialFeed,
});

const TABS: Array<{ id: FeedTab | "saved"; label: string }> = [
  { id: "foryou", label: "Para ti" },
  { id: "following", label: "Siguiendo" },
  { id: "recent", label: "Reciente" },
  { id: "saved", label: "Guardados" },
];

function SocialFeed() {
  const [tab, setTab] = useState<FeedTab | "saved">("foryou");
  const { data: profile } = useMySocialProfile();
  const { data: posts = [], isLoading } = useFeed(tab === "saved" ? "recent" : tab);
  const { data: saved = [] } = useSavedPosts();
  const { data: notifications = [] } = useNotifications();
  const unread = notifications.filter((n) => !n.is_read).length;
  const [composing, setComposing] = useState(false);

  const list = tab === "saved" ? saved : posts;

  return (
    <>
      <header className="rise rise-1 mb-4 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow">Comunidad</p>
          <h1 className="page-title mt-1">Social</h1>
        </div>
        <div className="flex shrink-0 gap-1.5">
          <IconLink to="/social/discover" label="Descubrir atletas" icon={<Compass className="h-5 w-5" />} />
          <IconLink to="/social/notifications" label="Avisos" icon={<Bell className="h-5 w-5" />} badge={unread} />
          <IconLink to="/social/board" label="Tablón de récords" icon={<Trophy className="h-5 w-5" />} />
          <IconLink to="/social/settings" label="Tu perfil social" icon={<Settings2 className="h-5 w-5" />} />
        </div>
      </header>

      {!profile && (
        <Link to="/social/settings" className="rise rise-2 mb-4 block rounded-[18px] border border-[color:var(--gold)]/30 bg-[color:var(--gold)]/8 p-4 text-[15px]">
          Crea tu perfil social para publicar y seguir a otros atletas →
        </Link>
      )}

      <div role="tablist" aria-label="Publicaciones" className="mb-4 flex gap-1 rounded-[14px] bg-white/[0.06] p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`min-h-10 min-w-0 flex-1 truncate rounded-[10px] px-1 text-sm ${tab === t.id ? "bg-[color:var(--gold)] font-bold text-[color:var(--gold-foreground)]" : "font-semibold text-muted-foreground"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {isLoading && <p className="text-sm text-muted-foreground">Cargando publicaciones…</p>}
        {!isLoading && list.length === 0 && (
          <p className="rounded-[20px] bg-white/[0.04] p-6 text-center text-[15px] text-muted-foreground">
            Todavía no hay publicaciones aquí.
          </p>
        )}
        {list.map((p) => (
          <PostCard key={p.id} post={p} />
        ))}
      </div>

      <button
        aria-label="Crear publicación"
        onClick={() => setComposing(true)}
        className="pressable gold-gradient fixed right-4 z-40 flex h-14 items-center gap-1.5 rounded-full px-5 text-[22px] font-extrabold"
        style={{ bottom: "calc(max(env(safe-area-inset-bottom), 12px) + 92px)", fontFamily: "var(--font-editorial)", boxShadow: "0 10px 30px rgba(0,0,0,0.6)" }}
      >
        <Plus className="h-5 w-5" strokeWidth={3} /> PUBLICAR
      </button>

      {composing && <Composer onClose={() => setComposing(false)} />}
    </>
  );
}

function IconLink({ to, label, icon, badge }: { to: string; label: string; icon: React.ReactNode; badge?: number }) {
  return (
    <Link
      to={to}
      aria-label={badge ? `${label}, ${badge} sin leer` : label}
      className="pressable relative grid h-11 w-11 place-items-center rounded-full bg-white/[0.06]"
    >
      {icon}
      {!!badge && (
        <span aria-hidden className="gold-gradient absolute -right-0.5 -top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full px-1 text-[11px] font-extrabold">
          {badge > 9 ? "9+" : badge}
        </span>
      )}
    </Link>
  );
}
