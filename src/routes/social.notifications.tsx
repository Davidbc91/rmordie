import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { ArrowLeft, Heart, MessageCircle, UserPlus, Bell } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useNotifications, useMarkNotificationsRead, timeAgo } from "@/lib/social";

export const Route = createFileRoute("/social/notifications")({
  head: () => ({
    meta: [
      { title: "Notificaciones — RM OR DIE" },
      { name: "description", content: "Likes, comentarios y nuevos seguidores de tu actividad en la comunidad RM OR DIE." },
      { property: "og:title", content: "Tus notificaciones" },
      { property: "og:description", content: "Actividad reciente sobre tus publicaciones." },
    ],
  }),
  component: NotificationsPage,
});

const ICONS: Record<string, React.ReactNode> = {
  like: <Heart className="h-4 w-4" />,
  comment: <MessageCircle className="h-4 w-4" />,
  follow: <UserPlus className="h-4 w-4" />,
};

function NotificationsPage() {
  const { data: items = [], isLoading } = useNotifications();
  const markRead = useMarkNotificationsRead();

  useEffect(() => {
    if (items.some((n) => !n.is_read)) markRead.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);

  return (
    <AppShell>
      <header className="rise rise-1 mb-6">
        <Link to="/social" className="mb-4 inline-flex items-center gap-2 text-xs text-muted-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Social
        </Link>
        <h1 className="text-[2rem] font-semibold leading-none tracking-tight">Notificaciones</h1>
        <div className="rule-fade mt-6" />
      </header>

      {isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
      {!isLoading && items.length === 0 && (
        <p className="rounded-[20px] border p-6 text-center text-sm text-muted-foreground" style={{ borderColor: "#1C1C1C" }}>
          Sin novedades por ahora.
        </p>
      )}

      <div className="space-y-2">
        {items.map((n) => (
          <div
            key={n.id}
            className="flex items-center gap-3 rounded-[18px] border p-4"
            style={{ borderColor: n.is_read ? "#161616" : "#2E2E2E", background: n.is_read ? "#0D0D0D" : "#141414" }}
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full" style={{ background: "#1C1C1C" }}>
              {ICONS[n.kind] ?? <Bell className="h-4 w-4" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm">{n.message ?? "Nueva actividad"}</p>
              <p className="text-[11px] text-muted-foreground">{timeAgo(n.created_at)}</p>
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
