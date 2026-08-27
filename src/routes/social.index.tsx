import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Compass, Bell, Trophy, Settings2, Plus, Bookmark } from "lucide-react";
import { AppShell } from "@/components/AppShell";
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
    <AppShell>
      <header className="rise rise-1 mb-6">
        <p className="eyebrow">Comunidad</p>
        <h1 className="mt-3 text-[2.2rem] font-semibold leading-[0.95] tracking-tight">Social</h1>
        <div className="mt-5 flex gap-2">
          <IconLink to="/social/discover" label="Descubrir" icon={<Compass className="h-4 w-4" />} />
          <IconLink to="/social/notifications" label="Avisos" icon={<Bell className="h-4 w-4" />} badge={unread} />
          <IconLink to="/social/board" label="PR Board" icon={<Trophy className="h-4 w-4" />} />
          <IconLink to="/social/settings" label="Perfil" icon={<Settings2 className="h-4 w-4" />} />
        </div>
        <div className="rule-fade mt-6" />
      </header>

      {!profile && (
        <Link to="/social/settings" className="rise rise-2 mb-5 block rounded-[20px] border p-4 text-sm" style={{ borderColor: "#242424", background: "#111" }}>
          Crea tu perfil social para publicar y seguir a otros atletas →
        </Link>
      )}

      <div className="no-scrollbar mb-4 flex gap-2 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="shrink-0 rounded-full px-3.5 py-2 text-xs"
            style={tab === t.id ? { background: "#FFFFFF", color: "#000" } : { background: "#181818", color: "#9A9A9A" }}
          >
            {t.id === "saved" ? <Bookmark className="mr-1 inline h-3 w-3" /> : null}
            {t.label}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {isLoading && <p className="text-sm text-muted-foreground">Cargando feed…</p>}
        {!isLoading && list.length === 0 && (
          <p className="rounded-[20px] border p-6 text-center text-sm text-muted-foreground" style={{ borderColor: "#1C1C1C" }}>
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
        className="pressable fixed bottom-[92px] right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full"
        style={{ background: "#FFFFFF", color: "#000", boxShadow: "0 10px 30px rgba(0,0,0,0.6)" }}
      >
        <Plus className="h-6 w-6" />
      </button>

      {composing && <Composer onClose={() => setComposing(false)} />}
    </AppShell>
  );
}

function IconLink({ to, label, icon, badge }: { to: string; label: string; icon: React.ReactNode; badge?: number }) {
  return (
    <Link
      to={to}
      className="pressable relative flex flex-1 flex-col items-center gap-1.5 rounded-[16px] border py-3 text-[10px] uppercase tracking-[0.14em]"
      style={{ borderColor: "#1F1F1F", background: "#111" }}
    >
      {icon}
      {label}
      {!!badge && (
        <span className="absolute right-2 top-2 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px]" style={{ background: "#FFF", color: "#000" }}>
          {badge}
        </span>
      )}
    </Link>
  );
}
