import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { isVideoAdmin } from "@/lib/admin-videos";
import { getCurrentUserId } from "@/lib/pin-gate";
import { useNotificationPreferences, useSaveNotificationPreferences } from "@/lib/notification-preferences";
import { deviceKind, shortDate, statusOf, summarize, useAdminUsers, whenLabel, type AdminUser, type UserStatus } from "@/lib/admin-users";

export const Route = createFileRoute("/admin/usuarios")({
  head: () => ({ meta: [{ title: "Panel de administrador — RM OR DIE" }] }),
  component: AdminUsersPage,
});

type Filter = "all" | "new" | "active" | "idle" | "noplan";
const TAGS: Record<UserStatus, { label: string; bg: string; fg: string }> = {
  new: { label: "Nuevo", bg: "#333B18", fg: "#C6FF00" },
  active: { label: "Activo", bg: "#13303D", fg: "#3BB8F5" },
  idle: { label: "Se enfría", bg: "#3A2414", fg: "#FF8A3D" },
  unstarted: { label: "Sin empezar", bg: "#2C2C2F", fg: "#A6A6A0" },
};
const initials = (n: string) => n.trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "?";
const NUM = { fontFamily: "var(--font-num)" } as const;

function AdminUsersPage() {
  const me = getCurrentUserId();
  const { data: isAdmin, isLoading } = useQuery({ queryKey: ["video-admin", me], queryFn: isVideoAdmin, enabled: !!me, staleTime: 5 * 60 * 1000 });
  if (isLoading) return <AppShell><div className="h-60 animate-pulse rounded-[24px] bg-white/[0.04]" /></AppShell>;
  if (!isAdmin) return <AppShell><p className="text-sm text-muted-foreground">Este panel es solo para el administrador.</p></AppShell>;
  return <AppShell><Panel /></AppShell>;
}

function Panel() {
  const { data: users, isLoading, isError, error } = useAdminUsers();
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const s = useMemo(() => summarize(users ?? []), [users]);
  const todayLabel = new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });

  if (isLoading) return <div className="h-60 animate-pulse rounded-[24px] bg-white/[0.04]" />;
  if (isError) {
    const msg = (error as Error)?.message ?? "";
    return (
      <div className="rounded-[24px] bg-[#1B1B1D] p-5 text-sm text-muted-foreground">
        {/admin_users_overview|function|404/i.test(msg)
          ? "Falta aplicar la migración del panel (20261127120000_panel_administrador.sql) en Lovable."
          : `No se pudo cargar el panel: ${msg}`}
      </div>
    );
  }

  const list = (users ?? []).filter((u) => {
    const st = statusOf(u);
    const okFilter = filter === "all" || (filter === "noplan" ? !u.has_plan : filter === "idle" ? st === "idle" || st === "unstarted" : st === filter);
    const needle = q.trim().toLowerCase();
    return okFilter && (!needle || `${u.name} ${u.email ?? ""} ${u.username ?? ""}`.toLowerCase().includes(needle));
  });
  const maxWeek = Math.max(1, ...s.weeks.map((w) => w.count));
  const bestWeek = s.weeks.reduce((a, b) => (b.count > a.count ? b : a), s.weeks[0]);
  const drop = s.funnel[0].value - s.funnel[1].value;
  const delta = s.newLast7 - s.newPrev7;
  const count = (f: Filter) => (users ?? []).filter((u) => {
    const st = statusOf(u);
    return f === "all" || (f === "noplan" ? !u.has_plan : f === "idle" ? st === "idle" || st === "unstarted" : st === f);
  }).length;

  return (
    <div className="space-y-4 pb-10">
      <div>
        <div className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[var(--gold)]">Solo administrador</div>
        <h1 className="mt-2 text-[40px] font-black uppercase leading-[0.95]" style={NUM}>Quién se está uniendo</h1>
        <p className="mt-2 text-sm text-muted-foreground">Actualizado: {todayLabel}</p>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <Kpi label="Usuarios" value={s.total} note={s.newLast7 ? `+${s.newLast7} esta semana` : "Ninguno nuevo esta semana"} tone="#F4F4F2" noteTone={s.newLast7 ? "var(--gold)" : undefined} />
        <Kpi label="Nuevos 7 días" value={s.newLast7} note={`${delta >= 0 ? "+" : ""}${delta} vs semana pasada`} tone="var(--gold)" noteTone={delta > 0 ? "var(--gold)" : delta < 0 ? "#FF8A3D" : undefined} />
        <Kpi label="Activos 7 días" value={s.active7} note={s.total ? `${Math.round((s.active7 / s.total) * 100)} % del total` : "—"} tone="#3BB8F5" />
        <Kpi label="Con avisos" value={s.withPush} note={[s.iphone && `${s.iphone} iPhone`, s.android && `${s.android} Android`, s.other && `${s.other} ordenador`].filter(Boolean).join(" · ") || "Nadie todavía"} tone="#FF8A3D" />
      </div>

      <section className="rounded-[24px] bg-[#1B1B1D] p-[18px]">
        <div className="flex items-baseline justify-between">
          <span className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground">Altas por semana</span>
          <span className="text-xs text-muted-foreground">últimas 12 semanas</span>
        </div>
        <svg viewBox="0 0 400 170" width="100%" className="mt-3 block" role="img" aria-label={`Altas por semana; la mejor, ${bestWeek.count}`}>
          {s.weeks.map((w, i) => {
            const h = Math.max(3, (w.count / maxWeek) * 120);
            const x = 8 + i * 32.5;
            const last = i === s.weeks.length - 1;
            const best = w === bestWeek && w.count > 0;
            return (
              <g key={w.monday}>
                <rect x={x} y={140 - h} width={22} height={h} rx={6} fill={last || best ? "#C6FF00" : "#3A3A3D"} opacity={best && !last ? 0.6 : 1} />
                {(last || best) && w.count > 0 && (
                  <text x={x + 11} y={132 - h} textAnchor="middle" fontSize={14} fontWeight={800} fill="#F4F4F2">{w.count}</text>
                )}
              </g>
            );
          })}
          <text x={8} y={162} fontSize={11} fill="#A6A6A0">{shortDate(s.weeks[0].monday)}</text>
          <text x={392} y={162} fontSize={11} fill="#A6A6A0" textAnchor="end">Esta semana</text>
        </svg>
        {bestWeek.count > 0 && (
          <p className="mt-1.5 text-[13px] text-muted-foreground">
            La mejor semana fue la del {shortDate(bestWeek.monday)}: <b className="text-foreground">{bestWeek.count} {bestWeek.count === 1 ? "alta" : "altas"}</b>.
          </p>
        )}
      </section>

      <section className="rounded-[24px] bg-[#1B1B1D] p-[18px]">
        <div className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground">Qué hacen después de entrar</div>
        <div className="mt-3.5 space-y-3">
          {s.funnel.map((f, i) => (
            <div key={f.label}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold">{f.label}</span>
                <span className="text-2xl font-extrabold leading-none" style={NUM}>{f.value}</span>
              </div>
              <div className="mt-1 h-3.5 rounded-full bg-[#232326]">
                <div className="h-3.5 rounded-full bg-[var(--gold)]" style={{ width: `${s.total ? (f.value / s.total) * 100 : 0}%`, opacity: 1 - i * 0.18 }} />
              </div>
            </div>
          ))}
        </div>
        {drop > 0 && (
          <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">
            {drop === 1 ? "1 persona no tiene" : `${drop} personas no tienen`} ningún plan todavía. Filtra por <b className="text-[#FF8A3D]">Sin plan</b> para verlas.
          </p>
        )}
      </section>

      <SignupToggle />

      <section className="rounded-[24px] bg-[#1B1B1D] px-[18px] pb-1.5 pt-[18px]">
        <div className="mb-3 text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground">Usuarios</div>
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre o correo"
            aria-label="Buscar usuario"
            className="h-11 w-full rounded-[14px] bg-[#2C2C2F] pl-9 pr-3 text-base outline-none focus:ring-1 focus:ring-[var(--gold)]"
          />
        </label>
        <div className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1" role="group" aria-label="Filtrar usuarios">
          {([["all", "Todos"], ["new", "Nuevos"], ["active", "Activos"], ["idle", "Se enfrían"], ["noplan", "Sin plan"]] as const).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              aria-pressed={filter === k}
              className={`min-h-10 shrink-0 rounded-full px-3.5 text-[13px] font-bold ${filter === k ? "bg-[#333B18] text-[var(--gold)]" : "bg-[#2C2C2F] text-muted-foreground"}`}
            >
              {label} · {count(k)}
            </button>
          ))}
        </div>
        <div className="mt-1.5">
          {list.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">Nadie en este grupo.</p>
          ) : (
            list.map((u) => <UserRow key={u.id} u={u} open={open === u.id} onToggle={() => setOpen(open === u.id ? null : u.id)} />)
          )}
        </div>
      </section>
    </div>
  );
}

function Kpi({ label, value, note, tone, noteTone }: { label: string; value: number; note: string; tone: string; noteTone?: string }) {
  return (
    <div className="rounded-[20px] bg-[#1B1B1D] p-3.5">
      <div className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
      <div className="mt-1.5 text-[44px] font-extrabold leading-none" style={{ ...NUM, color: tone }}>{value}</div>
      <div className="mt-1 text-xs font-bold" style={{ color: noteTone ?? "var(--muted-foreground)" }}>{note}</div>
    </div>
  );
}

function SignupToggle() {
  const { data: prefs } = useNotificationPreferences();
  const save = useSaveNotificationPreferences();
  const on = prefs?.admin_signups_enabled ?? true;
  return (
    <section className="flex items-center justify-between gap-3 rounded-[24px] bg-[#1B1B1D] p-[18px]">
      <div>
        <div className="text-[15px] font-extrabold">Avisarme de cada alta</div>
        <div className="mt-0.5 text-[13px] text-muted-foreground">«Laura se ha unido a RM OR DIE». Necesitas los avisos activados en este móvil.</div>
      </div>
      <button
        role="switch"
        aria-checked={on}
        aria-label="Avisarme de cada alta"
        disabled={save.isPending}
        onClick={() => save.mutate({ admin_signups_enabled: !on }, { onError: () => toast.error("No se pudo guardar") })}
        className={`relative h-[30px] w-[52px] shrink-0 rounded-full transition-colors ${on ? "bg-[var(--gold)]" : "bg-[#2C2C2F]"}`}
      >
        <span className={`absolute top-1 h-[22px] w-[22px] rounded-full transition-all ${on ? "right-1 bg-[#0C0C0E]" : "left-1 bg-[#A6A6A0]"}`} />
      </button>
    </section>
  );
}

function UserRow({ u, open, onToggle }: { u: AdminUser; open: boolean; onToggle: () => void }) {
  const st = statusOf(u);
  const tag = TAGS[st];
  const devices = [...new Set((u.devices ?? []).map(deviceKind))];
  return (
    <div className="border-b border-[#2C2C2F] last:border-0">
      <button onClick={onToggle} aria-expanded={open} className="flex w-full items-center gap-3 py-3 text-left">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[13px] bg-[#232326] text-sm font-extrabold" style={{ color: tag.fg }}>{initials(u.name)}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-extrabold">{u.name}</span>
          <span className="block truncate text-xs text-muted-foreground">
            Alta: {whenLabel(u.created_at, true)} · Último entreno: {whenLabel(u.last_trained)}
          </span>
        </span>
        <span className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-extrabold" style={{ background: tag.bg, color: tag.fg }}>{tag.label}</span>
      </button>
      {open && (
        <div className="pb-3.5">
          <div className="truncate text-[13px] text-muted-foreground">
            {u.email ?? "Sin correo (perfil antiguo)"}{u.box_name ? ` · ${u.box_name}` : ""}{u.username ? ` · @${u.username}` : ""}
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2">
            <Mini value={String(u.trained_days)} label="días entrenados" />
            <Mini value={String(u.prs)} label="récords" />
            <Mini value={u.has_plan ? "Sí" : "No"} label="tiene plan" />
          </div>
          <div className="mt-2 flex flex-wrap justify-between gap-x-4 gap-y-1 text-[13px]">
            <span>Avisos: <b>{devices.length ? devices.join(", ") : "no"}</b></span>
            <span className="text-muted-foreground">Último inicio de sesión: {whenLabel(u.last_sign_in_at, true)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function Mini({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-[14px] bg-[#232326] p-2.5">
      <div className="text-[26px] font-extrabold leading-none" style={NUM}>{value}</div>
      <div className="mt-1 text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}
