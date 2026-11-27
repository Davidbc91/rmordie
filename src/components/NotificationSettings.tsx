import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { getCurrentUserId } from "@/lib/pin-gate";
import { disablePush, enablePush, iosNeedsInstall, isPushActive, pushSupported } from "@/lib/push";
import { isVideoAdmin } from "@/lib/admin-videos";
import { useNotificationPreferences, useSaveNotificationPreferences, type EditablePrefs } from "@/lib/notification-preferences";

type BoolKey = "daily_enabled" | "weekly_enabled" | "round_enabled" | "challenges_enabled" | "chat_enabled" | "comments_enabled" | "plan_enabled" | "coach_prs_enabled" | "coach_idle_enabled" | "coach_weekly_enabled" | "coach_injury_enabled";
type SettingsPrefs = Required<Omit<EditablePrefs, "admin_signups_enabled">>;

const DEFAULTS: SettingsPrefs = {
  daily_enabled: false, daily_time: "08:00", weekly_enabled: false,
  round_enabled: true, challenges_enabled: true, chat_enabled: true, comments_enabled: true, plan_enabled: true,
  coach_prs_enabled: true, coach_idle_enabled: true, coach_weekly_enabled: true, coach_injury_enabled: true,
  quiet_start: "22:00", quiet_end: "08:00",
};

type Item = { key: BoolKey; icon: string; title: string; hint?: string; time?: boolean; legacy?: boolean };
const GROUPS: { label: string; admin?: boolean; items: Item[] }[] = [
  { label: "Tu entreno", items: [
    { key: "daily_enabled", icon: "⏰", title: "Recordatorio del entreno", hint: "Qué toca hoy. No avisa en días de descanso.", time: true, legacy: true },
    { key: "round_enabled", icon: "✅", title: "Semana redonda", hint: "Si te queda 1 día para tu objetivo" },
    { key: "weekly_enabled", icon: "📊", title: "Resumen del domingo", hint: "Tu semana a las 20:00", legacy: true },
  ] },
  { label: "Retos y comunidad", items: [
    { key: "challenges_enabled", icon: "🏆", title: "Retos", hint: "Te adelantan, quedan 3 días y resultado final" },
    { key: "chat_enabled", icon: "💬", title: "Chat", hint: "Mensajes nuevos" },
  ] },
  { label: "Tu entrenador", items: [
    { key: "comments_enabled", icon: "🗨️", title: "Comentarios en tus entrenos" },
    { key: "plan_enabled", icon: "📅", title: "Planificación nueva o cambiada" },
  ] },
  { label: "Como entrenador", admin: true, items: [
    { key: "coach_prs_enabled", icon: "🔥", title: "Récords de tus atletas" },
    { key: "coach_idle_enabled", icon: "⚠️", title: "Atletas sin entrenar", hint: "A los 4, 7 y 14 días sin registrar nada" },
    { key: "coach_injury_enabled", icon: "🩹", title: "Molestias fuertes", hint: "Si un atleta apunta una de 4 o 5" },
    { key: "coach_weekly_enabled", icon: "📋", title: "Resumen de tus atletas", hint: "Domingo a las 20:00" },
  ] },
];

function Switch({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={() => onChange(!on)} className="relative h-[28px] w-[48px] shrink-0 rounded-full transition-colors disabled:opacity-40" style={{ background: on ? "var(--gold)" : "rgba(255,255,255,.14)" }}>
      <span className="absolute top-[3px] h-[22px] w-[22px] rounded-full transition-all" style={{ left: on ? 23 : 3, background: on ? "#0C0C0E" : "#fff" }} />
    </button>
  );
}

/** Panel de avisos: activar en este móvil y elegir qué llega. */
export function NotificationSettings() {
  const me = getCurrentUserId();
  const { data: prefs, isLoading } = useNotificationPreferences();
  const save = useSaveNotificationPreferences();
  const { data: isAdmin } = useQuery({ queryKey: ["video-admin", me], queryFn: isVideoAdmin, enabled: !!me, staleTime: 5 * 60 * 1000 });
  const [v, setV] = useState<SettingsPrefs>(DEFAULTS);
  const [active, setActive] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const extended = !!prefs && "round_enabled" in prefs;
  const hasInjuryPref = !!prefs && "coach_injury_enabled" in prefs; // migración de avisos aplicada

  useEffect(() => { void isPushActive().then(setActive).catch(() => setActive(false)); }, []);
  useEffect(() => {
    if (!prefs) return;
    setV((cur) => ({ ...cur, ...Object.fromEntries(Object.entries(prefs).filter(([k, x]) => k in DEFAULTS && x != null)) } as SettingsPrefs));
  }, [prefs]);

  async function persist(next: SettingsPrefs) {
    setV(next);
    const payload: Partial<EditablePrefs> = extended || !prefs
      ? (hasInjuryPref || !prefs ? next : (({ coach_injury_enabled, ...rest }) => rest)(next))
      : { daily_enabled: next.daily_enabled, daily_time: next.daily_time, weekly_enabled: next.weekly_enabled };
    try {
      await save.mutateAsync(payload);
    } catch {
      // Sin la migración nueva: guarda al menos lo de siempre
      try { await save.mutateAsync({ daily_enabled: next.daily_enabled, daily_time: next.daily_time, weekly_enabled: next.weekly_enabled }); }
      catch (e) { toast.error((e as { message?: string })?.message ?? "No se pudieron guardar los avisos"); }
    }
  }

  async function turnOn() {
    if (!me) return;
    setBusy(true);
    const res = await enablePush(me);
    setBusy(false);
    if (!res.ok) return toast.error(res.message);
    setActive(true);
    toast.success("Avisos activados en este móvil");
    if (!prefs) await persist({ ...v, daily_enabled: true, weekly_enabled: true });
  }

  async function turnOff() {
    setBusy(true);
    try { await disablePush(); setActive(false); toast("Avisos desactivados en este móvil"); } finally { setBusy(false); }
  }

  const needsInstall = iosNeedsInstall();
  const unsupported = !pushSupported() && !needsInstall;

  return (
    <section className="mt-4 space-y-3">
      <h2 className="px-1 text-[20px] font-extrabold tracking-tight">Avisos</h2>

      {needsInstall ? (
        <div className="space-y-2 rounded-[20px] bg-card p-4">
          <p className="text-[14.5px] text-muted-foreground">En iPhone, los avisos solo llegan si la app está en tu pantalla de inicio. Son tres pasos:</p>
          {[
            ["Abre la app en Safari", "No funciona desde Instagram ni otros navegadores."],
            ["Pulsa Compartir ⬆︎ y «Añadir a pantalla de inicio»", "Aparecerá el icono de RM OR DIE junto a tus apps."],
            ["Abre la app desde ese icono y vuelve aquí", "Pulsa «Activar avisos» y permite las notificaciones."],
          ].map(([t, h], i) => (
            <div key={i} className="flex gap-3 rounded-[16px] bg-white/[0.04] p-3">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[14px] font-extrabold" style={{ background: "var(--gold)", color: "var(--gold-foreground)" }}>{i + 1}</span>
              <span><span className="block text-[14.5px] font-bold">{t}</span><span className="block text-[13px] text-muted-foreground">{h}</span></span>
            </div>
          ))}
        </div>
      ) : unsupported ? (
        <p className="rounded-[16px] bg-white/[0.04] p-3.5 text-[13.5px] text-muted-foreground">Este navegador no admite avisos. Prueba desde el móvil con Chrome (Android) o Safari (iPhone).</p>
      ) : active ? (
        <div className="flex items-center gap-2.5 rounded-[16px] border px-3.5 py-3 text-[13.5px]" style={{ background: "var(--gold-tint-2)", borderColor: "rgba(var(--gold-rgb),.22)" }}>
          <span className="text-gold">✓</span>
          <span className="min-w-0 flex-1"><b>Activados en este móvil.</b> Elige cuáles te llegan.</span>
          <button type="button" disabled={busy} onClick={turnOff} className="min-h-9 shrink-0 text-[12.5px] font-semibold text-muted-foreground">Desactivar</button>
        </div>
      ) : (
        <button type="button" disabled={busy} onClick={turnOn} className="min-h-[52px] w-full rounded-full text-[16px] font-extrabold disabled:opacity-60" style={{ background: "var(--gold)", color: "var(--gold-foreground)" }}>
          {busy ? "Activando…" : "Activar avisos en este móvil"}
        </button>
      )}

      {isLoading ? <div className="h-40 animate-pulse rounded-[20px] bg-white/[0.04]" /> : GROUPS.filter((g) => !g.admin || isAdmin).map((g) => (
        <div key={g.label}>
          <p className="mb-1.5 px-1 text-[12.5px] font-extrabold text-muted-foreground">{g.label}</p>
          <div className="rounded-[20px] bg-card px-3.5">
            {g.items.map((it, i) => {
              const off = (!it.legacy && !extended && !!prefs) || (it.key === "coach_injury_enabled" && !!prefs && !hasInjuryPref);
              return (
                <div key={it.key} className={`flex min-h-[58px] items-center gap-3 py-2.5 ${i > 0 ? "border-t border-white/[0.06]" : ""}`}>
                  <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[10px] text-[16px]" style={{ background: "var(--gold-tint)" }}>{it.icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-bold">{it.title}</span>
                    {it.hint && <span className="block text-[12.5px] text-muted-foreground">{off ? "Disponible al aplicar la actualización de avisos" : it.hint}</span>}
                  </span>
                  {it.time && v.daily_enabled && (
                    <input type="time" step={900} value={v.daily_time} aria-label="Hora del recordatorio" onChange={(e) => e.target.value && persist({ ...v, daily_time: e.target.value.slice(0, 5) })} className="min-h-9 shrink-0 rounded-[10px] bg-white/[0.07] px-2 text-[15px] font-bold outline-none" />
                  )}
                  <Switch on={!!v[it.key]} disabled={off} label={it.title} onChange={(on) => persist({ ...v, [it.key]: on })} />
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <div>
        <p className="mb-1.5 px-1 text-[12.5px] font-extrabold text-muted-foreground">Silencio</p>
        <div className="flex min-h-[58px] items-center gap-3 rounded-[20px] bg-card px-3.5 py-2.5">
          <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[10px] text-[16px]" style={{ background: "var(--gold-tint)" }}>🌙</span>
          <span className="min-w-0 flex-1"><span className="block text-[15px] font-bold">No molestar</span><span className="block text-[12.5px] text-muted-foreground">Los avisos esperan a que acabe</span></span>
          <input type="time" step={900} disabled={!extended} value={v.quiet_start} aria-label="Silencio desde" onChange={(e) => e.target.value && persist({ ...v, quiet_start: e.target.value.slice(0, 5) })} className="min-h-9 w-[78px] rounded-[10px] bg-white/[0.07] px-1.5 text-[14px] font-bold outline-none disabled:opacity-40" />
          <span className="text-muted-foreground">–</span>
          <input type="time" step={900} disabled={!extended} value={v.quiet_end} aria-label="Silencio hasta" onChange={(e) => e.target.value && persist({ ...v, quiet_end: e.target.value.slice(0, 5) })} className="min-h-9 w-[78px] rounded-[10px] bg-white/[0.07] px-1.5 text-[14px] font-bold outline-none disabled:opacity-40" />
        </div>
      </div>
      <p className="px-1 text-[12.5px] text-muted-foreground">Como mucho un aviso de cada tipo al día. Al tocarlo, vas directo a lo que cuenta.</p>
    </section>
  );
}
