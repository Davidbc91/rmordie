import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Share2, Users } from "lucide-react";
import { toast } from "sonner";
import { getCurrentUserId } from "@/lib/pin-gate";
import { isVideoAdmin } from "@/lib/admin-videos";
import {
  useActivatePlan,
  useFollowSharedPlan,
  useMyPlanningShares,
  useMyPlans,
  useOwnPlanning,
  useProfiles,
  useSetPlanningShares,
  useSharedPlanNames,
  useSharesForMe,
  type PlanSummary,
  type PlanningShare,
} from "@/lib/store";

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });

/** Mis planificaciones: cuál uso en mi calendario y (administrador) con quién comparto cada una. */
export function MyPlans() {
  const uid = getCurrentUserId();
  const { data: isAdmin } = useQuery({ queryKey: ["video-admin", uid], queryFn: isVideoAdmin, enabled: !!uid, staleTime: 5 * 60 * 1000 });
  const { data: plans = [] } = useMyPlans();
  const { data: shares = [], isError } = useMyPlanningShares(!!isAdmin);
  const activate = useActivatePlan();
  const [sharing, setSharing] = useState<PlanSummary | null>(null);

  if (plans.length === 0 || (!isAdmin && plans.length < 2)) return null;

  return (
    <section className="mt-4 rounded-[20px] border border-[color:var(--gold)]/30 bg-[color:var(--gold)]/[0.06] p-4">
      <p className="flex items-center gap-2 text-[15px] font-bold">
        <Share2 className="h-4 w-4 text-gold" /> Mis planificaciones
      </p>
      <p className="mt-0.5 text-[13px] text-muted-foreground">
        {isAdmin ? "Elige cuál ves tú y con qué atletas compartes cada una." : "Elige cuál quieres ver en tu calendario."}
      </p>
      <div className="mt-3 space-y-2">
        {plans.map((p) => {
          const n = shares.filter((s) => s.plan_key === p.plan_key).length;
          return (
            <div key={p.plan_key} className="rounded-[16px] bg-black/25 p-3">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-bold">{p.source_filename ?? "Sin nombre"}</p>
                  <p className="text-[13px] text-muted-foreground">
                    Actualizada el {fmtDate(p.imported_at)}
                    {isAdmin && ` · ${n ? `compartida con ${n}` : "sin compartir"}`}
                  </p>
                </div>
                {p.is_active && <span className="shrink-0 rounded-full bg-[color:var(--gold)]/15 px-2.5 py-1 text-xs font-bold text-gold">En tu calendario</span>}
              </div>
              <div className="mt-2.5 flex gap-2">
                {!p.is_active && (
                  <button
                    type="button"
                    disabled={activate.isPending}
                    onClick={() => activate.mutate(p.id, { onSuccess: () => toast.success("Planificación cambiada en tu calendario") })}
                    className="min-h-11 flex-1 rounded-[12px] bg-white/[0.08] text-sm font-bold"
                  >
                    Usar en mi calendario
                  </button>
                )}
                {isAdmin && (
                  <button type="button" onClick={() => setSharing(p)} className="min-h-11 flex-1 rounded-[12px] bg-white/[0.08] text-sm font-bold">
                    Compartir{n ? ` (${n})` : ""}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {isAdmin && isError && <p className="mt-2 text-[13px] text-muted-foreground">Falta activar el permiso de compartir en la base de datos.</p>}
      {sharing && <ShareSheet plan={sharing} shares={shares} onClose={() => setSharing(null)} />}
    </section>
  );
}

function ShareSheet({ plan, shares, onClose }: { plan: PlanSummary; shares: PlanningShare[]; onClose: () => void }) {
  const uid = getCurrentUserId();
  const { data: profiles = [] } = useProfiles();
  const save = useSetPlanningShares();
  const previous = useMemo(() => shares.filter((s) => s.plan_key === plan.plan_key).map((s) => s.recipient_id), [shares, plan.plan_key]);
  const [picked, setPicked] = useState<string[]>(previous);
  useEffect(() => setPicked(previous), [previous]);
  const others = profiles.filter((p) => p.id !== uid).sort((a, b) => a.name.localeCompare(b.name, "es"));
  const changed = picked.length !== previous.length || picked.some((id) => !previous.includes(id));

  async function onSave() {
    try {
      await save.mutateAsync({ planKey: plan.plan_key, recipientIds: picked, previous });
      toast.success(picked.length ? `«${plan.source_filename ?? "Planificación"}» compartida con ${picked.length} ${picked.length === 1 ? "atleta" : "atletas"}` : "Ya no la compartes con nadie");
      onClose();
    } catch (e) {
      toast.error(`No se pudo guardar: ${(e as { message?: string })?.message ?? "error desconocido"}`);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end bg-black/60" onClick={onClose}>
      <div
        role="dialog"
        aria-label="Compartir planificación"
        className="max-h-[88dvh] w-full overflow-y-auto rounded-t-[24px] border-t border-white/10 bg-[color:var(--card)] px-4 pt-5"
        style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-[13px] text-muted-foreground">Compartir</p>
        <h2 className="truncate text-[26px] font-extrabold leading-tight" style={{ fontFamily: "var(--font-editorial)" }}>
          {(plan.source_filename ?? "Planificación").toUpperCase()}
        </h2>
        <div className="mt-3 flex items-center justify-between text-[13px] text-muted-foreground">
          <span>{picked.length} de {others.length} seleccionados</span>
          <button type="button" onClick={() => setPicked(picked.length === others.length ? [] : others.map((p) => p.id))} className="min-h-10 px-2 font-bold text-gold">
            {picked.length === others.length ? "Ninguno" : "Todos"}
          </button>
        </div>
        <div className="space-y-1.5">
          {others.map((p) => {
            const on = picked.includes(p.id);
            return (
              <button
                key={p.id}
                type="button"
                aria-pressed={on}
                onClick={() => setPicked(on ? picked.filter((x) => x !== p.id) : [...picked, p.id])}
                className={`flex min-h-12 w-full items-center gap-3 rounded-[14px] px-3 text-left ${on ? "bg-[color:var(--gold)]/12 ring-1 ring-[color:var(--gold)]" : "bg-white/[0.045]"}`}
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/[0.08] text-xs font-bold">{p.name.slice(0, 2).toUpperCase()}</span>
                <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{p.name}</span>
                <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border ${on ? "border-[color:var(--gold)] bg-[color:var(--gold)] text-[color:var(--gold-foreground)]" : "border-white/25"}`}>
                  {on && <Check className="h-3.5 w-3.5" />}
                </span>
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">
          Verán la última versión de esta planificación y cada cambio que le hagas. Si un atleta recibe varias, elige cuál sigue. Cada uno apunta sus propios resultados.
        </p>
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={onClose} className="min-h-12 flex-1 rounded-[14px] bg-white/[0.08] font-bold">Cancelar</button>
          <button type="button" disabled={!changed || save.isPending} onClick={onSave} className="gold-gradient min-h-12 flex-[2] rounded-[14px] font-extrabold disabled:opacity-40">
            {save.isPending ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Atleta: qué planificación compartida sigue (o la suya). */
export function SharedPlanNotice({ compact = false }: { compact?: boolean }) {
  const { data: shares = [] } = useSharesForMe();
  const { data: profiles = [] } = useProfiles();
  const { data: own } = useOwnPlanning();
  const keys = useMemo(() => [...new Set(shares.map((s) => s.plan_key).filter(Boolean))], [shares]);
  const { data: names = {} } = useSharedPlanNames(keys);
  const follow = useFollowSharedPlan();
  const [open, setOpen] = useState(false);
  if (!shares.length) return null;

  const current = shares.find((s) => s.follow);
  const ownerName = (id: string) => profiles.find((p) => p.id === id)?.name ?? "el administrador";
  const planName = (s: PlanningShare) => names[s.plan_key] ?? "Planificación";

  const choose = async (planKey: string | null) => {
    try {
      await follow.mutateAsync({ planKey });
      setOpen(false);
      toast.success(planKey ? "Planificación cambiada" : own ? "Vuelves a tu plan" : "Has dejado de seguir el plan compartido");
    } catch (e) {
      toast.error(`No se pudo cambiar: ${(e as { message?: string })?.message ?? "error desconocido"}`);
    }
  };

  return (
    <section className={`rounded-[16px] bg-white/[0.05] ${compact ? "mb-3 px-3 py-2" : "mt-4 p-3.5"}`}>
      <div className="flex items-center gap-3">
        <Users className="h-5 w-5 shrink-0 text-gold" />
        <p className="min-w-0 flex-1 text-[13px] leading-snug">
          {current ? (
            <>Sigues <b>{planName(current)}</b> de {ownerName(current.owner_id)}</>
          ) : (
            <>Te han compartido {shares.length === 1 ? <b>{planName(shares[0])}</b> : `${shares.length} planificaciones`}</>
          )}
        </p>
        <button type="button" onClick={() => setOpen((v) => !v)} className="min-h-10 shrink-0 rounded-[10px] bg-white/[0.08] px-3 text-[13px] font-bold">
          {open ? "Cerrar" : "Cambiar"}
        </button>
      </div>
      {open && (
        <div className="mt-2.5 space-y-1.5">
          {shares.map((s) => (
            <button
              key={s.plan_key}
              type="button"
              disabled={follow.isPending}
              onClick={() => choose(s.plan_key)}
              className={`flex min-h-12 w-full items-center gap-3 rounded-[12px] px-3 text-left text-sm ${s.follow ? "bg-[color:var(--gold)]/12 ring-1 ring-[color:var(--gold)]" : "bg-white/[0.045]"}`}
            >
              <span className="min-w-0 flex-1 truncate font-semibold">{planName(s)}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{ownerName(s.owner_id)}</span>
              {s.follow && <Check className="h-4 w-4 shrink-0 text-gold" />}
            </button>
          ))}
          <button
            type="button"
            disabled={follow.isPending}
            onClick={() => choose(null)}
            className={`flex min-h-12 w-full items-center rounded-[12px] px-3 text-left text-sm font-semibold ${!current ? "bg-[color:var(--gold)]/12 ring-1 ring-[color:var(--gold)]" : "bg-white/[0.045]"}`}
          >
            {own ? "Usar mi propia planificación" : "No seguir ninguna"}
          </button>
        </div>
      )}
    </section>
  );
}
