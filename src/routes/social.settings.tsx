import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, EyeOff, Eye } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import {
  useMySocialProfile,
  useSaveSocialProfile,
  useReports,
  useModeratePost,
  slugifyUsername,
  timeAgo,
} from "@/lib/social";

export const Route = createFileRoute("/social/settings")({
  head: () => ({
    meta: [
      { title: "Perfil social — RM OR DIE" },
      { name: "description", content: "Configura tu perfil público de atleta, privacidad y qué estadísticas compartes en la comunidad RM OR DIE." },
      { property: "og:title", content: "Ajustes de perfil social" },
      { property: "og:description", content: "Privacidad, nombre de usuario y estadísticas públicas." },
    ],
  }),
  component: SocialSettings,
});

function SocialSettings() {
  const { data: profile } = useMySocialProfile();
  const save = useSaveSocialProfile();
  const [form, setForm] = useState({
    username: "",
    display_name: "",
    bio: "",
    box_name: "",
    level: "",
    avatar_url: "",
    is_private: false,
    show_stats: true,
    show_prs: true,
    allow_comments: true,
  });

  useEffect(() => {
    if (profile)
      setForm({
        username: profile.username ?? "",
        display_name: profile.display_name ?? "",
        bio: profile.bio ?? "",
        box_name: profile.box_name ?? "",
        level: profile.level ?? "",
        avatar_url: profile.avatar_url ?? "",
        is_private: profile.is_private,
        show_stats: profile.show_stats,
        show_prs: profile.show_prs,
        allow_comments: profile.allow_comments,
      });
  }, [profile]);

  const submit = () => {
    const username = slugifyUsername(form.username);
    if (!username) return toast.error("Elige un nombre de usuario");
    save.mutate(
      { ...form, username },
      { onSuccess: () => toast.success("Perfil guardado"), onError: (e: any) => toast.error(e.message ?? "Error al guardar") },
    );
  };

  return (
    <AppShell>
      <header className="rise rise-1 mb-6">
        <Link to="/social" className="mb-4 inline-flex items-center gap-2 text-xs text-muted-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Social
        </Link>
        <h1 className="text-[2rem] font-semibold leading-none tracking-tight">Perfil social</h1>
      </header>

      <div className="grid grid-cols-2 gap-2">
        <Text label="Usuario" value={form.username} onChange={(v) => setForm({ ...form, username: v })} />
        <Text label="Nombre" value={form.display_name} onChange={(v) => setForm({ ...form, display_name: v })} />
        <Text label="Box" value={form.box_name} onChange={(v) => setForm({ ...form, box_name: v })} />
        <Text label="Nivel" value={form.level} onChange={(v) => setForm({ ...form, level: v })} />
        <Text label="Avatar (URL)" value={form.avatar_url} onChange={(v) => setForm({ ...form, avatar_url: v })} className="col-span-2" />
      </div>
      <label className="mt-2 block">
        <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Bio</span>
        <textarea
          rows={3}
          value={form.bio}
          onChange={(e) => setForm({ ...form, bio: e.target.value })}
          className="mt-1 w-full rounded-[16px] border bg-transparent px-3.5 py-3 text-sm outline-none focus:border-foreground/40"
          style={{ borderColor: "#242424" }}
        />
      </label>

      <div className="mt-5 space-y-2">
        <Toggle label="Perfil privado" value={form.is_private} onChange={(v) => setForm({ ...form, is_private: v })} />
        <Toggle label="Mostrar estadísticas" value={form.show_stats} onChange={(v) => setForm({ ...form, show_stats: v })} />
        <Toggle label="Mostrar récords" value={form.show_prs} onChange={(v) => setForm({ ...form, show_prs: v })} />
        <Toggle label="Permitir comentarios" value={form.allow_comments} onChange={(v) => setForm({ ...form, allow_comments: v })} />
      </div>

      <button
        onClick={submit}
        disabled={save.isPending}
        className="pressable mt-6 w-full rounded-[18px] py-3.5 text-sm font-semibold"
        style={{ background: "#FFFFFF", color: "#000" }}
      >
        Guardar perfil
      </button>

      {profile?.is_admin && <Moderation />}
    </AppShell>
  );
}

function Moderation() {
  const { data: reports = [] } = useReports();
  const moderate = useModeratePost();
  return (
    <section className="mt-10">
      <h2 className="eyebrow mb-3">Moderación</h2>
      <div className="space-y-2">
        {reports.map((r) => (
          <div key={r.id} className="rounded-[18px] border p-4" style={{ borderColor: "#1F1F1F", background: "#111" }}>
            <p className="text-sm font-semibold">{r.reason}</p>
            <p className="text-[11px] text-muted-foreground">{timeAgo(r.created_at)} · {r.status}</p>
            {r.detail && <p className="mt-1 text-xs text-muted-foreground">{r.detail}</p>}
            {r.post_id && (
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => moderate.mutate({ postId: r.post_id, hidden: true }, { onSuccess: () => toast.success("Publicación oculta") })}
                  className="pressable flex items-center gap-1.5 rounded-[14px] border px-3 py-2 text-xs"
                  style={{ borderColor: "#242424" }}
                >
                  <EyeOff className="h-3.5 w-3.5" /> Ocultar
                </button>
                <button
                  onClick={() => moderate.mutate({ postId: r.post_id, hidden: false }, { onSuccess: () => toast.success("Publicación restaurada") })}
                  className="pressable flex items-center gap-1.5 rounded-[14px] border px-3 py-2 text-xs"
                  style={{ borderColor: "#242424" }}
                >
                  <Eye className="h-3.5 w-3.5" /> Restaurar
                </button>
              </div>
            )}
          </div>
        ))}
        {reports.length === 0 && <p className="text-sm text-muted-foreground">Sin reportes pendientes.</p>}
      </div>
    </section>
  );
}

function Text({ label, value, onChange, className = "" }: { label: string; value: string; onChange: (v: string) => void; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-[14px] border bg-transparent px-3 py-2.5 text-sm outline-none focus:border-foreground/40"
        style={{ borderColor: "#242424" }}
      />
    </label>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className="flex w-full items-center justify-between rounded-[16px] border px-4 py-3 text-sm"
      style={{ borderColor: "#1F1F1F", background: "#111" }}
    >
      {label}
      <span className="relative h-6 w-11 rounded-full transition-colors" style={{ background: value ? "#FFFFFF" : "#2A2A2A" }}>
        <span
          className="absolute top-1 h-4 w-4 rounded-full transition-all"
          style={{ left: value ? 24 : 4, background: value ? "#000" : "#8A8A8A" }}
        />
      </span>
    </button>
  );
}
