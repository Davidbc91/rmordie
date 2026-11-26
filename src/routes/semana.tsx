import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Trophy, Flame, Award } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { shareWeek, useWeekSummary } from "@/components/week/Week";
import { addDays, DAY_LETTERS, fmtKgThousands, lastWeekMonday, mondayOf, weekRange } from "@/lib/weekly-summary";
import { localDay } from "@/lib/analytics";
import { formatKg } from "@/lib/rm-matcher";

export const Route = createFileRoute("/semana")({
  validateSearch: (s: Record<string, unknown>): { w?: string } => ({
    w: typeof s.w === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s.w) ? s.w : undefined,
  }),
  head: () => ({ meta: [{ title: "Tu semana — RM OR DIE" }] }),
  component: WeekPage,
});

function WeekPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const monday = mondayOf(search.w ?? lastWeekMonday());
  const thisMonday = mondayOf(localDay());
  const { data: s } = useWeekSummary(monday);
  const [sharing, setSharing] = useState(false);
  const go = (n: number) => navigate({ to: "/semana", search: { w: addDays(monday, n * 7) }, replace: true });
  const isCurrent = monday === thisMonday;
  const maxVol = Math.max(1, ...(s?.volumeByDay ?? [0]));
  const pct = s ? Math.min(1, s.sessions / s.target) : 0;

  return (
    <AppShell>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <button type="button" onClick={() => go(-1)} aria-label="Semana anterior" className="grid h-11 w-11 place-items-center rounded-full bg-white/[0.07]"><ChevronLeft className="h-5 w-5" /></button>
          <div className="text-center">
            <div className="text-[13px] text-muted-foreground">{isCurrent ? "Esta semana (en curso)" : "Semana"}</div>
            <div className="text-[16px] font-bold">{weekRange(monday, true)}</div>
          </div>
          <button type="button" onClick={() => go(1)} disabled={isCurrent} aria-label="Semana siguiente" className="grid h-11 w-11 place-items-center rounded-full bg-white/[0.07] disabled:opacity-30"><ChevronRight className="h-5 w-5" /></button>
        </div>

        {!s ? (
          <div className="h-60 animate-pulse rounded-[24px] bg-white/[0.04]" />
        ) : (
          <>
            <div className="flex items-center gap-4">
              <svg viewBox="0 0 100 100" className="h-24 w-24 shrink-0" aria-hidden>
                <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,.07)" strokeWidth="10" />
                <circle cx="50" cy="50" r="42" fill="none" stroke="var(--gold)" strokeWidth="10" strokeLinecap="round" strokeDasharray="264" strokeDashoffset={264 * (1 - pct)} transform="rotate(-90 50 50)" style={{ transition: "stroke-dashoffset .6s" }} />
                <text x="50" y="58" textAnchor="middle" fontSize="30" fontWeight="800" fill="var(--foreground)" style={{ fontFamily: "var(--font-num)" }}>{s.sessions}/{s.target}</text>
              </svg>
              <div className="min-w-0">
                <h1 className="text-[28px] font-extrabold leading-[1.05] tracking-tight">{s.headline}</h1>
                <p className="mt-1 text-[14px] text-muted-foreground">{s.sub}</p>
              </div>
            </div>

            <section className="rounded-[24px] bg-card p-4">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[15.5px] font-bold">Kilos movidos</span>
                {s.volumeDelta != null && (
                  <span className="text-[12.5px] font-bold" style={{ color: s.volumeDelta >= 0 ? "var(--gold)" : "#FF8A3D" }}>
                    {s.volumeDelta >= 0 ? "▲" : "▼"} {Math.abs(s.volumeDelta)} % vs semana anterior
                  </span>
                )}
              </div>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="num text-[44px] leading-none">{fmtKgThousands(s.volume)}</span>
                <span className="text-[13px] text-muted-foreground">kg</span>
              </div>
              <div className="mt-3 grid h-[110px] grid-cols-7 items-end gap-1.5">
                {s.volumeByDay.map((v, i) => (
                  <div key={i} className="flex h-full flex-col items-center justify-end gap-1.5">
                    <span
                      className="block w-full rounded-[8px_8px_4px_4px]"
                      style={
                        s.trainedDays[i]
                          ? { height: v > 0 ? `${Math.max(8, (v / maxVol) * 100)}%` : "12%", background: v > 0 ? "var(--gold)" : "#333B18" }
                          : { height: 6, background: "rgba(255,255,255,.07)" }
                      }
                    />
                    <span className="text-[11.5px] font-semibold text-muted-foreground">{DAY_LETTERS[i]}</span>
                  </div>
                ))}
              </div>
              {s.volume === 0 && s.sessions > 0 && <p className="mt-2 text-[13px] text-muted-foreground">Apunta peso, series y reps para ver los kilos.</p>}
            </section>

            {(s.prs.length > 0 || s.medals.length > 0 || s.hardest) && (
              <section className="flex flex-col gap-3 rounded-[24px] bg-card p-4">
                <span className="text-[15.5px] font-bold">Lo mejor de la semana</span>
                {s.prs.slice(0, 4).map((p, i) => (
                  <Row key={`pr${i}`} icon={<Trophy className="h-5 w-5" />} tone="lime" title={`${p.exercise}${p.repMax > 1 ? ` ${p.repMax}RM` : ""} · ${formatKg(p.weight)} kg`} sub={`Récord${p.delta ? ` · +${formatKg(p.delta)} kg` : ""} · ${p.day}`} />
                ))}
                {s.medals.map((m) => (
                  <Row key={m.code} icon={<Award className="h-5 w-5" />} tone="lime" title={`Medalla · ${m.label}`} sub={m.detail ?? ""} />
                ))}
                {s.hardest && (
                  <Row icon={<Flame className="h-5 w-5" />} tone="orange" title={`El más duro: ${s.hardest.day}`} sub={`RPE ${formatKg(s.hardest.rpe)}${s.hardest.detail ? ` · ${s.hardest.detail}` : ""}`} />
                )}
              </section>
            )}

            {(s.sleep != null || s.energy != null || s.rpeAvg != null) && (
              <section className="rounded-[24px] bg-card p-4">
                <div className="flex items-baseline justify-between"><span className="text-[15.5px] font-bold">Cómo te has sentido</span><span className="text-[13px] text-muted-foreground">media de la semana</span></div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <Stat v={s.sleep != null ? formatKg(s.sleep) : "—"} l="sueño h" />
                  <Stat v={s.energy != null ? `${formatKg(s.energy)}` : "—"} l="energía" />
                  <Stat v={s.rpeAvg != null ? formatKg(s.rpeAvg) : "—"} l="RPE medio" />
                </div>
              </section>
            )}

            <div className="grid grid-cols-2 gap-2">
              <Stat v={String(s.streak)} l="días de racha" accent />
              <Stat v={String(s.weeksInRow)} l={s.weeksInRow === 1 ? "semana cumpliendo" : "semanas cumpliendo"} />
            </div>

            <button
              type="button"
              disabled={sharing}
              onClick={async () => { setSharing(true); await shareWeek(s); setSharing(false); }}
              className="pressable min-h-[54px] rounded-full text-[16px] font-extrabold"
              style={{ background: "var(--gold)", color: "var(--gold-foreground)" }}
            >
              {sharing ? "Creando imagen…" : "Compartir mi semana"}
            </button>
          </>
        )}
      </div>
    </AppShell>
  );
}

function Row({ icon, title, sub, tone }: { icon: ReactNode; title: string; sub: string; tone: "lime" | "orange" }) {
  return (
    <div className="flex items-center gap-3 border-t border-white/[0.06] pt-3 first-of-type:border-t-0 first-of-type:pt-0">
      <span className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-[13px]" style={tone === "lime" ? { background: "#333B18", color: "var(--gold)" } : { background: "#2A1E10", color: "#FF8A3D" }}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-bold">{title}</span>
        {sub && <span className="block truncate text-[13px] text-muted-foreground">{sub}</span>}
      </span>
    </div>
  );
}

function Stat({ v, l, accent }: { v: string; l: string; accent?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-[16px] bg-white/[0.05] p-3">
      <span className={`num text-[28px] leading-none ${accent ? "text-gold" : ""}`}>{v}</span>
      <span className="truncate text-[12.5px] text-muted-foreground">{l}</span>
    </div>
  );
}
