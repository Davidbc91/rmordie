import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Lock } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PostCard, Avatar } from "@/components/social/PostCard";
import { getCurrentUserId } from "@/lib/pin-gate";
import {
  useSocialProfileByUsername,
  usePostsByUser,
  useFollowCounts,
  useFollowingIds,
  useToggleFollow,
  usePrBoard,
} from "@/lib/social";

export const Route = createFileRoute("/social/u/$username")({
  head: ({ params }) => ({
    meta: [
      { title: `@${params.username} — RM OR DIE` },
      { name: "description", content: `Perfil de atleta @${params.username} en RM OR DIE: entrenos, récords personales y progresión.` },
      { property: "og:title", content: `@${params.username} en RM OR DIE` },
      { property: "og:description", content: "Perfil público de atleta: PRs, WODs y actividad." },
    ],
  }),
  component: PublicProfile,
});

function PublicProfile() {
  const { username } = Route.useParams();
  const uid = getCurrentUserId();
  const { data: profile, isLoading } = useSocialProfileByUsername(username);
  const { data: posts = [] } = usePostsByUser(profile?.user_id);
  const { data: counts } = useFollowCounts(profile?.user_id);
  const { data: followingIds = [] } = useFollowingIds();
  const { data: prBoard = [] } = usePrBoard();
  const toggleFollow = useToggleFollow();
  const [tab, setTab] = useState<"posts" | "prs">("posts");

  if (isLoading) return <AppShell><p className="text-sm text-muted-foreground">Cargando perfil…</p></AppShell>;
  if (!profile)
    return (
      <AppShell>
        <p className="text-sm text-muted-foreground">No existe el atleta @{username}.</p>
      </AppShell>
    );

  const isMe = profile.user_id === uid;
  const following = followingIds.includes(profile.user_id);
  const locked = profile.is_private && !isMe && !following;
  const prs = prBoard.filter((r) => r.user_id === profile.user_id).sort((a, b) => a.exercise.localeCompare(b.exercise));

  return (
    <AppShell>
      <header className="rise rise-1 mb-6">
        <Link to="/social" className="mb-4 inline-flex items-center gap-2 text-xs text-muted-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Social
        </Link>
        <div className="flex items-center gap-4">
          <Avatar profile={profile} size={68} />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-semibold">{profile.display_name || profile.username}</h1>
            <p className="truncate text-xs text-muted-foreground">
              @{profile.username}
              {profile.box_name ? ` · ${profile.box_name}` : ""}
              {profile.level ? ` · ${profile.level}` : ""}
            </p>
          </div>
        </div>
        {profile.bio && <p className="mt-3 whitespace-pre-wrap text-sm">{profile.bio}</p>}

        <div className="mt-4 flex gap-6">
          <Metric label="Posts" value={posts.length} />
          <Metric label="Seguidores" value={counts?.followers ?? 0} />
          <Metric label="Siguiendo" value={counts?.following ?? 0} />
        </div>

        {!isMe && (
          <button
            onClick={() => toggleFollow.mutate({ targetId: profile.user_id, following })}
            className="pressable mt-5 w-full rounded-[18px] py-3 text-sm font-semibold"
            style={following ? { background: "#181818", color: "#FFF" } : { background: "#FFFFFF", color: "#000" }}
          >
            {following ? "Siguiendo" : "Seguir"}
          </button>
        )}
        {isMe && (
          <Link to="/social/settings" className="pressable mt-5 block rounded-[18px] border py-3 text-center text-sm font-semibold" style={{ borderColor: "#242424" }}>
            Editar perfil
          </Link>
        )}
        <div className="rule-fade mt-6" />
      </header>

      {locked ? (
        <div className="flex flex-col items-center gap-3 rounded-[20px] border p-8 text-center" style={{ borderColor: "#1C1C1C" }}>
          <Lock className="h-5 w-5 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Este perfil es privado. Síguelo para ver su actividad.</p>
        </div>
      ) : (
        <>
          <div className="mb-4 flex gap-2">
            {(["posts", "prs"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="rounded-full px-3.5 py-2 text-xs"
                style={tab === t ? { background: "#FFFFFF", color: "#000" } : { background: "#181818", color: "#9A9A9A" }}
              >
                {t === "posts" ? "Publicaciones" : "PRs"}
              </button>
            ))}
          </div>

          {tab === "posts" ? (
            <div className="space-y-3">
              {posts.map((p) => (
                <PostCard key={p.id} post={p} />
              ))}
              {posts.length === 0 && <p className="text-sm text-muted-foreground">Sin publicaciones todavía.</p>}
            </div>
          ) : profile.show_prs ? (
            <div className="space-y-2">
              {prs.map((r) => (
                <div key={`${r.exercise}-${r.rep_max}`} className="flex items-center justify-between rounded-[18px] border p-4" style={{ borderColor: "#1A1A1A", background: "#111" }}>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{r.exercise}</p>
                    <p className="text-[11px] text-muted-foreground">{r.rep_max}RM</p>
                  </div>
                  <p className="text-lg font-semibold tabular">
                    {r.weight}
                    <span className="text-xs"> kg</span>
                  </p>
                </div>
              ))}
              {prs.length === 0 && <p className="text-sm text-muted-foreground">Sin récords públicos.</p>}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Este atleta no comparte sus récords.</p>
          )}
        </>
      )}
    </AppShell>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-lg font-semibold tabular">{value}</p>
      <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
    </div>
  );
}
