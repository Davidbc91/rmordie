import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Share2, Users } from "lucide-react";
import { toast } from "sonner";
import { getCurrentUserId } from "@/lib/pin-gate";
import { isVideoAdmin } from "@/lib/admin-videos";
import {
  useFollowSharedPlan,
  useMyPlanningShares,
  useOwnPlanning,
  useProfiles,
  useSetPlanningShares,
  useSharesForMe,
} from "@/lib/store";

/** Administrador: elegir con qué atletas se comparte su planificación. */
export function ShareMyPlan() {
  const uid = getCurrentUserId();
  const { data: isAdmin } = useQuery({ queryKey: ["video-admin", uid], queryFn: isVideoAdmin, enabled: !!uid, staleTime: 5 * 60 * 1000 });
  const { data: own } = useOwnPlanning();
  const { data: profiles = [] } = useProfiles();
  const { data: shares = [], isError } = useMyPlanningShares(!!isAdmin);
  const save = useSetPlanningShares();
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const previous = useMemo(() => shares.map((s) => s.recipient_id), [shares]);
  useEffect(() => setPicked(previous), [previous]);

  if (!isAdmin || !own) return null;
  const others = profiles.filter((p) => p.id !== uid).sort((a, b) => a.name.localeCompare(b.name, "es"));
  const changed = picked.length !== previous.length || picked.some((id) => !previous.includes(id));

  async function onSave() {
    try {
      await save.mutateAsync({ recipientIds: picked, previous });
      toast.success(picked.length ? `Planificación compartida con ${picked.length} ${picked.length === 1 ? "atleta" : "atletas"}` : "Ya no compartes tu planificación");
    } catch (e) {
      toast.error(`No se pudo guardar: ${(e as { message?: string })?.message ?? "error desconocido"}`);
    }
  }

  return (
    <section className="mt-4 rounded-[20px] border border-[color:var(--gold)]/30 bg-[color:var(--gold)]/[0.06] p-4">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex min-h-11 w-full items-center gap-3 text-left">
        <Share2 className="h-5 w-5 text-gold" />
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-bold">Compartir mi planificación</span>
          <span className="block text-[13px] text-muted-foreground">
            {previous.length ? `La siguen ${previous.length} ${previous.length === 1 ? "atleta" : "atletas"}` : "Elige qué atletas la reciben"}
          </span>
        </span>
        <span className="text-sm font-bold text-gold">{open ? "Cerrar" : "Elegir"}</span>
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          {isError && <p className="text-[13px] text-muted-foreground">Falta activar el permiso de compartir en la base de datos.</p>}
          <div className="flex items-center justify-between text-[13px] text-muted-foreground">
            <span>{picked.length} de {others.length} seleccionados</span>
            <button
              type="button"
              onClick={() => setPicked(picked.length === others.length ? [] : others.map((p) => p.id))}
              className="min-h-10 px-2 font-bold text-gold"
            >
              {picked.length === others.length ? "Ninguno" : "Todos"}
            </button>
          </div>
          <div className="max-h-[50dvh] space-y-1.5 overflow-y-auto">
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
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/[0.08] text-xs font-bold">
                    {p.name.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{p.name}</span>
                  <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border ${on ? "border-[color:var(--gold)] bg-[color:var(--gold)] text-[#0B0A08]" : "border-white/25"}`}>
                    {on && <Check className="h-3.5 w-3.5" />}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            Verán tu plan activo en su calendario y les llegará cada cambio que hagas. Cada uno apunta sus propios resultados.
          </p>
          <button
            type="button"
            disabled={!changed || save.isPending}
            onClick={onSave}
            className="gold-gradient min-h-12 w-full rounded-[14px] font-extrabold disabled:opacity-40"
          >
            {save.isPending ? "Guardando…" : "Guardar"}
          </button>
        </div>
      )}
    </section>
  );
}

/** Atleta: aviso de plan compartido, con seguir / usar el mío. */
export function SharedPlanNotice({ compact = false }: { compact?: boolean }) {
  const { data: shares = [] } = useSharesForMe();
  const { data: profiles = [] } = useProfiles();
  const { data: own } = useOwnPlanning();
  const follow = useFollowSharedPlan();
  if (!shares.length) return null;
  const share = shares.find((s) => s.follow) ?? shares[0];
  const name = profiles.find((p) => p.id === share.owner_id)?.name ?? "el administrador";

  const toggle = async (next: boolean) => {
    try {
      await follow.mutateAsync({ ownerId: share.owner_id, follow: next });
      toast.success(next ? `Ahora sigues el plan de ${name}` : own ? "Vuelves a tu plan" : "Has dejado de seguir el plan");
    } catch (e) {
      toast.error(`No se pudo cambiar: ${(e as { message?: string })?.message ?? "error desconocido"}`);
    }
  };

  return (
    <section className={`flex items-center gap-3 rounded-[16px] bg-white/[0.05] ${compact ? "mb-3 px-3 py-2" : "mt-4 p-3.5"}`}>
      <Users className="h-5 w-5 shrink-0 text-gold" />
      <p className="min-w-0 flex-1 text-[13px] leading-snug">
        {share.follow ? (
          <>Sigues el plan de <b>{name}</b></>
        ) : (
          <><b>{name}</b> te ha compartido su plan</>
        )}
      </p>
      {share.follow ? (
        (own || !compact) && (
          <button type="button" disabled={follow.isPending} onClick={() => toggle(false)} className="min-h-10 shrink-0 rounded-[10px] bg-white/[0.08] px-3 text-[13px] font-bold">
            {own ? "Usar el mío" : "Dejar de seguir"}
          </button>
        )
      ) : (
        <button type="button" disabled={follow.isPending} onClick={() => toggle(true)} className="gold-gradient min-h-10 shrink-0 rounded-[10px] px-3 text-[13px] font-extrabold">
          Seguirlo
        </button>
      )}
    </section>
  );
}
