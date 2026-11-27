import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Lock, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { CoachInjuriesCard } from "@/components/injuries/Injuries";
import { isVideoAdmin } from "@/lib/admin-videos";
import { getCurrentUserId } from "@/lib/pin-gate";
import { localDay } from "@/lib/analytics";
import { buildPlanDateIndex, weekdayOf } from "@/lib/plan-dates";
import type { Planning } from "@/lib/excel-parser";
import {
  useCoachAthletePrs, useCoachAthleteResults, useCoachAthletes, useCommentsForAthlete, useDeleteComment, useMyPlanData, useSendComment,
  type CoachAthlete, type CoachResult,
} from "@/lib/coach";

export const Route = createFileRoute("/entrenador")({
  validateSearch: (s: Record<string, unknown>): { a?: string } => ({ a: typeof s.a === "string" ? s.a : undefined }),
  head: () => ({ meta: [{ title: "Panel de entrenador — RM OR DIE" }] }),
  component: CoachPage,
});

type Range = "week" | "month" | "all";
const addDays = (iso: string, n: number) => { const d = new Date(`${iso}T12:00:00`); d.setDate(d.getDate() + n); return localDay(d); };
const mondayOf = (iso: string) => { const d = new Date(`${iso}T12:00:00`); return addDays(iso, -((d.getDay() + 6) % 7)); };
const daysBetween = (a: string, b: string) => Math.round((new Date(`${b}T12:00:00`).getTime() - new Date(`${a}T12:00:00`).getTime()) / 864e5);
const initials = (n: string) => n.trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "?";
const cap = (s: string) => { const l = s.toLowerCase(); return l.charAt(0).toUpperCase() + l.slice(1); };
const n1 = (v: number) => String(Math.round(v * 10) / 10).replace(".", ",");

function rangeOf(r: Range, today: string) {
  if (r === "week") return { from: mondayOf(today), to: addDays(mondayOf(today), 6) };
  if (r === "month") return { from: `${today.slice(0, 8)}01`, to: today };
  return { from: addDays(today, -89), to: today };
}

/** Días de entreno que tocaban según las planificaciones (no descansos). */
function plannedDays(plans: Record<string, Planning> | undefined, keys: string[]) {
  const set = new Map<string, { month: string; week: number; day: string; title: string }>();
  for (const k of keys) {
    const p = plans?.[k];
    if (!p) continue;
    for (const [iso, pd] of buildPlanDateIndex(p.months)) {
      if (pd.day.isRest || !pd.day.blocks.length) continue;
      const first = pd.day.blocks[0]?.content.split("\n").map((l) => l.trim()).find(Boolean) ?? "";
      set.set(iso, { month: pd.month.key, week: pd.week, day: pd.day.key, title: first });
    }
  }
  return set;
}

function Avatar({ name, on, size = 38 }: { name: string; on?: boolean; size?: number }) {
  return (
    <span className="grid shrink-0 place-items-center font-extrabold" style={{ width: size, height: size, borderRadius: size * 0.32, fontSize: size * 0.34, background: "var(--chip-soft)", color: on ? "var(--gold)" : "var(--muted-foreground)", border: `2px solid ${on ? "var(--gold)" : "rgba(255,255,255,.1)"}` }}>{initials(name)}</span>
  );
}

function CoachPage() {
  const { a } = Route.useSearch();
  const me = getCurrentUserId();
  const { data: isAdmin, isLoading } = useQuery({ queryKey: ["video-admin", me], queryFn: isVideoAdmin, enabled: !!me, staleTime: 5 * 60 * 1000 });
  if (isLoading) return <AppShell><div className="h-60 animate-pulse rounded-[24px] bg-white/[0.04]" /></AppShell>;
  if (!isAdmin) return <AppShell><p className="text-sm text-muted-foreground">El panel de entrenador es solo para el administrador.</p></AppShell>;
  return <AppShell>{a ? <AthleteDetail id={a} /> : <Overview />}</AppShell>;
}

function Overview() {
  const navigate = useNavigate();
  const today = localDay();
  const [range, setRange] = useState<Range>("week");
  const { from, to } = rangeOf(range, today);
  const { data: athletes, isError, error } = useCoachAthletes(from, to);
  const allKeys = useMemo(() => (athletes ?? []).flatMap((x) => x.plan_keys), [athletes]);
  const { data: plans } = useMyPlanData(allKeys);

  const rows = useMemo(() => (athletes ?? []).map((x) => {
    const planned = plannedDays(plans, x.plan_keys);
    const trained = new Set(x.trained_days ?? []);
    const due = [...planned.keys()].filter((d) => d >= from && d <= to && d <= today);
    const done = due.filter((d) => trained.has(d)).length;
    const pct = due.length ? Math.round((done / due.length) * 100) : null;
    const idle = x.allowed ? (x.last_trained ? daysBetween(x.last_trained, today) : null) : null;
    const monday = mondayOf(today);
    const week = Array.from({ length: 7 }, (_, i) => { const d = addDays(monday, i); return { d, done: trained.has(d) || (range !== "week" ? false : false), planned: planned.has(d), today: d === today }; });
    return { x, pct, idle, week, trainedToday: trained.has(today) };
  }), [athletes, plans, from, to, today, range]);

  if (isError) {
    return <p className="rounded-[18px] bg-white/[0.04] p-4 text-[14px] text-muted-foreground">{/function|does not exist|schema cache/i.test(String((error as any)?.message)) ? "El panel estará listo cuando se aplique su migración en Lovable." : "No se pudo cargar el panel."}</p>;
  }

  const allowed = rows.filter((r) => r.x.allowed);
  const withPct = allowed.filter((r) => r.pct != null);
  const avgPct = withPct.length ? Math.round(withPct.reduce((s, r) => s + (r.pct ?? 0), 0) / withPct.length) : null;
  const prs = allowed.reduce((s, r) => s + (r.x.prs ?? 0), 0);
  const alerts = [
    ...allowed.filter((r) => r.idle == null || r.idle >= 4).map((r) => ({ id: r.x.athlete_id, tone: "r" as const, icon: "⚠", text: <><b className="text-foreground">{r.x.name}</b> {r.idle == null ? "no ha registrado ningún entreno" : `lleva ${r.idle} días sin entrenar`}</> })),
    ...allowed.filter((r) => (r.x.avg_rpe ?? 0) >= 9).map((r) => ({ id: r.x.athlete_id, tone: "o" as const, icon: "🔥", text: <><b className="text-foreground">{r.x.name}</b> va a RPE {n1(r.x.avg_rpe!)} de media: carga alta</> })),
    ...allowed.filter((r) => (r.x.prs ?? 0) > 0).map((r) => ({ id: r.x.athlete_id, tone: "l" as const, icon: "🏆", text: <><b className="text-foreground">{r.x.name}</b> ha batido {r.x.prs} {r.x.prs === 1 ? "récord" : "récords"}</> })),
  ];
  const toneStyle = { r: { background: "#2A1414", color: "#FF8E86" }, o: { background: "#2A1E10", color: "#FFB35C" }, l: { background: "var(--gold-tint-2)", color: "var(--gold)" } };

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between">
        <h1 className="text-[28px] font-extrabold tracking-tight">Tus atletas</h1>
        <span className="rounded-full px-2.5 py-1 text-[12px] font-bold" style={{ background: "var(--gold-tint)", color: "var(--gold)" }}>Entrenador</span>
      </div>
      <div className="flex gap-1 rounded-[12px] bg-white/[0.05] p-1">
        {([["week", "Esta semana"], ["month", "Este mes"], ["all", "90 días"]] as const).map(([k, l]) => (
          <button key={k} type="button" onClick={() => setRange(k)} className="min-h-9 flex-1 rounded-[9px] text-[12.5px] font-bold" style={range === k ? { background: "var(--gold-tint)", color: "var(--gold)" } : { color: "var(--muted-foreground)" }}>{l}</button>
        ))}
      </div>

      {!athletes ? (
        <div className="h-40 animate-pulse rounded-[22px] bg-white/[0.04]" />
      ) : rows.length === 0 ? (
        <p className="rounded-[18px] bg-white/[0.04] p-4 text-[14px] text-muted-foreground">Aún no compartes ninguna planificación. Cuando la compartas con tus atletas desde Importar → Mis planificaciones, aparecerán aquí.</p>
      ) : (
        <>
          <div className="grid grid-cols-3 rounded-[20px] bg-card">
            <div className="flex flex-col items-center px-1 py-3"><span className="num text-[28px] leading-none">{allowed.filter((r) => r.trainedToday).length}<span className="text-[14px] text-muted-foreground">/{allowed.length}</span></span><span className="text-center text-[11.5px] text-muted-foreground">hoy han entrenado</span></div>
            <div className="flex flex-col items-center border-l border-white/[0.06] px-1 py-3"><span className="num text-[28px] leading-none text-gold">{avgPct ?? "—"}{avgPct != null && <span className="text-[14px]">%</span>}</span><span className="text-center text-[11.5px] text-muted-foreground">cumplen el plan</span></div>
            <div className="flex flex-col items-center border-l border-white/[0.06] px-1 py-3"><span className="num text-[28px] leading-none">{prs}</span><span className="text-center text-[11.5px] text-muted-foreground">récords</span></div>
          </div>

          {alerts.length > 0 && (
            <>
              <span className="mt-1 text-[15px] font-bold">Para ti</span>
              {alerts.slice(0, 6).map((al, i) => (
                <button key={i} type="button" onClick={() => navigate({ to: "/entrenador", search: { a: al.id } })} className="pressable flex min-h-12 items-center gap-2.5 rounded-[16px] px-3 py-2.5 text-left text-[13.5px]" style={toneStyle[al.tone]}>
                  <span>{al.icon}</span><span className="min-w-0 flex-1">{al.text}</span><ChevronRight className="h-4 w-4 shrink-0" />
                </button>
              ))}
            </>
          )}

          <span className="mt-1 text-[15px] font-bold">Todos</span>
          <div className="flex flex-col rounded-[22px] bg-card px-3.5 py-1">
            {rows.map((r, i) => (
              <button key={r.x.athlete_id} type="button" disabled={!r.x.allowed} onClick={() => navigate({ to: "/entrenador", search: { a: r.x.athlete_id } })} className={`flex min-h-[62px] items-center gap-2.5 py-2.5 text-left ${i > 0 ? "border-t border-white/[0.06]" : ""}`}>
                <Avatar name={r.x.name} on={r.trainedToday} />
                <span className="min-w-0 flex-1">
                  <span className={`block truncate text-[15px] font-bold ${r.x.allowed ? "" : "text-muted-foreground"}`}>{r.x.name}</span>
                  {r.x.allowed ? (
                    <span className="mt-1.5 flex gap-[3px]" aria-label="Días de esta semana">
                      {r.week.map((w) => (
                        <span key={w.d} className="block h-1.5 w-3.5 rounded-[3px]" style={{ background: (r.x.trained_days ?? []).includes(w.d) ? "var(--gold)" : w.planned ? "rgba(255,255,255,.22)" : "rgba(255,255,255,.08)", outline: w.today ? "1.5px solid var(--foreground)" : undefined }} />
                      ))}
                    </span>
                  ) : (
                    <span className="block text-[12.5px] text-muted-foreground">{r.x.decided ? "No comparte sus entrenos" : "Aún no ha respondido"}</span>
                  )}
                </span>
                {r.x.allowed ? (
                  <span className="shrink-0 text-right">
                    <span className="num block text-[22px] leading-none" style={{ color: r.pct == null ? undefined : r.pct >= 90 ? "var(--gold)" : r.pct < 40 ? "#FF5A4E" : undefined }}>{r.pct != null ? `${r.pct}%` : "—"}</span>
                    <span className="block text-[12px]" style={{ color: (r.x.avg_rpe ?? 0) >= 9 ? "#FF8A3D" : "var(--muted-foreground)" }}>
                      {(r.x.prs ?? 0) > 0 ? `🏆 ${r.x.prs}` : r.x.avg_rpe != null ? `RPE ${n1(r.x.avg_rpe)}` : r.idle != null ? `hace ${r.idle} d` : ""}
                    </span>
                  </span>
                ) : <Lock className="h-4 w-4 shrink-0 text-muted-foreground" />}
              </button>
            ))}
          </div>
          <p className="px-1 text-[12.5px] text-muted-foreground">El % es de los días que tocaban según la planificación que le compartes, hasta hoy.</p>
        </>
      )}
    </div>
  );
}

const QUICK = ["💪 Buen trabajo", "🧊 Mañana suave", "🎯 Cuida la técnica", "🔥 A por más carga"];

function fmtResult(rows: CoachResult[]) {
  const done = rows.filter((r) => r.status === "completed");
  if (!done.length) return null;
  const r = [...done].sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0))[0];
  if (r.weight) return `${n1(r.weight)} kg${r.reps ? ` × ${r.reps}` : ""}${r.sets && r.sets > 1 ? ` × ${r.sets}` : ""}`;
  if (r.time_seconds) return `${Math.floor(r.time_seconds / 60)}:${String(r.time_seconds % 60).padStart(2, "0")}`;
  return "Hecho";
}

function AthleteDetail({ id }: { id: string }) {
  const navigate = useNavigate();
  const today = localDay();
  const monday = mondayOf(today);
  const from = addDays(today, -41);
  const { data: athletes } = useCoachAthletes(monday, addDays(monday, 6));
  const ath: CoachAthlete | undefined = athletes?.find((x) => x.athlete_id === id);
  const { data: plans } = useMyPlanData(ath?.plan_keys ?? []);
  const { data: results = [], isError } = useCoachAthleteResults(id, from, today);
  const { data: prs = [] } = useCoachAthletePrs(id);
  const { data: comments = [] } = useCommentsForAthlete(id);
  const send = useSendComment();
  const del = useDeleteComment();
  const [draft, setDraft] = useState<Record<string, string>>({});

  const planned = useMemo(() => plannedDays(plans, ath?.plan_keys ?? []), [plans, ath?.plan_keys]);
  // Contenido de cada día del plan, por sus claves
  const dayContent = useMemo(() => {
    const m = new Map<string, { key: string; content: string }[]>();
    for (const k of ath?.plan_keys ?? []) for (const mo of plans?.[k]?.months ?? []) for (const w of mo.weeks) for (const d of w.days) m.set(`${mo.key}|${w.index}|${d.key}`, d.blocks.map((b) => ({ key: b.key, content: b.content })));
    return m;
  }, [plans, ath?.plan_keys]);

  const sessions = useMemo(() => {
    const g = new Map<string, { date: string; month: string; week: number; day: string; rows: CoachResult[] }>();
    for (const r of results) {
      const k = `${r.month_key}|${r.week}|${r.day_key}`;
      const s = g.get(k) ?? { date: r.trained_on, month: r.month_key, week: r.week, day: r.day_key, rows: [] };
      s.rows.push(r);
      if (r.trained_on > s.date) s.date = r.trained_on;
      g.set(k, s);
    }
    return [...g.values()].sort((a, b) => b.date.localeCompare(a.date));
  }, [results]);

  const trainedSet = new Set(results.filter((r) => r.status === "completed").map((r) => r.trained_on));
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const weekDone = weekDays.filter((d) => trainedSet.has(d)).length;
  const weekPlanned = weekDays.filter((d) => planned.has(d)).length;
  const rpeWeeks = Array.from({ length: 6 }, (_, i) => {
    const s = addDays(monday, -7 * (5 - i)), e = addDays(s, 6);
    const v = results.filter((r) => r.rpe != null && r.trained_on >= s && r.trained_on <= e).map((r) => r.rpe!);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  });
  const lastRpe = [...rpeWeeks].reverse().find((v) => v != null) ?? null;
  const rising = rpeWeeks.filter((v) => v != null).length >= 2 && (lastRpe ?? 0) > (rpeWeeks.filter((v) => v != null).at(-2) ?? 0);

  // Racha simple (regla de la app: se corta con 2 días sin entrenar)
  let streak = 0;
  { const ds = [...trainedSet].sort().reverse(); if (ds.length && daysBetween(ds[0], today) <= 2) { streak = 1; for (let i = 1; i < ds.length; i++) { if (daysBetween(ds[i], ds[i - 1]) > 2) break; streak += daysBetween(ds[i], ds[i - 1]); } } }

  const submit = (s: { month: string; week: number; day: string }, body: string) => {
    const text = body.trim();
    if (!text) return;
    send.mutate({ athlete_id: id, month_key: s.month, week: s.week, day_key: s.day, body: text }, {
      onSuccess: () => { toast.success("Comentario enviado"); setDraft((d) => ({ ...d, [`${s.month}|${s.week}|${s.day}`]: "" })); },
      onError: (e: any) => toast.error(e?.message ?? "No se pudo enviar"),
    });
  };

  if (isError) return <div className="flex flex-col gap-3"><BackBtn /><p className="rounded-[18px] bg-white/[0.04] p-4 text-[14px] text-muted-foreground">Este atleta no comparte sus entrenos contigo.</p></div>;

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center gap-2.5">
        <button type="button" onClick={() => navigate({ to: "/entrenador", search: {} })} aria-label="Volver" className="grid h-10 w-10 place-items-center rounded-full bg-white/[0.07]"><ChevronLeft className="h-5 w-5" /></button>
        <Avatar name={ath?.name ?? "?"} on size={46} />
        <div className="min-w-0">
          <div className="truncate text-[20px] font-extrabold">{ath?.name ?? "Atleta"}</div>
          <div className="truncate text-[13px] text-muted-foreground">{ath?.last_trained ? `Último entreno: ${cap(weekdayOf(ath.last_trained))} ${Number(ath.last_trained.slice(8))}` : "Sin entrenos todavía"}</div>
        </div>
      </div>

      <div className="grid grid-cols-3 rounded-[20px] bg-card">
        <div className="flex flex-col items-center py-3"><span className="num text-[28px] leading-none">{weekDone}<span className="text-[14px] text-muted-foreground">/{weekPlanned || "—"}</span></span><span className="text-[11.5px] text-muted-foreground">esta semana</span></div>
        <div className="flex flex-col items-center border-l border-white/[0.06] py-3"><span className="num text-[28px] leading-none" style={{ color: (lastRpe ?? 0) >= 9 ? "#FF8A3D" : undefined }}>{lastRpe != null ? n1(lastRpe) : "—"}</span><span className="text-[11.5px] text-muted-foreground">RPE medio</span></div>
        <div className="flex flex-col items-center border-l border-white/[0.06] py-3"><span className="num text-[28px] leading-none text-gold">{streak}</span><span className="text-[11.5px] text-muted-foreground">días de racha</span></div>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {weekDays.map((d, i) => (
          <span key={d} className="flex flex-col items-center gap-1">
            <span className="grid h-9 w-9 place-items-center rounded-full text-[13px] font-bold" style={trainedSet.has(d) ? { background: "var(--gold-tint)", color: "var(--gold)" } : d === today ? { border: "2px solid var(--foreground)" } : planned.has(d) && d < today ? { background: "#2A1414", color: "#FF8E86" } : { background: "rgba(255,255,255,.08)", color: "var(--muted-foreground)", opacity: planned.has(d) ? 1 : 0.45 }}>{"LMXJVSD"[i]}</span>
            <span className="text-[10.5px] text-muted-foreground">{Number(d.slice(8))}</span>
          </span>
        ))}
      </div>

      <CoachInjuriesCard athleteId={id} />

      {sessions.length === 0 && <p className="rounded-[18px] bg-white/[0.04] p-4 text-[14px] text-muted-foreground">No hay entrenos en las últimas 6 semanas.</p>}

      {sessions.slice(0, 12).map((s) => {
        const key = `${s.month}|${s.week}|${s.day}`;
        const blocks = dayContent.get(key) ?? [...new Set(s.rows.map((r) => r.block_key))].map((k) => ({ key: k, content: `Bloque ${k}` }));
        const rpes = s.rows.map((r) => r.rpe).filter((x): x is number => x != null);
        const rpe = rpes.length ? Math.max(...rpes) : null;
        const notes = [...new Set(s.rows.map((r) => r.notes?.trim()).filter(Boolean))] as string[];
        const title = blocks[0]?.content.split("\n").map((l) => l.trim()).find(Boolean) ?? s.day;
        const dayComments = comments.filter((c) => c.month_key === s.month && c.week === s.week && c.day_key === s.day);
        return (
          <section key={key} className="flex flex-col gap-2.5 rounded-[22px] bg-card p-3.5">
            <div className="flex items-start justify-between gap-2">
              <span className="min-w-0 text-[15px] font-bold">{cap(weekdayOf(s.date))} {Number(s.date.slice(8))} · <span className="text-muted-foreground">{title}</span></span>
              {rpe != null && <span className="shrink-0 rounded-full px-2.5 py-1 text-[12px] font-bold" style={rpe >= 9 ? { background: "#2A1E10", color: "#FF8A3D" } : { background: "rgba(255,255,255,.08)" }}>RPE {n1(rpe)}</span>}
            </div>
            <div className="flex flex-col gap-1.5 rounded-[14px] bg-white/[0.03] px-3 py-2.5">
              {blocks.map((b) => {
                const res = fmtResult(s.rows.filter((r) => r.block_key === b.key));
                return (
                  <div key={b.key} className="flex items-baseline justify-between gap-3 text-[13.5px]">
                    <span className="min-w-0 truncate">{b.key} · {b.content.split("\n").map((l) => l.trim()).find(Boolean)}</span>
                    {res ? <b className="shrink-0 text-gold">{res}</b> : <span className="shrink-0 text-muted-foreground">Sin apuntar</span>}
                  </div>
                );
              })}
            </div>
            {notes.map((nt, i) => <p key={i} className="text-[13px] text-muted-foreground">«{nt}» — nota de {ath?.name ?? "tu atleta"}</p>)}
            {dayComments.map((c) => (
              <div key={c.id} className="flex items-start gap-2 rounded-[14px] border p-2.5 text-[13.5px]" style={{ background: "var(--gold-tint-2)", borderColor: "rgba(var(--gold-rgb),.2)" }}>
                <span className="min-w-0 flex-1">{c.body}<span className="mt-0.5 block text-[11.5px] text-muted-foreground">{c.read_at ? "Visto" : "Enviado"}</span></span>
                <button type="button" onClick={() => del.mutate(c.id)} aria-label="Borrar comentario" className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted-foreground"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
            <div className="flex flex-wrap gap-1.5">
              {QUICK.map((q) => <button key={q} type="button" disabled={send.isPending} onClick={() => submit(s, q)} className="min-h-9 rounded-full bg-white/[0.07] px-3 text-[12.5px] font-semibold">{q}</button>)}
            </div>
            <div className="flex items-center gap-2 rounded-[14px] bg-white/[0.05] py-1 pl-3 pr-1">
              <input value={draft[key] ?? ""} onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))} onKeyDown={(e) => { if (e.key === "Enter") submit(s, draft[key] ?? ""); }} maxLength={500} placeholder="Escribe un comentario…" className="min-h-10 min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-muted-foreground" />
              <button type="button" disabled={!(draft[key] ?? "").trim() || send.isPending} onClick={() => submit(s, draft[key] ?? "")} aria-label="Enviar" className="grid h-10 w-10 place-items-center rounded-[10px] disabled:opacity-40" style={{ background: "var(--gold)", color: "var(--gold-foreground)" }}><Send className="h-4 w-4" /></button>
            </div>
          </section>
        );
      })}

      <section className="flex flex-col gap-2.5 rounded-[22px] bg-card p-3.5">
        <div className="flex items-baseline justify-between"><span className="text-[15px] font-bold">RPE de las últimas 6 semanas</span>{rising && <span className="text-[12.5px] font-bold" style={{ color: "#FF8A3D" }}>▲ subiendo</span>}</div>
        <div className="flex h-12 items-end gap-1.5">
          {rpeWeeks.map((v, i) => <span key={i} className="block flex-1 rounded-[4px_4px_2px_2px]" style={{ height: v ? `${Math.max(10, ((v - 5) / 5) * 100)}%` : 4, background: i === rpeWeeks.length - 1 && v ? (v >= 9 ? "#FF8A3D" : "var(--gold)") : "rgba(255,255,255,.1)" }} />)}
        </div>
      </section>

      <section className="flex flex-col gap-2 rounded-[22px] bg-card p-3.5">
        <span className="text-[15px] font-bold">Récords recientes</span>
        {prs.length === 0 ? <p className="text-[13.5px] text-muted-foreground">Todavía no ha batido ninguno.</p> : prs.map((p, i) => (
          <div key={i} className="flex items-baseline justify-between gap-3 text-[13.5px]">
            <span className="min-w-0 truncate">{p.exercise}{p.rep_max && p.rep_max > 1 ? ` ${p.rep_max}RM` : ""} · {new Date(p.changed_at).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}</span>
            <b className="shrink-0 text-gold">{n1(p.new_weight)} kg</b>
          </div>
        ))}
      </section>
    </div>
  );
}

function BackBtn() {
  return <Link to="/entrenador" search={{}} className="inline-flex min-h-10 items-center gap-1 text-[14px] font-semibold text-muted-foreground"><ChevronLeft className="h-4 w-4" />Tus atletas</Link>;
}
