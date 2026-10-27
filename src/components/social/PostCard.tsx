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
      style={{ width: size, height: size, background: "rgba(200,179,138,0.15)" }}
    >
      {profile?.avatar_url ? (
        <img src={profile.avatar_url} alt={profile.username} className="h-full w-full object-cover" />
      ) : (
        <span className="font-extrabold text-[color:var(--gold-soft)]" style={{ fontFamily: "var(--font-editorial)", fontSize: Math.round(size * 0.45) }}>{initials}</span>
      )}
    </span>
  );
}

function DataBlock({ post }: { post: Post }) {
  const d = post.data || {};
  if (post.kind === "pr") {
    const delta = d.previous_weight != null ? Number(d.weight) - Number(d.previous_weight) : null;
    return (
      <div className="mt-3 rounded-[18px] px-[18px] py-4" style={{ background: "linear-gradient(140deg,#E8DDC8,#C8B38A)", color: "#0B0A08" }}>
        <p className="text-[13px] font-extrabold tracking-[0.14em]">NUEVO RÉCORD · {d.rep_max ? `${d.rep_max}RM` : "PR"}</p>
        <p className="mt-1 text-base font-bold">{d.exercise ?? "Ejercicio"}</p>
        <p className="text-[72px] font-black leading-[0.9] tabular" style={{ fontFamily: "var(--font-editorial)" }}>
          {d.weight}
          <span className="text-[26px]"> KG</span>
        </p>
        {delta != null && delta > 0 && (
          <p className="text-[13px] font-semibold opacity-75">+{delta} kg sobre el anterior ({d.previous_weight} kg)</p>
        )}
      </div>
    );
  }
  if (post.kind === "wod" || post.kind === "benchmark") {
    return (
      <div className="mt-3 rounded-[18px] border p-4" style={{ borderColor: "rgba(255,255,255,0.09)", background: "rgba(255,255,255,0.04)" }}>
        <div className="flex items-center justify-between gap-3">
          <p className="text-base font-bold">{d.name || d.benchmark || "WOD"}</p>
          <span className="rounded-full bg-white/[0.08] px-2.5 py-1 text-xs font-bold uppercase">
            {d.scale || "RX"}
          </span>
        </div>
        {d.description && <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{d.description}</p>}
        <div className="mt-3 flex gap-5">
          {d.time_seconds != null && <Stat label="Tiempo" value={fmtTime(Number(d.time_seconds))} />}
          {d.score && <Stat label="Resultado" value={String(d.score)} />}
          {d.rpe != null && <Stat label="RPE" value={String(d.rpe)} />}
        </div>
      </div>
    );
  }
  if (post.kind === "workout") {
    const loads = Array.isArray(d.loads) ? d.loads : [];
    const wods = Array.isArray(d.wods) ? d.wods : [];
    const hasSummary = d.volume != null || d.avg_rpe != null || d.blocks != null || d.prs != null;
    if (!hasSummary && !loads.length && !wods.length && !d.title) return null;

    return (
      <div
        className="mt-3 overflow-hidden rounded-[22px] border"
        style={{
          borderColor: "rgba(200,179,138,0.24)",
          background: "linear-gradient(145deg, rgba(200,179,138,0.11), rgba(255,255,255,0.035) 42%, rgba(255,255,255,0.02))",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
        }}
      >
        <div className="border-b px-4 pb-3 pt-4" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-gold">
                {d.day ? `${String(d.month ?? "").replace(/^\d+\.\s*/, "")} · SEMANA ${d.week ?? ""}` : "ENTRENO"}
              </p>
              <p className="truncate text-[40px] font-black uppercase leading-[0.9] text-[color:var(--gold-soft)]" style={{ fontFamily: "var(--font-editorial)" }}>
                {d.day ?? (d.title ?? "Completado")}
              </p>
            </div>
            {Number(d.prs) > 0 && (
              <span className="shrink-0 rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-[0.16em]" style={{ background: "linear-gradient(140deg,#E8DDC8,#C8B38A)", color: "#0A0A0B" }}>
                {d.prs} PR{Number(d.prs) === 1 ? "" : "s"}
              </span>
            )}
          </div>
        </div>

        {hasSummary && (
          <div className="grid grid-cols-3 border-b px-1.5 py-3 text-center" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
            <WorkoutMetric label="kg de volumen" value={d.volume != null ? Math.round(Number(d.volume)).toLocaleString("es-ES") : "—"} />
            <WorkoutMetric label="RPE medio" value={d.avg_rpe != null ? Number(d.avg_rpe).toFixed(1).replace(".", ",") : "—"} />
            <WorkoutMetric label="bloques" value={d.blocks != null ? String(d.blocks) : "—"} />
          </div>
        )}

        {wods.length > 0 && (
          <div className="space-y-2 p-3">
            {wods.slice(0, 3).map((w: any, i: number) => (
              <div key={i} className="flex items-center justify-between gap-3 rounded-[14px] border px-3 py-2.5" style={{ borderColor: "rgba(255,255,255,0.07)", background: "rgba(0,0,0,0.16)" }}>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{w.name || "WOD"}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{w.type ?? "WOD"} · {w.scale ?? "RX"}{w.isPr ? " · PR" : ""}</p>
                </div>
                <span className="shrink-0 text-[15px] font-bold tabular text-[color:var(--gold-soft)]">{w.result ?? "—"}</span>
              </div>
            ))}
            {wods.length > 3 && <p className="px-1 text-xs text-muted-foreground">+{wods.length - 3} WODs más</p>}
          </div>
        )}

        {loads.length > 0 && (
          <details className="border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
            <summary className="flex min-h-11 cursor-pointer items-center px-4 text-sm font-semibold text-muted-foreground">
              Ver cargas · {loads.length} bloques
            </summary>
            <div className="space-y-1.5 px-3 pb-3">
              {loads.slice(0, 8).map((load: any, i: number) => (
                <div key={i} className="flex items-center justify-between gap-3 rounded-xl px-3 py-2" style={{ background: "rgba(255,255,255,0.035)" }}>
                  <span className="min-w-0 truncate text-sm">{load.block ?? `Bloque ${i + 1}`}</span>
                  <span className="shrink-0 text-sm font-semibold tabular">
                    {load.weight != null ? `${load.weight} kg` : "Sin carga"}{load.reps != null ? ` · ${load.reps} reps` : ""}{load.rpe != null ? ` · RPE ${load.rpe}` : ""}
                  </span>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>
    );
  }

  if (post.kind === "progress") {
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

function WorkoutMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[28px] font-extrabold leading-none tabular" style={{ fontFamily: "var(--font-editorial)" }}>{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[13px] text-muted-foreground">{label}</p>
      <p className="text-[28px] font-extrabold leading-none tabular" style={{ fontFamily: "var(--font-editorial)" }}>{value}</p>
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
          <Avatar profile={post.author} size={40} />
          <span className="min-w-0">
            <span className="block truncate text-[15px] font-bold">{post.author?.display_name || post.author?.username || "Atleta"}</span>
            <span className="block truncate text-[13px] text-muted-foreground">
              {KIND_LABEL[post.kind]} · {timeAgo(post.created_at)}
              {post.author?.box_name ? ` · ${post.author.box_name}` : ""}
            </span>
          </span>
        </Link>
        <button aria-label="Opciones" onClick={() => setMenu((v) => !v)} className="pressable grid h-11 w-11 place-items-center rounded-full text-muted-foreground">
          <MoreHorizontal className="h-5 w-5" />
        </button>
      </header>

      {menu && (
        <div className="absolute right-3 top-14 z-20 w-52 overflow-hidden rounded-[16px] border text-[15px]" style={{ borderColor: "rgba(255,255,255,0.1)", background: "#141412" }}>
          {mine ? (
            <button
              className="flex min-h-12 w-full items-center gap-2 px-4 text-left"
              onClick={() => { setMenu(false); del.mutate(post.id, { onSuccess: () => toast.success("Publicación eliminada") }); }}
            >
              <Trash2 className="h-4 w-4" /> Eliminar
            </button>
          ) : (
            <>
              <button
                className="flex min-h-12 w-full items-center gap-2 px-4 text-left"
                onClick={() => { setMenu(false); report.mutate({ post_id: post.id, reason: "inapropiado" }, { onSuccess: () => toast.success("Reporte enviado") }); }}
              >
                <Flag className="h-4 w-4" /> Reportar
              </button>
              <button
                className="flex min-h-12 w-full items-center gap-2 px-4 text-left"
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

      <footer className="mt-3 flex items-center gap-1.5 text-sm">
        <ActionBtn active={liked} onClick={() => toggleLike.mutate({ post, liked })} icon={<Heart className={`h-[18px] w-[18px] ${liked ? "fill-current" : ""}`} />} value={post.likes_count} label="Me gusta" />
        <ActionBtn onClick={() => setOpenComments((v) => !v)} icon={<MessageCircle className="h-[18px] w-[18px]" />} value={post.comments_count} label="Comentarios" text="Comentar" />
        <span className="flex-1" />
        <ActionBtn active={saved} onClick={() => toggleSave.mutate({ postId: post.id, saved })} icon={<Bookmark className={`h-[18px] w-[18px] ${saved ? "fill-current" : ""}`} />} value={post.saves_count} label="Guardar" />
      </footer>

      {openComments && <Comments post={post} />}
    </article>
  );
}

function ActionBtn({ icon, value, onClick, active, label, text }: { icon: React.ReactNode; value: number; onClick: () => void; active?: boolean; label: string; text?: string }) {
  return (
    <button
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={`pressable flex min-h-11 items-center gap-1.5 rounded-[12px] px-3 font-semibold ${active ? "bg-[color:var(--gold)]/14 text-[color:var(--gold-soft)]" : "bg-white/[0.06] text-foreground/90"}`}
    >
      {icon}
      {text && <span>{text}</span>}
      {value > 0 && <span className="tabular">{text ? `· ${value}` : value}</span>}
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
    <div className="mt-4 border-t pt-4" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
      <div className="space-y-3">
        {comments.map((c) => (
          <div key={c.id} className="flex gap-2.5">
            <Avatar profile={c.author} size={28} />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] text-muted-foreground">
                {c.author?.username ?? "atleta"} · {timeAgo(c.created_at)}
              </p>
              <p className="text-[15px]">{c.content}</p>
            </div>
            {c.user_id === uid && (
              <button aria-label="Eliminar comentario" onClick={() => del.mutate({ id: c.id, postId: post.id })} className="pressable grid h-11 w-11 place-items-center text-muted-foreground">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}
        {comments.length === 0 && <p className="text-sm text-muted-foreground">Sé el primero en comentar.</p>}
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
            className="min-h-12 flex-1 rounded-[14px] border bg-white/[0.05] px-3.5 text-base outline-none focus:border-[color:var(--gold)]/60"
            style={{ borderColor: "rgba(255,255,255,0.09)" }}
          />
          <button type="submit" aria-label="Enviar comentario" className="pressable gold-gradient grid h-12 w-12 place-items-center rounded-full">
            <Send className="h-4 w-4" />
          </button>
        </form>
      )}
    </div>
  );
}
