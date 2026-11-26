import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { Plus, Trash2, X, Crown, Timer } from "lucide-react";
import { toast } from "sonner";
import {
  challengeState, daysLeft, fmtScore, METRICS, useChallenges, useCreateChallenge, useDeleteChallenge, useJoinChallenge, useLeaderboard,
  type Challenge, type ChallengeMetric, type LeaderRow,
} from "@/lib/challenges";
import { getCurrentUserId } from "@/lib/pin-gate";
import { isVideoAdmin } from "@/lib/admin-videos";
import { useProfiles } from "@/lib/store";
import { useStoreMedals } from "@/lib/use-medals";
import { localDay } from "@/lib/analytics";

const initials = (n: string) => n.trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "?";
const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const monthName = (iso: string) => MONTHS[Number(iso.slice(5, 7)) - 1];
const shortName = (n: string) => { const p = n.trim().split(/\s+/); return p.length > 1 ? `${p[0]} ${p[1][0]}.` : p[0]; };

function useIsAdmin() {
  const me = getCurrentUserId();
  return useQuery({ queryKey: ["video-admin", me], queryFn: isVideoAdmin, enabled: !!me, staleTime: 5 * 60 * 1000 }).data === true;
}

function Avatar({ name, me, size = 34 }: { name: string; me?: boolean; size?: number }) {
  return (
    <span className="grid shrink-0 place-items-center font-extrabold" style={{ width: size, height: size, borderRadius: size * 0.32, fontSize: size * 0.36, background: me ? "#333B18" : "#1D1D20", color: "var(--gold)", border: `2px solid ${me ? "var(--gold)" : "rgba(255,255,255,.12)"}` }}>
      {initials(name)}
    </span>
  );
}

/** Bloque de retos en Comunidad. Si la base de datos aún no tiene retos, no aparece. */
export function ChallengesSection() {
  const me = getCurrentUserId();
  const isAdmin = useIsAdmin();
  const { data: list, isError } = useChallenges();
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [showAllDone, setShowAllDone] = useState(false);

  if (isError) {
    return isAdmin ? (
      <p className="mb-4 rounded-[16px] bg-white/[0.04] p-3 text-[13px] text-muted-foreground">Los retos del mes estarán aquí cuando se aplique su migración en Lovable.</p>
    ) : null;
  }
  if (!list) return null;

  const today = localDay();
  const mine = list.filter((c) => c.participants.includes(me ?? ""));
  const active = mine.filter((c) => challengeState(c, today) !== "finished");
  const joinable = list.filter((c) => c.open && !c.participants.includes(me ?? "") && challengeState(c, today) !== "finished");
  const done = mine.filter((c) => challengeState(c, today) === "finished");
  const opened = list.find((c) => c.id === openId) ?? null;

  if (!isAdmin && active.length === 0 && joinable.length === 0 && done.length === 0) return null;

  return (
    <section className="rise rise-2 mb-5 flex flex-col gap-3">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-[17px] font-extrabold tracking-tight">Retos del mes</h2>
        {isAdmin && (
          <button type="button" onClick={() => setCreating(true)} className="pressable flex min-h-9 items-center gap-1 rounded-full px-3 text-[13px] font-bold" style={{ background: "#333B18", color: "var(--gold)" }}>
            <Plus className="h-4 w-4" /> Nuevo reto
          </button>
        )}
      </div>

      {active.map((c) => <ActiveCard key={c.id} c={c} onOpen={() => setOpenId(c.id)} />)}
      {joinable.map((c) => <JoinCard key={c.id} c={c} onOpen={() => setOpenId(c.id)} />)}
      {isAdmin && active.length === 0 && joinable.length === 0 && (
        <p className="rounded-[18px] bg-white/[0.04] p-4 text-[14px] text-muted-foreground">No hay ningún reto en marcha. Crea uno para este mes.</p>
      )}

      {done.length > 0 && (
        <>
          <div className="mt-1 flex items-baseline justify-between px-1">
            <span className="text-[15px] font-extrabold">Retos terminados</span>
            {done.length > 2 && <button type="button" onClick={() => setShowAllDone((v) => !v)} className="text-[13px] font-semibold text-muted-foreground">{showAllDone ? "Ver menos" : "Ver todos ›"}</button>}
          </div>
          {(showAllDone ? done : done.slice(0, 2)).map((c) => <DoneCard key={c.id} c={c} onOpen={() => setOpenId(c.id)} />)}
        </>
      )}

      {opened && <BoardSheet c={opened} isAdmin={isAdmin} onClose={() => setOpenId(null)} />}
      {creating && <CreateSheet onClose={() => setCreating(false)} />}
    </section>
  );
}

function myPlace(board: LeaderRow[] | undefined, me: string | null) {
  if (!board || !me) return null;
  const i = board.findIndex((r) => r.profile_id === me);
  return i < 0 ? null : { pos: i + 1, row: board[i] };
}

function ActiveCard({ c, onOpen }: { c: Challenge; onOpen: () => void }) {
  const me = getCurrentUserId();
  const { data: board } = useLeaderboard(c.id);
  const mine = myPlace(board, me);
  const leader = board?.[0];
  const score = mine?.row.score ?? 0;
  const upcoming = challengeState(c) === "upcoming";
  const pct = c.goal ? Math.min(1, score / c.goal) : leader && leader.score > 0 ? Math.min(1, score / leader.score) : 0;
  return (
    <div className="relative flex flex-col gap-3 overflow-hidden rounded-[24px] border p-4" style={{ background: "linear-gradient(140deg, #2a3312 0%, #1B1B1D 60%)", borderColor: "rgba(198,255,0,.2)" }}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12.5px] font-bold text-gold">Reto de {monthName(c.starts_on)}</span>
        <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.08] px-2.5 py-1 text-[12px] font-bold">
          <Timer className="h-3.5 w-3.5" />{upcoming ? `Empieza el ${Number(c.starts_on.slice(8))}` : `${daysLeft(c)} ${daysLeft(c) === 1 ? "día" : "días"}`}
        </span>
      </div>
      <h3 className="text-[22px] font-extrabold leading-tight tracking-tight">{c.title}</h3>
      <div className="flex items-baseline gap-1.5">
        <span className="num text-[40px] leading-none text-gold">{fmtScore(c.metric, score)}</span>
        <span className="text-[15px] text-muted-foreground">{c.goal ? `de ${fmtScore(c.metric, c.goal)} ${METRICS[c.metric].unit(c.goal)}` : METRICS[c.metric].unit(score)}</span>
        <span className="flex-1" />
        {mine && board && <span className="rounded-full px-2.5 py-1 text-[12px] font-bold" style={{ background: "#333B18", color: "var(--gold)" }}>{mine.pos}º de {board.length}</span>}
      </div>
      <span className="block h-2.5 overflow-hidden rounded-full bg-white/[0.08]"><span className="block h-full rounded-full" style={{ width: `${Math.round(pct * 100)}%`, background: "var(--gold)" }} /></span>
      {leader && leader.profile_id !== me && leader.score > 0 && (
        <p className="text-[13px] text-muted-foreground">{shortName(leader.name)} va primero con {fmtScore(c.metric, leader.score)}</p>
      )}
      {leader && leader.profile_id === me && leader.score > 0 && <p className="text-[13px] font-semibold text-gold">Vas primero 👑</p>}
      <button type="button" onClick={onOpen} className="pressable min-h-12 rounded-full text-[15px] font-extrabold" style={{ background: "var(--gold)", color: "var(--gold-foreground)" }}>Ver clasificación</button>
    </div>
  );
}

function JoinCard({ c, onOpen }: { c: Challenge; onOpen: () => void }) {
  const join = useJoinChallenge();
  return (
    <div className="flex flex-col gap-3 rounded-[24px] bg-card p-4">
      <div className="flex items-center gap-3">
        <span className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-[13px] text-[12px] font-extrabold" style={{ background: "#262C12", color: "var(--gold)" }}>{METRICS[c.metric].icon}</span>
        <div className="min-w-0 flex-1">
          <div className="text-[12.5px] font-semibold text-muted-foreground">Reto abierto · hasta el {Number(c.ends_on.slice(8))} de {monthName(c.ends_on)}</div>
          <div className="truncate text-[15.5px] font-bold">{c.title}</div>
          <div className="text-[13px] text-muted-foreground">{c.participants.length} {c.participants.length === 1 ? "atleta apuntado" : "atletas apuntados"}</div>
        </div>
      </div>
      <div className="flex gap-2">
        <button type="button" disabled={join.isPending} onClick={() => join.mutate({ id: c.id, join: true }, { onSuccess: () => toast.success("¡Dentro del reto!"), onError: (e: any) => toast.error(e?.message ?? "No se pudo apuntar") })} className="pressable min-h-12 flex-1 rounded-full text-[15px] font-extrabold" style={{ background: "var(--gold)", color: "var(--gold-foreground)" }}>
          Apuntarme
        </button>
        <button type="button" onClick={onOpen} className="pressable min-h-12 rounded-full bg-white/[0.08] px-5 text-[15px] font-extrabold">Ver</button>
      </div>
    </div>
  );
}

function DoneCard({ c, onOpen }: { c: Challenge; onOpen: () => void }) {
  const me = getCurrentUserId();
  const { data: board } = useLeaderboard(c.id);
  const mine = myPlace(board, me);
  const store = useStoreMedals();
  // Medallas al terminar: primero del reto o meta alcanzada
  useEffect(() => {
    if (!mine) return;
    const codes: { code: string; achieved_at: string }[] = [];
    if (mine.pos === 1 && mine.row.score > 0) codes.push({ code: "challenge_win", achieved_at: c.ends_on });
    if ((c.goal && mine.row.score >= c.goal) || (mine.pos === 1 && mine.row.score > 0)) codes.push({ code: "challenge_done", achieved_at: c.ends_on });
    if (codes.length) store.mutate(codes);
  }, [mine?.pos, mine?.row.score, c.id]);

  const tier = mine?.pos === 1 ? ["#FFD86B", "#B8860B", "#4A3605"] : mine?.pos === 2 ? ["#E3E6EC", "#8F96A3", "#3C4150"] : mine?.pos === 3 ? ["#C98A55", "#7A4A26", "#3A2414"] : null;
  return (
    <button type="button" onClick={onOpen} className="pressable flex items-center gap-3 rounded-[20px] bg-card p-3.5 text-left">
      <span className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-[13px] text-[14px] font-extrabold" style={tier ? { background: `linear-gradient(135deg, ${tier[0]}, ${tier[1]})`, color: tier[2] } : { background: "rgba(255,255,255,.07)", color: "var(--muted-foreground)" }}>
        {mine ? `${mine.pos}º` : "—"}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-bold">{monthName(c.starts_on)[0].toUpperCase() + monthName(c.starts_on).slice(1)} · {c.title}</span>
        <span className="block truncate text-[13px] text-muted-foreground">
          {mine ? (mine.pos === 1 ? `Ganaste con ${fmtScore(c.metric, mine.row.score)} ${METRICS[c.metric].unit(mine.row.score)} 🏆` : `Terminaste ${mine.pos}º con ${fmtScore(c.metric, mine.row.score)} ${METRICS[c.metric].unit(mine.row.score)}`) : "Cargando…"}
        </span>
      </span>
    </button>
  );
}

function Sheet({ children, onClose, label }: { children: ReactNode; onClose: () => void; label: string }) {
  return createPortal(
    <div className="fixed inset-0 z-[72] flex items-end" role="dialog" aria-label={label}>
      <button aria-label="Cerrar" onClick={onClose} className="absolute inset-0 bg-black/60 backdrop-blur-[6px]" />
      <div className="animate-fade relative mx-auto max-h-[92dvh] w-full max-w-2xl overflow-y-auto overscroll-contain rounded-t-[28px] border-t border-white/10 bg-[#141416] px-4 pt-3" style={{ paddingBottom: "max(env(safe-area-inset-bottom), 20px)" }}>
        <div aria-hidden className="mx-auto mb-3 h-[5px] w-10 rounded-full bg-white/20" />
        {children}
      </div>
    </div>,
    document.body,
  );
}

function BoardSheet({ c, isAdmin, onClose }: { c: Challenge; isAdmin: boolean; onClose: () => void }) {
  const me = getCurrentUserId();
  const { data: board = [], isLoading } = useLeaderboard(c.id);
  const join = useJoinChallenge();
  const del = useDeleteChallenge();
  const state = challengeState(c);
  const joined = c.participants.includes(me ?? "");
  const mine = myPlace(board, me);
  const top = board.slice(0, 3);
  const rest = board.slice(3);
  const unit = (n: number) => METRICS[c.metric].unit(n);

  let tip: string | null = null;
  if (mine && state === "active") {
    const ahead = mine.pos > 1 ? board[mine.pos - 2] : null;
    const toGoal = c.goal ? Math.max(0, c.goal - mine.row.score) : 0;
    const parts: string[] = [];
    if (c.goal && toGoal > 0) parts.push(`Te faltan ${fmtScore(c.metric, toGoal)} ${unit(toGoal)} para la meta`);
    if (c.goal && toGoal === 0) parts.push("¡Meta cumplida!");
    if (ahead) parts.push(`${fmtScore(c.metric, ahead.score - mine.row.score)} para alcanzar a ${shortName(ahead.name)}`);
    tip = parts.join(" y ") + (parts.length ? "." : "");
    if (c.metric === "days") tip += ` Quedan ${daysLeft(c)} ${daysLeft(c) === 1 ? "día" : "días"} de reto.`;
  }

  const podium = [top[1], top[0], top[2]];
  const heights = [80, 104, 64];
  const colors = ["rgba(227,230,236,.2)", "rgba(198,255,0,.25)", "rgba(201,138,85,.2)"];

  return (
    <Sheet onClose={onClose} label={c.title}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[12.5px] font-bold text-gold">
            Reto de {monthName(c.starts_on)} · {state === "finished" ? "terminado" : state === "upcoming" ? `empieza el ${Number(c.starts_on.slice(8))}` : `quedan ${daysLeft(c)} ${daysLeft(c) === 1 ? "día" : "días"}`}
          </div>
          <h2 className="mt-0.5 text-[26px] font-extrabold leading-[1.05] tracking-tight">{c.title}</h2>
          <p className="mt-1 text-[14px] text-muted-foreground">
            {METRICS[c.metric].label}: {METRICS[c.metric].hint.toLowerCase()}, del {Number(c.starts_on.slice(8))} de {monthName(c.starts_on)} al {Number(c.ends_on.slice(8))} de {monthName(c.ends_on)}.
            {c.goal ? ` Meta: ${fmtScore(c.metric, c.goal)} ${unit(c.goal)}.` : ""}
          </p>
        </div>
        <button type="button" onClick={onClose} aria-label="Cerrar" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/[0.07]"><X className="h-[18px] w-[18px]" /></button>
      </div>

      {isLoading ? (
        <div className="mt-4 h-40 animate-pulse rounded-[20px] bg-white/[0.04]" />
      ) : board.length === 0 ? (
        <p className="mt-4 rounded-[18px] bg-white/[0.04] p-4 text-center text-[14px] text-muted-foreground">Todavía no hay nadie apuntado.</p>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-[1fr_1.1fr_1fr] items-end gap-2 rounded-[22px] bg-card px-3 pb-3 pt-4">
            {podium.map((r, i) =>
              r ? (
                <div key={r.profile_id} className="flex min-w-0 flex-col items-center gap-1.5">
                  {i === 1 && <Crown className="h-5 w-5 text-gold" />}
                  <Avatar name={r.name} me={r.profile_id === me} size={i === 1 ? 52 : 46} />
                  <span className="max-w-full truncate text-[13px] font-bold">{r.profile_id === me ? "Tú" : shortName(r.name)}</span>
                  <span className="flex w-full flex-col items-center rounded-[14px_14px_6px_6px] pt-2" style={{ height: heights[i], background: `linear-gradient(${colors[i]}, rgba(255,255,255,.03))` }}>
                    <span className={`num text-[28px] leading-none ${i === 1 ? "text-gold" : ""}`}>{fmtScore(c.metric, r.score)}</span>
                    <span className="text-[12px] text-muted-foreground">{i === 1 ? "1º" : i === 0 ? "2º" : "3º"}</span>
                  </span>
                </div>
              ) : <span key={i} />,
            )}
          </div>
          {rest.length > 0 && (
            <div className="mt-3 rounded-[22px] bg-card px-3 py-1">
              {rest.map((r, i) => {
                const isMe = r.profile_id === me;
                return (
                  <div key={r.profile_id} className={`flex items-center gap-3 py-2.5 ${i > 0 ? "border-t border-white/[0.06]" : ""} ${isMe ? "-mx-1.5 my-1 rounded-[14px] border px-2.5" : "px-1"}`} style={isMe ? { background: "#262C12", borderColor: "rgba(198,255,0,.2)" } : undefined}>
                    <span className="w-6 text-center font-extrabold text-muted-foreground">{i + 4}</span>
                    <Avatar name={r.name} me={isMe} />
                    <span className="min-w-0 flex-1 truncate text-[15px] font-bold">{isMe ? "Tú" : r.name}</span>
                    <span className="num text-[24px]">{fmtScore(c.metric, r.score)}</span>
                  </div>
                );
              })}
            </div>
          )}
          {tip && <p className="mt-3 rounded-[18px] border p-3.5 text-[14px]" style={{ background: "#262C12", borderColor: "rgba(198,255,0,.2)" }}>{tip}</p>}
        </>
      )}

      <div className="mt-4 flex flex-col gap-2">
        {!joined && c.open && state !== "finished" && (
          <button type="button" onClick={() => join.mutate({ id: c.id, join: true }, { onError: (e: any) => toast.error(e?.message ?? "No se pudo apuntar") })} className="min-h-[52px] rounded-full text-[16px] font-extrabold" style={{ background: "var(--gold)", color: "var(--gold-foreground)" }}>Apuntarme</button>
        )}
        {joined && state !== "finished" && (
          <button type="button" onClick={() => join.mutate({ id: c.id, join: false }, { onSuccess: () => { toast("Has salido del reto"); onClose(); } })} className="min-h-11 text-[14px] font-semibold text-muted-foreground">Salir del reto</button>
        )}
        {isAdmin && c.owner_id === me && (
          <button
            type="button"
            onClick={() => {
              if (!window.confirm("¿Borrar este reto? Se pierde la clasificación.")) return;
              del.mutate(c.id, { onSuccess: () => { toast("Reto borrado"); onClose(); }, onError: (e: any) => toast.error(e?.message ?? "No se pudo borrar") });
            }}
            className="flex min-h-11 items-center justify-center gap-1.5 text-[14px] font-semibold text-[#FF5A4E]"
          >
            <Trash2 className="h-4 w-4" /> Borrar reto
          </button>
        )}
      </div>
    </Sheet>
  );
}

function monthBounds(offset: number) {
  const d = new Date();
  const first = new Date(d.getFullYear(), d.getMonth() + offset, 1);
  const last = new Date(d.getFullYear(), d.getMonth() + offset + 1, 0);
  return { start: localDay(first), end: localDay(last) };
}

function CreateSheet({ onClose }: { onClose: () => void }) {
  const me = getCurrentUserId();
  const { data: profiles = [] } = useProfiles();
  const create = useCreateChallenge();
  const [metric, setMetric] = useState<ChallengeMetric>("days");
  const [goal, setGoal] = useState("20");
  const [title, setTitle] = useState("");
  const [when, setWhen] = useState<"this" | "next" | "custom">("this");
  const this_ = monthBounds(0), next = monthBounds(1);
  const [start, setStart] = useState(this_.start);
  const [end, setEnd] = useState(this_.end);
  const [open, setOpen] = useState(true);
  const others = profiles.filter((p) => p.id !== me);
  const [picked, setPicked] = useState<Set<string>>(() => new Set());
  const [meToo, setMeToo] = useState(true);

  const dates = when === "this" ? this_ : when === "next" ? next : { start, end };
  const suggested = useMemo(() => {
    const g = Number(goal.replace(",", "."));
    const m = monthName(dates.start);
    if (metric === "days") return g ? `${g} días entrenando` : `Días entrenando en ${m}`;
    if (metric === "volume") return g ? `${g >= 1000 ? `${g / 1000} toneladas` : `${g} kg`} en ${m}` : `Kilos de ${m}`;
    if (metric === "prs") return g ? `${g} récords en ${m}` : `Récords de ${m}`;
    return g ? `${g} semanas cumpliendo` : `Semanas cumplidas en ${m}`;
  }, [metric, goal, dates.start]);

  const submit = () => {
    const g = Number(goal.replace(",", "."));
    if (dates.end < dates.start) return toast.error("La fecha de fin es anterior a la de inicio");
    const members = [...picked, ...(meToo && me ? [me] : [])];
    if (!open && members.length === 0) return toast.error("Elige al menos un atleta");
    create.mutate(
      { title: (title.trim() || suggested).slice(0, 80), metric, goal: g > 0 ? g : null, starts_on: dates.start, ends_on: dates.end, open, members },
      { onSuccess: () => { toast.success("Reto creado"); onClose(); }, onError: (e: any) => toast.error(e?.message ?? "No se pudo crear el reto") },
    );
  };

  const goalUnit = metric === "days" ? "días" : metric === "volume" ? "kg" : metric === "prs" ? "récords" : "semanas";
  const segBtn = (on: boolean) => (on ? { background: "#333B18", color: "var(--gold)" } : { color: "var(--muted-foreground)" });

  return (
    <Sheet onClose={onClose} label="Nuevo reto">
      <div className="flex items-center justify-between">
        <h2 className="text-[26px] font-extrabold tracking-tight">Nuevo reto</h2>
        <button type="button" onClick={onClose} aria-label="Cerrar" className="grid h-10 w-10 place-items-center rounded-full bg-white/[0.07]"><X className="h-[18px] w-[18px]" /></button>
      </div>
      <div className="mt-3 flex flex-col gap-4">
        <div>
          <p className="mb-2 text-[13px] font-bold text-muted-foreground">Qué se mide</p>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(METRICS) as ChallengeMetric[]).map((k) => (
              <button key={k} type="button" onClick={() => { setMetric(k); setGoal(k === "days" ? "20" : k === "volume" ? "10000" : k === "prs" ? "3" : "4"); }} className="flex flex-col gap-1 rounded-[16px] border p-3 text-left" style={metric === k ? { background: "#262C12", borderColor: "rgba(198,255,0,.35)" } : { background: "rgba(255,255,255,.04)", borderColor: "transparent" }}>
                <span className="text-[14px] font-bold">{METRICS[k].label}</span>
                <span className="text-[12px] text-muted-foreground">{METRICS[k].hint}</span>
              </button>
            ))}
          </div>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-bold text-muted-foreground">Meta (opcional, en {goalUnit})</span>
          <input inputMode="decimal" value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="Sin meta" className="min-h-12 rounded-[14px] border border-white/10 bg-white/[0.05] px-3.5 text-[15px] font-semibold outline-none focus:border-[color:var(--gold)]/55" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-bold text-muted-foreground">Nombre</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={suggested} maxLength={80} className="min-h-12 rounded-[14px] border border-white/10 bg-white/[0.05] px-3.5 text-[15px] font-semibold outline-none focus:border-[color:var(--gold)]/55" />
        </label>
        <div>
          <p className="mb-2 text-[13px] font-bold text-muted-foreground">Fechas</p>
          <div className="flex gap-1 rounded-[14px] bg-white/[0.05] p-1">
            {([["this", "Este mes"], ["next", "Mes que viene"], ["custom", "A medida"]] as const).map(([k, l]) => (
              <button key={k} type="button" onClick={() => setWhen(k)} className="min-h-10 flex-1 rounded-[10px] text-[13px] font-bold" style={segBtn(when === k)}>{l}</button>
            ))}
          </div>
          {when === "custom" ? (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="min-h-11 rounded-[12px] border border-white/10 bg-white/[0.05] px-3 text-[14px]" />
              <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="min-h-11 rounded-[12px] border border-white/10 bg-white/[0.05] px-3 text-[14px]" />
            </div>
          ) : (
            <p className="mt-1.5 text-[13px] text-muted-foreground">{Number(dates.start.slice(8))} – {Number(dates.end.slice(8))} de {monthName(dates.end)}</p>
          )}
        </div>
        <div>
          <p className="mb-2 text-[13px] font-bold text-muted-foreground">Quién participa</p>
          <div className="flex gap-1 rounded-[14px] bg-white/[0.05] p-1">
            <button type="button" onClick={() => setOpen(true)} className="min-h-10 flex-1 rounded-[10px] text-[13px] font-bold" style={segBtn(open)}>Abierto a todos</button>
            <button type="button" onClick={() => setOpen(false)} className="min-h-10 flex-1 rounded-[10px] text-[13px] font-bold" style={segBtn(!open)}>Los que yo elija</button>
          </div>
          <p className="mt-1.5 text-[13px] text-muted-foreground">{open ? "Cualquiera puede apuntarse. Los que marques entran ya apuntados." : "Solo entran los que marques."}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <button type="button" onClick={() => setMeToo((v) => !v)} className="min-h-9 rounded-full px-3 text-[13px] font-bold" style={meToo ? { background: "#333B18", color: "var(--gold)" } : { background: "rgba(255,255,255,.07)", color: "var(--muted-foreground)" }}>{meToo ? "✓ " : ""}Yo también</button>
            {others.map((p) => {
              const on = picked.has(p.id);
              return (
                <button key={p.id} type="button" onClick={() => setPicked((s) => { const n = new Set(s); on ? n.delete(p.id) : n.add(p.id); return n; })} className="min-h-9 rounded-full px-3 text-[13px] font-bold" style={on ? { background: "#333B18", color: "var(--gold)" } : { background: "rgba(255,255,255,.07)", color: "var(--muted-foreground)" }}>
                  {on ? "✓ " : ""}{p.name}
                </button>
              );
            })}
          </div>
          {others.length > 1 && (
            <button type="button" onClick={() => setPicked((s) => (s.size === others.length ? new Set() : new Set(others.map((p) => p.id))))} className="mt-2 min-h-9 text-[13px] font-semibold text-gold">
              {picked.size === others.length ? "Quitar a todos" : "Marcar a todos"}
            </button>
          )}
        </div>
        <button type="button" disabled={create.isPending} onClick={submit} className="min-h-[52px] rounded-full text-[16px] font-extrabold disabled:opacity-60" style={{ background: "var(--gold)", color: "var(--gold-foreground)" }}>
          {create.isPending ? "Creando…" : "Crear reto"}
        </button>
      </div>
    </Sheet>
  );
}
