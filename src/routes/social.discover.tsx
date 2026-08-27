import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Search, ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PostCard, Avatar } from "@/components/social/PostCard";
import { useDiscover, useSearchPosts, useSearchProfiles, type SocialProfile } from "@/lib/social";

export const Route = createFileRoute("/social/discover")({
  head: () => ({
    meta: [
      { title: "Descubrir — RM OR DIE" },
      { name: "description", content: "Descubre atletas, PRs destacados, WODs y contenido en tendencia de la comunidad RM OR DIE." },
      { property: "og:title", content: "Descubrir atletas y WODs" },
      { property: "og:description", content: "Tendencias, PRs y benchmarks de la comunidad." },
    ],
  }),
  component: Discover,
});

function Discover() {
  const [term, setTerm] = useState("");
  const { data: discover } = useDiscover();
  const { data: profiles = [] } = useSearchProfiles(term);
  const { data: posts = [] } = useSearchPosts(term);
  const searching = term.trim().length > 0;

  return (
    <AppShell>
      <header className="rise rise-1 mb-6">
        <Link to="/social" className="mb-4 inline-flex items-center gap-2 text-xs text-muted-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Social
        </Link>
        <h1 className="text-[2rem] font-semibold leading-none tracking-tight">Descubrir</h1>
        <div className="mt-5 flex items-center gap-2 rounded-[16px] border px-3.5 py-3" style={{ borderColor: "#242424" }}>
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Atletas, box, #hashtag, ejercicio"
            className="w-full bg-transparent text-sm outline-none"
          />
        </div>
      </header>

      {searching ? (
        <div className="space-y-6">
          {profiles.length > 0 && (
            <Section title="Atletas">
              <div className="space-y-2">
                {profiles.map((p) => (
                  <AthleteRow key={p.id} p={p} />
                ))}
              </div>
            </Section>
          )}
          <Section title="Publicaciones">
            <div className="space-y-3">
              {posts.map((p) => (
                <PostCard key={p.id} post={p} />
              ))}
              {posts.length === 0 && <p className="text-sm text-muted-foreground">Sin resultados.</p>}
            </div>
          </Section>
        </div>
      ) : (
        <div className="space-y-8">
          {!!discover?.newAthletes.length && (
            <Section title="Nuevos atletas">
              <div className="no-scrollbar flex gap-3 overflow-x-auto pb-1">
                {discover.newAthletes.map((p) => (
                  <Link
                    key={p.id}
                    to="/social/u/$username"
                    params={{ username: p.username }}
                    className="w-28 shrink-0 rounded-[18px] border p-3 text-center"
                    style={{ borderColor: "#1F1F1F", background: "#111" }}
                  >
                    <div className="flex justify-center">
                      <Avatar profile={p} size={44} />
                    </div>
                    <p className="mt-2 truncate text-xs font-semibold">{p.display_name || p.username}</p>
                    <p className="truncate text-[10px] text-muted-foreground">{p.box_name || `@${p.username}`}</p>
                  </Link>
                ))}
              </div>
            </Section>
          )}
          {!!discover?.trending.length && (
            <Section title="En tendencia">
              <div className="space-y-3">
                {discover.trending.map((p) => (
                  <PostCard key={p.id} post={p} />
                ))}
              </div>
            </Section>
          )}
          {!!discover?.prs.length && (
            <Section title="PRs recientes">
              <div className="space-y-3">
                {discover.prs.map((p) => (
                  <PostCard key={p.id} post={p} />
                ))}
              </div>
            </Section>
          )}
          {!!discover?.wods.length && (
            <Section title="WODs y benchmarks">
              <div className="space-y-3">
                {discover.wods.map((p) => (
                  <PostCard key={p.id} post={p} />
                ))}
              </div>
            </Section>
          )}
        </div>
      )}
    </AppShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="eyebrow mb-3">{title}</h2>
      {children}
    </section>
  );
}

function AthleteRow({ p }: { p: SocialProfile }) {
  return (
    <Link
      to="/social/u/$username"
      params={{ username: p.username }}
      className="flex items-center gap-3 rounded-[18px] border p-3"
      style={{ borderColor: "#1F1F1F", background: "#111" }}
    >
      <Avatar profile={p} />
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{p.display_name || p.username}</p>
        <p className="truncate text-[11px] text-muted-foreground">@{p.username}{p.box_name ? ` · ${p.box_name}` : ""}</p>
      </div>
    </Link>
  );
}
