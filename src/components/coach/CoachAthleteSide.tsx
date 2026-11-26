import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "@tanstack/react-router";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { useMarkCommentsRead, useMyCoaches, useMyComments, useSetCoachAccess, type WorkoutComment } from "@/lib/coach";

const initials = (n: string) => n.trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "?";

function Badge({ name, size = 30 }: { name: string; size?: number }) {
  return <span className="grid shrink-0 place-items-center font-extrabold" style={{ width: size, height: size, borderRadius: size * 0.32, fontSize: size * 0.36, background: "#1D1D20", color: "var(--gold)", border: "2px solid var(--gold)" }}>{initials(name)}</span>;
}

/** Pregunta al atleta si su entrenador puede ver sus entrenos (una vez por entrenador). */
export function CoachConsentPrompt() {
  const { data: coaches } = useMyCoaches();
  const set = useSetCoachAccess();
  const [skipped, setSkipped] = useState<string[]>([]);
  const pending = (coaches ?? []).find((c) => c.allowed === null && !skipped.includes(c.coach_id));
  if (!pending) return null;
  const answer = (allowed: boolean) => {
    setSkipped((s) => [...s, pending.coach_id]);
    set.mutate({ coach_id: pending.coach_id, allowed }, {
      onSuccess: () => toast.success(allowed ? `${pending.coach_name} ya puede ver cómo llevas el plan` : "Hecho. Puedes cambiarlo en tu perfil"),
      onError: () => toast.error("No se pudo guardar tu respuesta"),
    });
  };
  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end" role="dialog" aria-label="Permiso para tu entrenador">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[4px]" />
      <div className="animate-fade relative mx-auto w-full max-w-2xl rounded-t-[28px] border-t border-white/10 bg-[#141416] px-5 pt-3" style={{ paddingBottom: "max(env(safe-area-inset-bottom), 20px)" }}>
        <div aria-hidden className="mx-auto mb-4 h-[5px] w-10 rounded-full bg-white/20" />
        <div className="flex items-center gap-3">
          <Badge name={pending.coach_name} size={46} />
          <div className="min-w-0"><p className="text-[17px] font-bold leading-tight">{pending.coach_name} te ha compartido una planificación</p></div>
        </div>
        <h2 className="mt-4 text-[20px] font-extrabold tracking-tight">¿Le dejas ver cómo la llevas?</h2>
        <ul className="mt-3 flex flex-col gap-2 text-[14px]">
          {["Qué días entrenas y si cumples el plan", "Tus resultados, RPE y notas de esos entrenos", "Tus récords"].map((t) => (
            <li key={t} className="flex gap-2.5"><Check className="mt-0.5 h-4 w-4 shrink-0 text-gold" strokeWidth={3} />{t}</li>
          ))}
          <li className="flex gap-2.5 text-muted-foreground"><X className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={3} />Nunca tu peso, medidas, sueño ni nada de tu perfil</li>
        </ul>
        <div className="mt-5 flex flex-col gap-2">
          <button type="button" disabled={set.isPending} onClick={() => answer(true)} className="min-h-[52px] rounded-full text-[16px] font-extrabold" style={{ background: "var(--gold)", color: "var(--gold-foreground)" }}>Sí, que me vea</button>
          <button type="button" disabled={set.isPending} onClick={() => answer(false)} className="min-h-[52px] rounded-full bg-white/[0.08] text-[16px] font-bold">Ahora no</button>
        </div>
        <p className="mt-3 text-center text-[12.5px] text-muted-foreground">Lo puedes cambiar cuando quieras en tu perfil.</p>
      </div>
    </div>,
    document.body,
  );
}

/** En el perfil: quién puede ver tus entrenos. */
export function CoachPrivacyCard() {
  const { data: coaches = [] } = useMyCoaches();
  const set = useSetCoachAccess();
  if (!coaches.length) return null;
  return (
    <section className="rise rise-3 mt-4 rounded-[18px] border border-white/[0.09] bg-white/[0.045] p-4">
      <p className="text-[15px] font-semibold">Quién ve tus entrenos</p>
      <p className="mt-0.5 text-[13px] text-muted-foreground">Tu entrenador ve días, resultados, RPE, notas y récords. Nunca tu peso ni tu perfil.</p>
      <div className="mt-3 flex flex-col gap-2">
        {coaches.map((c) => {
          const on = c.allowed === true;
          return (
            <button key={c.coach_id} type="button" aria-pressed={on} onClick={() => set.mutate({ coach_id: c.coach_id, allowed: !on })} className="flex min-h-12 items-center gap-3 text-left">
              <Badge name={c.coach_name} />
              <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{c.coach_name}</span>
              <span className="relative h-[30px] w-[50px] shrink-0 rounded-full transition-colors" style={{ background: on ? "var(--gold)" : "rgba(255,255,255,.12)" }}>
                <span className="absolute top-[3px] h-6 w-6 rounded-full transition-all" style={{ left: on ? 23 : 3, background: on ? "#0C0C0E" : "#fff" }} />
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function CommentBubble({ c, coachName }: { c: WorkoutComment; coachName: string }) {
  return (
    <div className="flex items-end gap-2">
      <Badge name={coachName} />
      <div className="min-w-0 flex-1 rounded-[16px_16px_16px_4px] border px-3 py-2.5 text-[14px]" style={{ background: "#262C12", borderColor: "rgba(198,255,0,.22)" }}>
        {c.body}
        <span className="mt-0.5 block text-[11.5px] text-muted-foreground">{coachName} · {new Date(c.created_at).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}</span>
      </div>
    </div>
  );
}

/** Comentarios del entrenador en un entreno concreto (y se marcan como vistos). */
export function WorkoutCoachComments({ month, week, day }: { month: string; week: number; day: string }) {
  const { data: comments = [] } = useMyComments();
  const { data: coaches = [] } = useMyCoaches();
  const mark = useMarkCommentsRead();
  const list = comments.filter((c) => c.month_key === month && c.week === week && c.day_key === day);
  const unread = list.filter((c) => !c.read_at).map((c) => c.id).join(",");
  useEffect(() => { if (unread) mark.mutate(unread.split(",")); }, [unread]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!list.length) return null;
  const name = (id: string) => coaches.find((c) => c.coach_id === id)?.coach_name ?? "Tu entrenador";
  return <div className="mb-4 flex flex-col gap-2">{[...list].reverse().map((c) => <CommentBubble key={c.id} c={c} coachName={name(c.coach_id)} />)}</div>;
}

/** En Inicio: comentarios nuevos del entrenador. */
export function CoachCommentsCard() {
  const { data: comments = [] } = useMyComments();
  const { data: coaches = [] } = useMyCoaches();
  const unread = comments.filter((c) => !c.read_at);
  if (!unread.length) return null;
  const c = unread[0];
  const name = coaches.find((x) => x.coach_id === c.coach_id)?.coach_name ?? "Tu entrenador";
  return (
    <Link to="/workout/$month/$week/$day" params={{ month: c.month_key, week: String(c.week), day: c.day_key }} className="pressable rise rise-2 flex flex-col gap-2 rounded-[22px] bg-card p-3.5">
      <span className="text-[12.5px] font-bold text-gold">{unread.length === 1 ? `${name} te ha dejado un comentario` : `${unread.length} comentarios nuevos de ${name}`}</span>
      <CommentBubble c={c} coachName={name} />
    </Link>
  );
}
