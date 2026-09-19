import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Heart, MessageCircle, Bookmark, MoreHorizontal, Trash2, Flag, Ban, Send } from "lucide-react";
import { toast } from "sonner";
import { getCurrentUserId } from "@/lib/pin-gate";
import {
  timeAgo,
  fmtTime,
  useToggleLike,
  useToggleSave,
  useMyLikes,
  useMySaves,
  useComments,
  useAddComment,
  useDeleteComment,
  useDeletePost,
  useReport,
  useToggleBlock,
  type Post,
  type SocialProfile,
} from "@/lib/social";

const KIND_LABEL: Record<string, string> = {
  workout: "Entreno",
  pr: "Nuevo PR",
  wod: "WOD",
  benchmark: "Benchmark",
  progress: "Progreso",
  media: "Media",
  text: "Nota",
};

export function Avatar({ profile, size = 38 }: { profile?: SocialProfile | null; size?: number }) {
  const initials = (profile?.display_name || profile?.username || "?").slice(0, 2).toUpperCase();
  return (
    <span
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full"
      style={{ width: size, height: size, background: "#1C1C1C", border: "1px solid #262626" }}
    >
      {profile?.avatar_url ? (
        <img src={profile.avatar_url} alt={profile.username} className="h-full w-full object-cover" />
      ) : (
        <span className="text-[11px] font-semibold tracking-wide text-white/70">{initials}</span>
      )}
    </span>
  );
}

function DataBlock({ post }: { post: Post }) {
  const d = post.data || {};
  if (post.kind === "pr") {
    return (
      <div className="mt-3 rounded-[18px] p-4" style={{ background: "linear-gradient(140deg,#EBD6A6,#D8B46B)", color: "#0A0A0B" }}>
        <p className="text-[10px] uppercase tracking-[0.3em]" style={{ color: "#6F6F6F" }}>
          {d.rep_max ? `${d.rep_max}RM` : "PR"}
        </p>
        <p className="mt-2 text-sm font-semibold uppercase tracking-[0.1em]">{d.exercise ?? "Ejercicio"}</p>
        <p className="mt-1 text-[44px] font-semibold leading-none tabular tracking-tight">
          {d.weight}
          <span className="text-base"> kg</span>
        </p>
        {d.previous_weight != null && (
          <p className="mt-2 text-xs" style={{ color: "#6F6F6F" }}>
            Anterior {d.previous_weight} kg · +{Number(d.weight) - Number(d.previous_weight)} kg
          </p>
        )}
      </div>
    );
  }
  if (post.kind === "wod" || post.kind === "benchmark") {
    return (
      <div className="mt-3 rounded-[18px] border p-4" style={{ borderColor: "rgba(255,255,255,0.09)", background: "rgba(255,255,255,0.04)" }}>
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold">{d.name || d.benchmark || "WOD"}</p>
          <span className="rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.16em]" style={{ background: "#1C1C1C" }}>
            {d.scale || "RX"}
          </span>
        </div>
        {d.description && <p className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">{d.description}</p>}
        <div className="mt-3 flex gap-5">
          {d.time_seconds != null && <Stat label="Tiempo" value={fmtTime(Number(d.time_seconds))} />}
          {d.score && <Stat label="Score" value={String(d.score)} />}
          {d.rpe != null && <Stat label="RPE" value={String(d.rpe)} />}
        </div>
      </div>
    );
  }
  if (post.kind === "workout" || post.kind === "progress") {
    const items: Array<[string, string]> = [];
    if (d.weight != null) items.push(["Peso", `${d.weight} kg`]);
    if (d.sets != null) items.push(["Series", String(d.sets)]);
    if (d.reps != null) items.push(["Reps", String(d.reps)]);
    if (d.time_seconds != null) items.push(["Tiempo", fmtTime(Number(d.time_seconds))]);
    if (d.rpe != null) items.push(["RPE", String(d.rpe)]);
    if (!items.length && !d.title) return null;
    return (
      <div className="mt-3 rounded-[18px] border p-4" style={{ borderColor: "rgba(255,255,255,0.09)", background: "rgba(255,255,255,0.04)" }}>
        {d.title && <p className="text-sm font-semibold">{d.title}</p>}
        {items.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-5">
            {items.map(([l, v]) => (
              <Stat key={l} label={l} value={v} />
            ))}
          </div>
        )}
      </div>
    );
  }
  return null;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular">{value}</p>
    </div>
  );
}

function Caption({ text }: { text: string }) {
  const parts = text.split(/(#[\p{L}\p{N}_]{2,30})/gu);
  return (
    <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">
      {parts.map((p, i) =>
        p.startsWith("#") ? (
          <Link key={i} to="/social/hashtag/$tag" params={{ tag: p.slice(1).toLowerCase() }} className="font-medium underline underline-offset-2">
            {p}
          </Link>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </p>
  );
}

export function PostCard({ post }: { post: Post }) {
  const uid = getCurrentUserId();
  const mine = post.user_id === uid;
  const { data: likes = [] } = useMyLikes();
  const { data: saves = [] } = useMySaves();
  const liked = likes.includes(post.id);
  const saved = saves.includes(post.id);
  const toggleLike = useToggleLike();
  const toggleSave = useToggleSave();
  const del = useDeletePost();
  const report = useReport();
  const block = useToggleBlock();
  const [menu, setMenu] = useState(false);
  const [openComments, setOpenComments] = useState(false);

  return (
    <article className="rise relative overflow-hidden rounded-[22px] border p-4" style={{ borderColor: "rgba(255,255,255,0.09)", background: "rgba(255,255,255,0.045)" }}>
      <header className="flex items-center gap-3">
        <Link to="/social/u/$username" params={{ username: post.author?.username ?? "" }} className="flex min-w-0 flex-1 items-center gap-3">
          <Avatar profile={post.author} />
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">{post.author?.display_name || post.author?.username || "Atleta"}</span>
            <span className="block truncate text-[11px] text-muted-foreground">
              {KIND_LABEL[post.kind]} · {timeAgo(post.created_at)}
              {post.author?.box_name ? ` · ${post.author.box_name}` : ""}
            </span>
          </span>
        </Link>
        <button aria-label="Opciones" onClick={() => setMenu((v) => !v)} className="pressable rounded-full p-2 text-muted-foreground">
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </header>

      {menu && (
        <div className="absolute right-3 top-14 z-20 w-52 overflow-hidden rounded-[16px] border text-sm" style={{ borderColor: "rgba(255,255,255,0.09)", background: "#161616" }}>
          {mine ? (
            <button
              className="flex w-full items-center gap-2 px-4 py-3 text-left"
              onClick={() => { setMenu(false); del.mutate(post.id, { onSuccess: () => toast.success("Publicación eliminada") }); }}
            >
              <Trash2 className="h-4 w-4" /> Eliminar
            </button>
          ) : (
            <>
              <button
                className="flex w-full items-center gap-2 px-4 py-3 text-left"
                onClick={() => { setMenu(false); report.mutate({ post_id: post.id, reason: "inapropiado" }, { onSuccess: () => toast.success("Reporte enviado") }); }}
              >
                <Flag className="h-4 w-4" /> Reportar
              </button>
              <button
                className="flex w-full items-center gap-2 px-4 py-3 text-left"
                onClick={() => { setMenu(false); block.mutate({ targetId: post.user_id, blocked: false }, { onSuccess: () => toast.success("Usuario bloqueado") }); }}
              >
                <Ban className="h-4 w-4" /> Bloquear
              </button>
            </>
          )}
        </div>
      )}

      <DataBlock post={post} />
      {post.caption && <Caption text={post.caption} />}

      {post.media && post.media.length > 0 && (
        <div className={`mt-3 grid gap-2 ${post.media.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
          {post.media.map((m) =>
            m.media_type === "video" ? (
              <video key={m.id} src={m.url} controls playsInline className="w-full rounded-[16px]" />
            ) : (
              <img key={m.id} src={m.url} alt="" loading="lazy" className="w-full rounded-[16px] object-cover" />
            ),
          )}
        </div>
      )}

      <footer className="mt-4 flex items-center gap-1 text-xs text-muted-foreground">
        <ActionBtn active={liked} onClick={() => toggleLike.mutate({ post, liked })} icon={<Heart className={`h-4 w-4 ${liked ? "fill-current" : ""}`} />} value={post.likes_count} label="Me gusta" />
        <ActionBtn onClick={() => setOpenComments((v) => !v)} icon={<MessageCircle className="h-4 w-4" />} value={post.comments_count} label="Comentarios" />
        <ActionBtn active={saved} onClick={() => toggleSave.mutate({ postId: post.id, saved })} icon={<Bookmark className={`h-4 w-4 ${saved ? "fill-current" : ""}`} />} value={post.saves_count} label="Guardar" />
      </footer>

      {openComments && <Comments post={post} />}
    </article>
  );
}

function ActionBtn({ icon, value, onClick, active, label }: { icon: React.ReactNode; value: number; onClick: () => void; active?: boolean; label: string }) {
  return (
    <button aria-label={label} onClick={onClick} className="pressable flex items-center gap-1.5 rounded-full px-3 py-2" style={{ color: active ? "#FFFFFF" : undefined }}>
      {icon}
      <span className="tabular">{value}</span>
    </button>
  );
}

function Comments({ post }: { post: Post }) {
  const uid = getCurrentUserId();
  const { data: comments = [] } = useComments(post.id);
  const add = useAddComment();
  const del = useDeleteComment();
  const [text, setText] = useState("");
  const allowed = post.author?.allow_comments !== false;

  return (
    <div className="mt-4 border-t pt-4" style={{ borderColor: "#1C1C1C" }}>
      <div className="space-y-3">
        {comments.map((c) => (
          <div key={c.id} className="flex gap-2.5">
            <Avatar profile={c.author} size={28} />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] text-muted-foreground">
                {c.author?.username ?? "atleta"} · {timeAgo(c.created_at)}
              </p>
              <p className="text-sm">{c.content}</p>
            </div>
            {c.user_id === uid && (
              <button aria-label="Eliminar comentario" onClick={() => del.mutate({ id: c.id, postId: post.id })} className="pressable p-1 text-muted-foreground">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}
        {comments.length === 0 && <p className="text-xs text-muted-foreground">Sé el primero en comentar.</p>}
      </div>

      {allowed && (
        <form
          className="mt-4 flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!text.trim()) return;
            add.mutate({ post, content: text }, { onSuccess: () => setText("") });
          }}
        >
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Añade un comentario"
            className="flex-1 rounded-[14px] border bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground/40"
            style={{ borderColor: "rgba(255,255,255,0.09)" }}
          />
          <button type="submit" aria-label="Enviar" className="pressable rounded-full p-2.5" style={{ background: "linear-gradient(140deg,#EBD6A6,#D8B46B)", color: "#0A0A0B" }}>
            <Send className="h-4 w-4" />
          </button>
        </form>
      )}
    </div>
  );
}
