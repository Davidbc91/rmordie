import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentUserId } from "./pin-gate";

const sb = supabase as any;
const BUCKET = "social";
const SIGNED_TTL = 60 * 60 * 24 * 365 * 5;

// ---------------- Types ----------------
export type PostKind = "workout" | "pr" | "wod" | "benchmark" | "progress" | "media" | "text";

export type SocialProfile = {
  id: string;
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  box_name: string | null;
  level: string | null;
  crossfit_start_date: string | null;
  is_private: boolean;
  show_stats: boolean;
  show_prs: boolean;
  allow_comments: boolean;
  public_exercises: string[];
  is_admin: boolean;
  created_at: string;
};

export type PostMedia = { id: string; post_id: string; url: string; media_type: "image" | "video"; position: number };

export type Post = {
  id: string;
  user_id: string;
  kind: PostKind;
  caption: string | null;
  data: Record<string, any>;
  hashtags: string[];
  visibility: "public" | "private";
  is_hidden: boolean;
  likes_count: number;
  comments_count: number;
  saves_count: number;
  created_at: string;
  media?: PostMedia[];
  author?: SocialProfile | null;
};

export type PostComment = {
  id: string;
  post_id: string;
  user_id: string;
  parent_id: string | null;
  content: string;
  likes_count: number;
  created_at: string;
  author?: SocialProfile | null;
};

export type Notification = {
  id: string;
  user_id: string;
  actor_id: string | null;
  kind: string;
  post_id: string | null;
  comment_id: string | null;
  message: string | null;
  is_read: boolean;
  created_at: string;
  actor?: SocialProfile | null;
};

// ---------------- Helpers ----------------
export function extractHashtags(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(/#([\p{L}\p{N}_]{2,30})/gu)) out.add(m[1].toLowerCase());
  return [...out];
}

export function slugifyUsername(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9._]/g, "")
    .slice(0, 24);
}

export function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "ahora";
  if (diff < 3600) return `${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} d`;
  return new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
}

export function fmtTime(seconds?: number | null): string {
  if (seconds == null) return "—";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

async function compressImage(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const max = 1440;
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.82));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}

export async function uploadSocialFile(file: File): Promise<{ url: string; media_type: "image" | "video" }> {
  const uid = getCurrentUserId();
  if (!uid) throw new Error("No hay perfil activo");
  const isVideo = file.type.startsWith("video/");
  const body: Blob = isVideo ? file : await compressImage(file);
  const ext = isVideo ? (file.name.split(".").pop() || "mp4") : "jpg";
  const path = `${uid}/${crypto.randomUUID()}.${ext}`;
  const { error } = await sb.storage.from(BUCKET).upload(path, body, {
    contentType: isVideo ? file.type : "image/jpeg",
    upsert: false,
  });
  if (error) throw error;
  const { data, error: sErr } = await sb.storage.from(BUCKET).createSignedUrl(path, SIGNED_TTL);
  if (sErr) throw sErr;
  return { url: data.signedUrl as string, media_type: isVideo ? "video" : "image" };
}

// ---------------- Social profile ----------------
export function useMySocialProfile() {
  const uid = getCurrentUserId();
  return useQuery({
    queryKey: ["social_profile", uid],
    enabled: !!uid,
    queryFn: async (): Promise<SocialProfile | null> => {
      const { data, error } = await sb.from("social_profiles").select("*").eq("user_id", uid).maybeSingle();
      if (error) throw error;
      return (data as SocialProfile) ?? null;
    },
  });
}

export function useSocialProfileByUsername(username?: string) {
  return useQuery({
    queryKey: ["social_profile_username", username],
    enabled: !!username,
    queryFn: async (): Promise<SocialProfile | null> => {
      const { data, error } = await sb.from("social_profiles").select("*").eq("username", username).maybeSingle();
      if (error) throw error;
      return (data as SocialProfile) ?? null;
    },
  });
}

export function useSaveSocialProfile() {
  const qc = useQueryClient();
  const uid = getCurrentUserId();
  return useMutation({
    mutationFn: async (p: Partial<SocialProfile>) => {
      if (!uid) throw new Error("No hay perfil activo");
      const { error } = await sb
        .from("social_profiles")
        .upsert({ ...p, user_id: uid, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["social_profile"] });
      qc.invalidateQueries({ queryKey: ["social_profile_username"] });
      qc.invalidateQueries({ queryKey: ["feed"] });
    },
  });
}

async function fetchProfilesByIds(ids: string[]): Promise<Record<string, SocialProfile>> {
  if (ids.length === 0) return {};
  const { data, error } = await sb.from("social_profiles").select("*").in("user_id", ids);
  if (error) throw error;
  const map: Record<string, SocialProfile> = {};
  for (const p of (data ?? []) as SocialProfile[]) map[p.user_id] = p;
  return map;
}

async function hydratePosts(rows: any[]): Promise<Post[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const [{ data: media }, profiles] = await Promise.all([
    sb.from("post_media").select("*").in("post_id", ids).order("position", { ascending: true }),
    fetchProfilesByIds([...new Set(rows.map((r) => r.user_id))]),
  ]);
  const byPost: Record<string, PostMedia[]> = {};
  for (const m of (media ?? []) as PostMedia[]) (byPost[m.post_id] ||= []).push(m);
  return rows.map((r) => ({ ...r, media: byPost[r.id] ?? [], author: profiles[r.user_id] ?? null })) as Post[];
}

// ---------------- Feed ----------------
export type FeedTab = "foryou" | "following" | "recent";

export function useBlockedIds() {
  const uid = getCurrentUserId();
  return useQuery({
    queryKey: ["blocked", uid],
    enabled: !!uid,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await sb
        .from("blocked_users")
        .select("blocker_id, blocked_id")
        .or(`blocker_id.eq.${uid},blocked_id.eq.${uid}`);
      if (error) throw error;
      return (data ?? []).map((r: any) => (r.blocker_id === uid ? r.blocked_id : r.blocker_id));
    },
  });
}

export function useFollowingIds(userId?: string | null) {
  const uid = userId ?? getCurrentUserId();
  return useQuery({
    queryKey: ["following_ids", uid],
    enabled: !!uid,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await sb.from("follows").select("following_id").eq("follower_id", uid);
      if (error) throw error;
      return (data ?? []).map((r: any) => r.following_id);
    },
  });
}

export function useFeed(tab: FeedTab) {
  const uid = getCurrentUserId();
  const { data: following = [] } = useFollowingIds();
  const { data: blocked = [] } = useBlockedIds();
  return useQuery({
    queryKey: ["feed", tab, uid, following.join(","), blocked.join(",")],
    queryFn: async (): Promise<Post[]> => {
      let q = sb.from("posts").select("*").eq("is_hidden", false).order("created_at", { ascending: false }).limit(120);
      if (tab === "following") {
        const ids = [...following, uid].filter(Boolean);
        q = q.in("user_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
      }
      const { data, error } = await q;
      if (error) throw error;
      let rows = (data ?? []).filter((r: any) => !blocked.includes(r.user_id));
      rows = rows.filter((r: any) => r.visibility === "public" || r.user_id === uid);
      if (tab === "foryou") {
        const now = Date.now();
        rows = [...rows].sort((a: any, b: any) => score(b) - score(a));
        function score(p: any) {
          const ageH = (now - new Date(p.created_at).getTime()) / 3600000;
          const affinity = following.includes(p.user_id) ? 12 : 0;
          const own = p.user_id === uid ? 4 : 0;
          const perf = ["pr", "workout", "benchmark", "progress", "wod"].includes(p.kind) ? 6 : 0;
          const engagement = p.likes_count * 1.2 + p.comments_count * 2.5 + p.saves_count * 2;
          return affinity + own + perf + engagement - ageH * 0.6;
        }
      }
      return hydratePosts(rows);
    },
  });
}

export function usePostsByUser(userId?: string | null) {
  return useQuery({
    queryKey: ["posts_by_user", userId],
    enabled: !!userId,
    queryFn: async (): Promise<Post[]> => {
      const { data, error } = await sb
        .from("posts")
        .select("*")
        .eq("user_id", userId)
        .eq("is_hidden", false)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return hydratePosts(data ?? []);
    },
  });
}

export function useSavedPosts() {
  const uid = getCurrentUserId();
  return useQuery({
    queryKey: ["saved_feed", uid],
    enabled: !!uid,
    queryFn: async (): Promise<Post[]> => {
      const { data: saved, error } = await sb.from("saved_posts").select("post_id").eq("user_id", uid);
      if (error) throw error;
      const ids = (saved ?? []).map((r: any) => r.post_id);
      if (!ids.length) return [];
      const { data, error: e2 } = await sb.from("posts").select("*").in("id", ids).order("created_at", { ascending: false });
      if (e2) throw e2;
      return hydratePosts(data ?? []);
    },
  });
}

// ---------------- Create / delete post ----------------
export function useCreatePost() {
  const qc = useQueryClient();
  const uid = getCurrentUserId();
  return useMutation({
    mutationFn: async (input: {
      kind: PostKind;
      caption?: string;
      data?: Record<string, any>;
      visibility?: "public" | "private";
      files?: File[];
    }) => {
      if (!uid) throw new Error("No hay perfil activo");
      const caption = input.caption?.trim() || null;
      const { data: post, error } = await sb
        .from("posts")
        .insert({
          user_id: uid,
          kind: input.kind,
          caption,
          data: input.data ?? {},
          hashtags: caption ? extractHashtags(caption) : [],
          visibility: input.visibility ?? "public",
        })
        .select("*")
        .single();
      if (error) throw error;
      const files = input.files ?? [];
      if (files.length) {
        const uploaded = await Promise.all(files.map((f) => uploadSocialFile(f)));
        const { error: mErr } = await sb.from("post_media").insert(
          uploaded.map((u, i) => ({ post_id: post.id, url: u.url, media_type: u.media_type, position: i })),
        );
        if (mErr) throw mErr;
      }
      return post as Post;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["feed"] });
      qc.invalidateQueries({ queryKey: ["posts_by_user"] });
    },
  });
}

export function useDeletePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("posts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["feed"] });
      qc.invalidateQueries({ queryKey: ["posts_by_user"] });
      qc.invalidateQueries({ queryKey: ["saved_feed"] });
    },
  });
}

// ---------------- Interactions ----------------
async function notify(row: {
  user_id: string;
  actor_id: string | null;
  kind: string;
  post_id?: string | null;
  comment_id?: string | null;
  message?: string | null;
}) {
  if (row.user_id === row.actor_id) return;
  await sb.from("notifications").insert(row);
}

export function useMyLikes() {
  const uid = getCurrentUserId();
  return useQuery({
    queryKey: ["my_likes", uid],
    enabled: !!uid,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await sb.from("post_likes").select("post_id").eq("user_id", uid);
      if (error) throw error;
      return (data ?? []).map((r: any) => r.post_id);
    },
  });
}

export function useMySaves() {
  const uid = getCurrentUserId();
  return useQuery({
    queryKey: ["my_saves", uid],
    enabled: !!uid,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await sb.from("saved_posts").select("post_id").eq("user_id", uid);
      if (error) throw error;
      return (data ?? []).map((r: any) => r.post_id);
    },
  });
}

export function useToggleLike() {
  const qc = useQueryClient();
  const uid = getCurrentUserId();
  return useMutation({
    mutationFn: async ({ post, liked }: { post: Post; liked: boolean }) => {
      if (!uid) throw new Error("No hay perfil activo");
      if (liked) {
        const { error } = await sb.from("post_likes").delete().eq("post_id", post.id).eq("user_id", uid);
        if (error) throw error;
      } else {
        const { error } = await sb.from("post_likes").insert({ post_id: post.id, user_id: uid });
        if (error) throw error;
        await notify({ user_id: post.user_id, actor_id: uid, kind: "like", post_id: post.id });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my_likes"] });
      qc.invalidateQueries({ queryKey: ["feed"] });
      qc.invalidateQueries({ queryKey: ["posts_by_user"] });
    },
  });
}

export function useToggleSave() {
  const qc = useQueryClient();
  const uid = getCurrentUserId();
  return useMutation({
    mutationFn: async ({ postId, saved }: { postId: string; saved: boolean }) => {
      if (!uid) throw new Error("No hay perfil activo");
      if (saved) {
        const { error } = await sb.from("saved_posts").delete().eq("post_id", postId).eq("user_id", uid);
        if (error) throw error;
      } else {
        const { error } = await sb.from("saved_posts").insert({ post_id: postId, user_id: uid });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my_saves"] });
      qc.invalidateQueries({ queryKey: ["saved_feed"] });
      qc.invalidateQueries({ queryKey: ["feed"] });
    },
  });
}

export function useComments(postId?: string | null) {
  return useQuery({
    queryKey: ["comments", postId],
    enabled: !!postId,
    queryFn: async (): Promise<PostComment[]> => {
      const { data, error } = await sb
        .from("post_comments")
        .select("*")
        .eq("post_id", postId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      const rows = (data ?? []) as PostComment[];
      const profiles = await fetchProfilesByIds([...new Set(rows.map((r) => r.user_id))]);
      return rows.map((r) => ({ ...r, author: profiles[r.user_id] ?? null }));
    },
  });
}

export function useAddComment() {
  const qc = useQueryClient();
  const uid = getCurrentUserId();
  return useMutation({
    mutationFn: async ({ post, content, parentId, parentUserId }: { post: Post; content: string; parentId?: string | null; parentUserId?: string | null }) => {
      if (!uid) throw new Error("No hay perfil activo");
      const { data, error } = await sb
        .from("post_comments")
        .insert({ post_id: post.id, user_id: uid, content: content.trim(), parent_id: parentId ?? null })
        .select("*")
        .single();
      if (error) throw error;
      await notify({
        user_id: parentUserId ?? post.user_id,
        actor_id: uid,
        kind: parentId ? "reply" : "comment",
        post_id: post.id,
        comment_id: data.id,
      });
      return data as PostComment;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["comments", vars.post.id] });
      qc.invalidateQueries({ queryKey: ["feed"] });
    },
  });
}

export function useDeleteComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; postId: string }) => {
      const { error } = await sb.from("post_comments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["comments", vars.postId] });
      qc.invalidateQueries({ queryKey: ["feed"] });
    },
  });
}

export function useMyCommentLikes(postId?: string | null) {
  const uid = getCurrentUserId();
  return useQuery({
    queryKey: ["comment_likes", uid, postId],
    enabled: !!uid && !!postId,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await sb.from("comment_likes").select("comment_id").eq("user_id", uid);
      if (error) throw error;
      return (data ?? []).map((r: any) => r.comment_id);
    },
  });
}

export function useToggleCommentLike() {
  const qc = useQueryClient();
  const uid = getCurrentUserId();
  return useMutation({
    mutationFn: async ({ commentId, liked }: { commentId: string; liked: boolean; postId: string }) => {
      if (!uid) throw new Error("No hay perfil activo");
      if (liked) {
        const { error } = await sb.from("comment_likes").delete().eq("comment_id", commentId).eq("user_id", uid);
        if (error) throw error;
      } else {
        const { error } = await sb.from("comment_likes").insert({ comment_id: commentId, user_id: uid });
        if (error) throw error;
      }
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["comment_likes"] });
      qc.invalidateQueries({ queryKey: ["comments", vars.postId] });
    },
  });
}

// ---------------- Follows ----------------
export function useFollowCounts(userId?: string | null) {
  return useQuery({
    queryKey: ["follow_counts", userId],
    enabled: !!userId,
    queryFn: async () => {
      const [{ count: followers }, { count: following }] = await Promise.all([
        sb.from("follows").select("id", { count: "exact", head: true }).eq("following_id", userId),
        sb.from("follows").select("id", { count: "exact", head: true }).eq("follower_id", userId),
      ]);
      return { followers: followers ?? 0, following: following ?? 0 };
    },
  });
}

export function useToggleFollow() {
  const qc = useQueryClient();
  const uid = getCurrentUserId();
  return useMutation({
    mutationFn: async ({ targetId, following }: { targetId: string; following: boolean }) => {
      if (!uid) throw new Error("No hay perfil activo");
      if (following) {
        const { error } = await sb.from("follows").delete().eq("follower_id", uid).eq("following_id", targetId);
        if (error) throw error;
      } else {
        const { error } = await sb.from("follows").insert({ follower_id: uid, following_id: targetId });
        if (error) throw error;
        await notify({ user_id: targetId, actor_id: uid, kind: "follow" });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["following_ids"] });
      qc.invalidateQueries({ queryKey: ["follow_counts"] });
      qc.invalidateQueries({ queryKey: ["feed"] });
    },
  });
}

// ---------------- Notifications ----------------
export function useNotifications() {
  const uid = getCurrentUserId();
  return useQuery({
    queryKey: ["notifications", uid],
    enabled: !!uid,
    refetchInterval: 60000,
    queryFn: async (): Promise<Notification[]> => {
      const { data, error } = await sb
        .from("notifications")
        .select("*")
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(80);
      if (error) throw error;
      const rows = (data ?? []) as Notification[];
      const profiles = await fetchProfilesByIds([...new Set(rows.map((r) => r.actor_id).filter(Boolean) as string[])]);
      return rows.map((r) => ({ ...r, actor: r.actor_id ? profiles[r.actor_id] ?? null : null }));
    },
  });
}

export function useMarkNotificationsRead() {
  const qc = useQueryClient();
  const uid = getCurrentUserId();
  return useMutation({
    mutationFn: async () => {
      const { error } = await sb.from("notifications").update({ is_read: true }).eq("user_id", uid).eq("is_read", false);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications", uid] }),
  });
}

export function createPrNotification(exercise: string, weight: number) {
  const uid = getCurrentUserId();
  if (!uid) return;
  return sb.from("notifications").insert({
    user_id: uid,
    actor_id: uid,
    kind: "pr",
    message: `Nuevo PR · ${exercise} ${weight} kg`,
  });
}

// ---------------- Search / discover ----------------
export function useSearchProfiles(term: string) {
  return useQuery({
    queryKey: ["search_profiles", term],
    enabled: term.trim().length > 0,
    queryFn: async (): Promise<SocialProfile[]> => {
      const t = `%${term.trim()}%`;
      const { data, error } = await sb
        .from("social_profiles")
        .select("*")
        .or(`username.ilike.${t},display_name.ilike.${t},box_name.ilike.${t}`)
        .limit(30);
      if (error) throw error;
      return (data ?? []) as SocialProfile[];
    },
  });
}

export function useSearchPosts(term: string) {
  return useQuery({
    queryKey: ["search_posts", term],
    enabled: term.trim().length > 0,
    queryFn: async (): Promise<Post[]> => {
      const raw = term.trim().replace(/^#/, "");
      const t = `%${raw}%`;
      const { data, error } = await sb
        .from("posts")
        .select("*")
        .eq("is_hidden", false)
        .eq("visibility", "public")
        .or(`caption.ilike.${t},data->>exercise.ilike.${t},data->>name.ilike.${t},data->>benchmark.ilike.${t}`)
        .order("created_at", { ascending: false })
        .limit(60);
      if (error) throw error;
      return hydratePosts(data ?? []);
    },
  });
}

export function usePostsByHashtag(tag?: string) {
  return useQuery({
    queryKey: ["hashtag", tag],
    enabled: !!tag,
    queryFn: async (): Promise<Post[]> => {
      const { data, error } = await sb
        .from("posts")
        .select("*")
        .contains("hashtags", [tag!.toLowerCase()])
        .eq("is_hidden", false)
        .order("created_at", { ascending: false })
        .limit(60);
      if (error) throw error;
      return hydratePosts(data ?? []);
    },
  });
}

export function useDiscover() {
  const uid = getCurrentUserId();
  return useQuery({
    queryKey: ["discover", uid],
    queryFn: async () => {
      const [{ data: posts }, { data: profiles }] = await Promise.all([
        sb.from("posts").select("*").eq("is_hidden", false).eq("visibility", "public").order("created_at", { ascending: false }).limit(150),
        sb.from("social_profiles").select("*").order("created_at", { ascending: false }).limit(40),
      ]);
      const rows = (posts ?? []) as any[];
      const now = Date.now();
      const relevance = (p: any) => {
        const ageH = (now - new Date(p.created_at).getTime()) / 3600000;
        const perf = ["pr", "benchmark", "progress", "workout", "wod"].includes(p.kind) ? 8 : 0;
        const rich = (p.caption?.length ?? 0) > 40 ? 3 : 0;
        return perf + rich + p.comments_count * 3 + p.saves_count * 2.5 + p.likes_count * 1.1 - ageH * 0.5;
      };
      const trending = await hydratePosts([...rows].sort((a, b) => relevance(b) - relevance(a)).slice(0, 12));
      const prs = await hydratePosts(rows.filter((p) => p.kind === "pr").slice(0, 8));
      const wods = await hydratePosts(rows.filter((p) => p.kind === "wod" || p.kind === "benchmark").slice(0, 8));
      return {
        trending,
        prs,
        wods,
        newAthletes: ((profiles ?? []) as SocialProfile[]).filter((p) => p.user_id !== uid).slice(0, 12),
      };
    },
  });
}

// ---------------- PR board ----------------
export type PrBoardRow = {
  user_id: string;
  exercise: string;
  rep_max: number;
  weight: number;
  changed_at: string;
  improvement: number | null;
  author: SocialProfile | null;
};

export function usePrBoard() {
  return useQuery({
    queryKey: ["pr_board"],
    queryFn: async (): Promise<PrBoardRow[]> => {
      const { data: profiles, error: pErr } = await sb
        .from("social_profiles")
        .select("*")
        .eq("show_prs", true)
        .eq("is_private", false);
      if (pErr) throw pErr;
      const list = (profiles ?? []) as SocialProfile[];
      if (!list.length) return [];
      const ids = list.map((p) => p.user_id);
      const byId: Record<string, SocialProfile> = Object.fromEntries(list.map((p) => [p.user_id, p]));
      const { data, error } = await sb
        .from("personal_record_history")
        .select("*")
        .in("user_id", ids)
        .order("changed_at", { ascending: false })
        .limit(800);
      if (error) throw error;
      const best = new Map<string, PrBoardRow>();
      for (const r of (data ?? []) as any[]) {
        const allowed = byId[r.user_id]?.public_exercises;
        if (Array.isArray(allowed) && allowed.length > 0 && !allowed.includes(r.exercise)) continue;
        const key = `${r.user_id}|${r.exercise}|${r.rep_max}`;
        const current = best.get(key);
        if (!current || r.new_weight > current.weight) {
          best.set(key, {
            user_id: r.user_id,
            exercise: r.exercise,
            rep_max: r.rep_max,
            weight: Number(r.new_weight),
            changed_at: r.changed_at,
            improvement: r.previous_weight != null ? Number(r.new_weight) - Number(r.previous_weight) : null,
            author: byId[r.user_id] ?? null,
          });
        }
      }
      return [...best.values()].sort((a, b) => b.weight - a.weight);
    },
  });
}

// ---------------- Leaderboard (from wod/benchmark posts) ----------------
export type LeaderboardRow = {
  post: Post;
  name: string;
  scale: string;
  seconds: number | null;
  score: string | null;
};

export function useLeaderboard() {
  return useQuery({
    queryKey: ["leaderboard"],
    queryFn: async (): Promise<LeaderboardRow[]> => {
      const { data, error } = await sb
        .from("posts")
        .select("*")
        .in("kind", ["wod", "benchmark"])
        .eq("is_hidden", false)
        .eq("visibility", "public")
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      const posts = await hydratePosts(data ?? []);
      return posts
        .map((p) => ({
          post: p,
          name: (p.data.name || p.data.benchmark || "WOD") as string,
          scale: (p.data.scale || "RX") as string,
          seconds: p.data.time_seconds != null ? Number(p.data.time_seconds) : null,
          score: (p.data.score ?? null) as string | null,
        }))
        .filter((r) => r.seconds != null || r.score);
    },
  });
}

// ---------------- Moderation ----------------
export function useReport() {
  return useMutation({
    mutationFn: async (r: { post_id?: string | null; reported_user_id?: string | null; reason: string; detail?: string }) => {
      const uid = getCurrentUserId();
      if (!uid) throw new Error("No hay perfil activo");
      const { error } = await sb.from("reports").insert({ ...r, reporter_id: uid });
      if (error) throw error;
    },
  });
}

export function useToggleBlock() {
  const qc = useQueryClient();
  const uid = getCurrentUserId();
  return useMutation({
    mutationFn: async ({ targetId, blocked }: { targetId: string; blocked: boolean }) => {
      if (!uid) throw new Error("No hay perfil activo");
      if (blocked) {
        const { error } = await sb.from("blocked_users").delete().eq("blocker_id", uid).eq("blocked_id", targetId);
        if (error) throw error;
      } else {
        const { error } = await sb.from("blocked_users").insert({ blocker_id: uid, blocked_id: targetId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["blocked"] });
      qc.invalidateQueries({ queryKey: ["feed"] });
    },
  });
}

export function useReports() {
  return useQuery({
    queryKey: ["reports"],
    queryFn: async () => {
      const { data, error } = await sb.from("reports").select("*").order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
}

export function useModeratePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ postId, hidden }: { postId: string; hidden: boolean }) => {
      const { error } = await sb.from("posts").update({ is_hidden: hidden }).eq("id", postId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["feed"] });
      qc.invalidateQueries({ queryKey: ["reports"] });
    },
  });
}
