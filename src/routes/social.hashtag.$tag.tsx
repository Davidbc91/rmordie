import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PostCard } from "@/components/social/PostCard";
import { usePostsByHashtag } from "@/lib/social";

export const Route = createFileRoute("/social/hashtag/$tag")({
  head: ({ params }) => ({
    meta: [
      { title: `#${params.tag} — RM OR DIE` },
      { name: "description", content: `Publicaciones de la comunidad RM OR DIE etiquetadas con #${params.tag}.` },
      { property: "og:title", content: `#${params.tag} en RM OR DIE` },
      { property: "og:description", content: "Entrenos y PRs con este hashtag." },
    ],
  }),
  component: HashtagFeed,
});

function HashtagFeed() {
  const { tag } = Route.useParams();
  const { data: posts = [], isLoading } = usePostsByHashtag(tag);

  return (
    <AppShell>
      <header className="rise rise-1 mb-6">
        <Link to="/social" className="mb-4 inline-flex items-center gap-2 text-xs text-muted-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Social
        </Link>
        <h1 className="text-[2rem] font-semibold leading-none tracking-tight">#{tag}</h1>
        <div className="rule-fade mt-6" />
      </header>

      {isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
      <div className="space-y-3">
        {posts.map((p) => (
          <PostCard key={p.id} post={p} />
        ))}
        {!isLoading && posts.length === 0 && (
          <p className="rounded-[20px] border p-6 text-center text-sm text-muted-foreground" style={{ borderColor: "#1C1C1C" }}>
            Sin publicaciones con este hashtag.
          </p>
        )}
      </div>
    </AppShell>
  );
}
