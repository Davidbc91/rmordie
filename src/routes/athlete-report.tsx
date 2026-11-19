import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { usePlanning, useAllResults, usePersonalRecords } from "@/lib/store";
import {
  useAthleteProfile,
  useBodyMetrics,
  useWellnessLogs,
  useGoals,
  useMilestones,
  useAllPrHistory,
} from "@/lib/profile-store";
import { windowStats, wellnessAverages, fmtNum, plannedPerWeek } from "@/lib/analytics";
import { buildCoachReport, fmtN, PERIODS, type ReportPeriod, type Tone } from "@/lib/coach-report";
import { useEffect, useRef, useState as useStateW } from "react";

export const Route = createFileRoute("/athlete-report")({
  validateSearch: (search: Record<string, unknown>): { periodo?: ReportPeriod } => {
    const p = search.periodo;
    return p === "semana" || p === "mes" || p === "año" ? { periodo: p } : {};
  },
  component: AthleteReport,
});

function AthleteReport() {
  const { periodo } = Route.useSearch();
  const navigate = Route.useNavigate();
  const period: ReportPeriod = periodo ?? "mes";
  const { data: profile } = useAthleteProfile();
  const { data: records = [] } = usePersonalRecords();
  const { data: results = [] } = useAllResults();
  const { data: history = [] } = useAllPrHistory();
  const { data: metrics = [] } = useBodyMetrics();
  const { data: wellness = [] } = useWellnessLogs();
  const { data: goals = [] } = useGoals();
  const { data: milestones = [] } = useMilestones();
  const { data: planning } = usePlanning();

  const stats = useMemo(() => windowStats(results, history, null), [results, history]);
  const recovery = useMemo(() => wellnessAverages(wellness, null), [wellness]);

  const prRows = useMemo(
    () =>
      [...records]
        .filter((r) => (r.rep_max ?? 1) === 1)
        .sort((a, b) => b.weight - a.weight),
    [records],
  );

  const recentHistory = useMemo(
    () => [...history].sort((a, b) => new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime()),
    [history],
  );

  const recentResults = useMemo(
    () => [...results].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()),
    [results],
  );

  const firstMetric = metrics[0];
  const lastMetric = metrics[metrics.length - 1];
  const weightChange =
    firstMetric?.weight_kg != null && lastMetric?.weight_kg != null
      ? lastMetric.weight_kg - firstMetric.weight_kg
      : null;

  const printReport = () => window.print();

  const downloadPdf = () => {
    const lines: string[] = [];
    const add = (text = "") => lines.push(text);
    const section = (text: string) => {
      if (lines.length) add("");
      add(text.toUpperCase());
      add("────────────────────────────────────────────────────────────────");
    };
    const row = (...cells: string[]) => add(cells.join(" | "));
    const longText = (text: string) => {
      const words = text.split(/\\s+/);
      let current = "";
      for (const word of words) {
        if ((current + " " + word).trim().length > 92) {
          if (current) add(current);
          current = word;
        } else {
          current = (current + " " + word).trim();
        }
      }
      if (current) add(current);
    };

    add("RM OR DIE");
    add("INFORME DE ATLETA");
    add(profile?.display_name || "Atleta");
    add(new Date().toLocaleDateString("es-ES"));
    if (profile?.level) add(`Nivel: ${profile.level}`);
    if (profile?.box_name) add(`Box: ${profile.box_name}`);
    if (profile?.crossfit_start_date) add(`CrossFit desde: ${formatDate(profile.crossfit_start_date)}`);

    section("Resumen");
    row("Peso actual", profile?.current_weight_kg != null ? `${profile.current_weight_kg} kg` : "—");
    row("Altura", profile?.height_cm != null ? `${profile.height_cm} cm` : "—");
    row("Entrenamientos", String(stats.sessions ?? 0));
    row("Bloques registrados", String(stats.blocks ?? 0));
    row("Volumen total", stats.volume != null ? `${Math.round(stats.volume)} kg` : "—");
    row("RPE medio", stats.avgRpe != null ? fmtNum(stats.avgRpe) : "—");
    row("Frecuencia semanal", stats.weeklyFreq != null ? `${fmtNum(stats.weeklyFreq)} / sem` : "—");
    row("PRs registrados", String(history.length));

    section("1RM actuales");
    if (prRows.length) prRows.forEach((r) => row(r.exercise, `${r.weight} kg`, formatDate(r.updated_at)));
    else add("Sin registros de 1RM.");

    section("Evolución de fuerza");
    if (recentHistory.length) {
      recentHistory.forEach((r) => row(
        formatDate(r.changed_at),
        r.exercise,
        r.previous_weight != null ? `${r.previous_weight} kg` : "—",
        `${r.new_weight} kg`,
      ));
    } else add("Sin historial de fuerza.");

    section("Composición corporal");
    if (metrics.length) {
      metrics.forEach((m) => row(
        formatDate(m.measured_on),
        m.weight_kg != null ? `${m.weight_kg} kg` : "—",
        m.body_fat_pct != null ? `${m.body_fat_pct}% grasa` : "—",
        m.muscle_mass_kg != null ? `${m.muscle_mass_kg} kg músculo` : "—",
        m.waist_cm != null ? `${m.waist_cm} cm cintura` : "—",
      ));
    } else add("Sin registros de composición corporal.");

    section("Recuperación y bienestar");
    row("Sueño", recovery.sleep != null ? `${fmtNum(recovery.sleep)} h` : "—");
    row("Energía", recovery.energy != null ? fmtNum(recovery.energy) : "—");
    row("Fatiga", recovery.fatigue != null ? fmtNum(recovery.fatigue) : "—");
    row("Dolor", recovery.soreness != null ? fmtNum(recovery.soreness) : "—");
    row("Ánimo", recovery.mood != null ? fmtNum(recovery.mood) : "—");
    if (wellness.length) {
      wellness.forEach((w) => row(
        formatDate(w.logged_on),
        w.sleep_hours != null ? `${w.sleep_hours} h sueño` : "—",
        w.energy != null ? `Energía ${w.energy}` : "—",
        w.fatigue != null ? `Fatiga ${w.fatigue}` : "—",
        w.soreness != null ? `Dolor ${w.soreness}` : "—",
        w.mood != null ? `Ánimo ${w.mood}` : "—",
      ));
    }

    section("Objetivos y hitos");
    if (goals.length) {
      goals.forEach((g) => row(
        g.title,
        g.goal_type,
        g.current_value != null ? `${g.current_value} ${g.unit ?? ""}`.trim() : "—",
        `${g.target_value} ${g.unit ?? ""}`.trim(),
        g.status,
      ));
    } else add("Sin objetivos registrados.");
    if (milestones.length) {
      add("Hitos alcanzados:");
      milestones.forEach((m) => row(m.label, m.achieved_at ? formatDate(m.achieved_at) : "—"));
    }

    section("Entrenamientos registrados");
    if (recentResults.length) {
      recentResults.forEach((r) => row(
        formatDate(r.updated_at),
        `Semana ${r.week}`,
        r.day_key,
        r.block_key,
        r.weight != null ? `${r.weight} kg` : "—",
        r.reps != null ? `${r.reps} reps` : "—",
        r.rpe != null ? `RPE ${fmtNum(r.rpe)}` : "—",
        r.status,
      ));
    } else add("Sin entrenamientos registrados.");

    section("Notas para el entrenador");
    longText("Este informe contiene los datos registrados en RM OR DIE y está pensado como resumen de transferencia para un entrenador.");
    longText("Los 1RM actuales corresponden a registros confirmados en la aplicación. Los entrenamientos reflejan las sesiones que el atleta ha registrado.");
    if (planning?.source_filename) add(`Plan activo: ${planning.source_filename}`);

    const pdf = buildSimplePdf(lines);
    const blob = new Blob([pdf as unknown as BlobPart], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `rmordie-athlete-report-${new Date().toISOString().slice(0, 10)}.pdf`;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  const report = useMemo(
    () =>
      buildCoachReport({
        results,
        records,
        history,
        metrics,
        wellness,
        goals,
        planning: planning?.data,
        weeklyTarget: profile?.weekly_target ?? plannedPerWeek(planning?.data) ?? 4,
        profileWeight: profile?.current_weight_kg ?? null,
        period,
      }),
    [results, records, history, metrics, wellness, goals, planning, profile, period],
  );
  const maxLift = Math.max(1, ...report.lifts.map((l) => l.now));
  const toneColor = (t?: Tone) => (t ? `var(--r-${t})` : "var(--r-muted)");
  const verdictHtml = report.verdictHighlights.reduce(
    (html, h) => html.replace(h, `<b>${h}</b>`),
    report.verdict.replace(/&/g, "&amp;").replace(/</g, "&lt;"),
  );

  return (
    <main className="coach-report min-h-screen">
      <style>{REPORT_CSS}</style>

      <div className="no-print sticky top-0 z-50 flex flex-wrap items-center justify-between gap-2 border-b border-[var(--r-line)] bg-[var(--r-bg)]/95 px-4 py-3 backdrop-blur" style={{ paddingTop: "max(env(safe-area-inset-top), 12px)" }}>
        <button type="button" onClick={() => window.history.back()} className="min-h-11 px-1 text-sm font-semibold text-[var(--r-muted)]">‹ Volver</button>
        <div role="group" aria-label="Periodo del informe" className="flex gap-1 rounded-[12px] bg-[var(--r-line)] p-1">
          {(Object.keys(PERIODS) as ReportPeriod[]).map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={period === p}
              onClick={() => navigate({ search: { periodo: p }, replace: true })}
              className={`min-h-10 rounded-[9px] px-3 text-sm font-bold ${period === p ? "bg-[var(--r-ink)] text-[var(--r-paper)]" : "text-[var(--r-muted)]"}`}
            >
              {PERIODS[p].button}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={printReport} className="min-h-11 rounded-xl bg-[var(--r-ink)] px-4 text-sm font-bold text-[var(--r-paper)]">Guardar PDF / Imprimir</button>
          <button type="button" onClick={downloadPdf} className="min-h-11 rounded-xl border border-[var(--r-line)] px-3 text-sm font-semibold">PDF texto</button>
        </div>
      </div>

      <div className="r-wrap">
        <article className="r-sheet">
          <header className="r-top">
            <div>
              <div className="r-brand">RM OR DIE · Informe para el entrenador</div>
              <h1>{(profile?.display_name || "Atleta").toUpperCase()}</h1>
            </div>
            <div className="r-meta">
              {[profile?.level, profile?.box_name, profile?.crossfit_start_date ? `CrossFit desde ${new Date(profile.crossfit_start_date).getFullYear()}` : null].filter(Boolean).join(" · ")}
              <br />Informe {period === "semana" ? "semanal" : period === "mes" ? "mensual" : "anual"} · {report.periodLabel} · {new Date().toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })}
            </div>
          </header>

          <p className="r-verdict" dangerouslySetInnerHTML={{ __html: verdictHtml }} />
          <ul className="r-notes">
            {report.notes.map((n) => (
              <li key={n.text}><span className="r-dot" style={{ background: toneColor(n.tone) }} /><span>{n.text}</span></li>
            ))}
          </ul>

          <div className="r-kpis">
            {report.kpis.map((k) => (
              <div key={k.label} className="r-kpi">
                <div className="r-num">{k.value}</div>
                <div className="r-l">{k.label}</div>
                {k.delta && <div className="r-d" style={{ color: toneColor(k.tone) }}>{k.delta}</div>}
              </div>
            ))}
          </div>

          <section>
            <h2>Fuerza</h2>
            <p className="r-sub">1RM actual{report.lifts[0]?.bw ? `, relación con su peso corporal (${fmtN(report.lifts[0].bw)} kg)` : ""} y lo que ha subido {PERIODS[period].when}.</p>
            {report.lifts.length ? (
              <>
                {report.lifts.map((l) => {
                  const up = l.now - l.old;
                  return (
                    <div key={l.exercise} className="r-lift">
                      <div className="r-n">{l.exercise}<small>{l.bw ? `× ${fmtN(l.now / l.bw, 2)} · ` : ""}{report.liftAgo(l.lastPr)}</small></div>
                      <div className="r-bar"><i className={up > 0 ? "up" : ""} style={{ width: `${(l.now / maxLift) * 100}%`, ["--old" as string]: `${(l.old / l.now) * 100}%` }} /></div>
                      <div className="r-w"><b>{fmtN(l.now)}</b> kg{up > 0 ? <em>+{fmtN(up)} kg</em> : <em className="same">igual</em>}</div>
                    </div>
                  );
                })}
                <div className="r-legend"><span><i style={{ background: "var(--r-ink)" }} />1RM {period === "semana" ? "hace 7 días" : period === "mes" ? "hace 30 días" : "hace un año"}</span><span><i style={{ background: "var(--r-gold)" }} />Lo que ha subido</span>{report.lifts[0]?.bw ? <span>× = veces su peso corporal</span> : null}</div>
              </>
            ) : <p className="r-empty">Sin 1RM registrados.</p>}
          </section>

          <section className="r-two">
            <div>
              <h2>Constancia</h2>
              <p className="r-sub">
                {period === "semana"
                  ? `Entrenos de cada día. Objetivo: ${report.target} a la semana.`
                  : period === "mes"
                    ? `Entrenos por semana. La línea dorada es su objetivo (${report.target}); en gris, semanas por debajo.`
                    : `Entrenos por mes. La línea dorada es su objetivo (${report.barTarget} al mes); en gris, meses por debajo.`}
              </p>
              {report.bars.some((b) => b.value > 0) ? <BarsChart bars={report.bars} target={report.barTarget} /> : <p className="r-empty">Sin entrenos en este periodo.</p>}
            </div>
            <div>
              <h2>Recuperación</h2>
              <p className="r-sub">{report.recoveryLabel} (del 1 al 10, sueño en horas).</p>
              {report.meters.some((m) => m.value != null) ? (
                <>
                  {report.meters.map((m) => (
                    <div key={m.label} className="r-meter">
                      <span>{m.label}</span>
                      <div className="r-t"><i style={{ width: `${m.value != null ? Math.min(100, (m.value / m.max) * 100) : 0}%`, background: toneColor(m.tone) }} /></div>
                      <span className="r-v">{m.value != null ? `${fmtN(m.value)}${m.unit ? ` ${m.unit}` : " / 10"}` : "—"}</span>
                    </div>
                  ))}
                  <p className="r-sub" style={{ marginTop: 8 }}>Fatiga y dolor: cuanto más bajo, mejor.</p>
                </>
              ) : <p className="r-empty">No ha registrado sueño ni sensaciones.</p>}
            </div>
          </section>

          <section className="r-two">
            <div>
              <h2>Peso corporal</h2>
              <p className="r-sub">
                {report.weight.length ? `${fmtN(report.weight[report.weight.length - 1].kg)} kg ahora` : "Sin registros de peso"}
                {report.weightChange != null ? ` · ${report.weightChange > 0 ? "+" : "−"}${fmtN(Math.abs(report.weightChange))} kg desde ${new Date(`${report.weight[0].date}T12:00:00`).toLocaleDateString("es-ES", { month: "long" })}` : ""}
              </p>
              {report.weight.length > 1 && <WeightChart points={report.weight} />}
            </div>
            <div>
              <h2>Objetivos</h2>
              <p className="r-sub">Progreso hacia lo que se ha marcado.</p>
              {report.goals.length ? report.goals.map((g) => (
                <div key={g.title} className="r-goal">
                  <div className="r-gh"><b>{g.title}</b><span>{g.current} → {g.target}</span></div>
                  <div className="r-t"><i style={{ width: `${g.pct}%`, background: "var(--r-gold)" }} /></div>
                </div>
              )) : <p className="r-empty">Sin objetivos registrados.</p>}
            </div>
          </section>

          <section>
            <h2>Últimos entrenos</h2>
            <p className="r-sub">Lo que ha registrado {PERIODS[period].when}, con cargas y esfuerzo.</p>
            {report.sessions.length ? (
              <div className="r-sessions">
                {report.sessions.map((s) => (
                  <div key={s.date} className="r-ses">
                    <div className="r-sd"><b>{s.date}</b><span>{s.label}</span></div>
                    <ul>{s.rows.map((r, i) => <li key={i}><span>{r.name}</span><span>{r.value}</span></li>)}</ul>
                  </div>
                ))}
              </div>
            ) : <p className="r-empty">Sin entrenos registrados.</p>}
          </section>

          <p className="r-foot">
            Datos registrados por el atleta en RM OR DIE. Los 1RM son marcas confirmadas; la recuperación sale de su registro diario.
            {planning?.source_filename ? ` Plan: ${planning.source_filename}.` : ""}
          </p>
        </article>
      </div>
    </main>
  );
}

function useSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useStateW(0);
  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

function BarsChart({ bars, target }: { bars: { label: string; value: number }[]; target: number | null }) {
  const [ref, W] = useSize<HTMLDivElement>();
  const H = 210, pad = 22, top = 10;
  const maxV = Math.max((target ?? 0) + 1, ...bars.map((b) => b.value), 1);
  const y = (v: number) => top + (H - top - pad) * (1 - v / maxV);
  const bw = W > 0 ? (W - pad) / bars.length : 0;
  const ticks = Array.from(new Set([0, Math.round(maxV / 2), maxV]));
  const every = bw < 26 ? 2 : 1;
  return (
    <div ref={ref} className="r-fig" style={{ height: H }}>
      {W > 0 && (
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={bars.map((b) => `${b.label}: ${b.value}`).join(", ")}>
          {ticks.map((g) => <text key={g} x={0} y={y(g) + 4} fontSize={12} fill="var(--r-muted)">{g}</text>)}
          {bars.map((b, i) => {
            const x = pad + i * bw + bw * 0.18, w = bw * 0.64, ok = target == null ? b.value > 0 : b.value >= target;
            return (
              <g key={i}>
                <rect x={x} y={y(b.value)} width={w} height={Math.max(0, y(0) - y(b.value))} rx={4} fill={ok ? "var(--r-ink)" : "var(--r-muted)"} opacity={ok ? 1 : 0.45} />
                {i % every === every - 1 && <text x={x + w / 2} y={H - 4} fontSize={12} textAnchor="middle" fill="var(--r-muted)">{b.label}</text>}
              </g>
            );
          })}
          {target != null && <line x1={pad} x2={W} y1={y(target)} y2={y(target)} stroke="var(--r-gold)" strokeWidth={2} strokeDasharray="5 4" />}
        </svg>
      )}
    </div>
  );
}

function WeightChart({ points }: { points: { date: string; kg: number }[] }) {
  const [ref, W] = useSize<HTMLDivElement>();
  const H = 180, pad = 30;
  const kgs = points.map((p) => p.kg);
  const lo = Math.floor(Math.min(...kgs) - 0.5), hi = Math.ceil(Math.max(...kgs) + 0.5);
  const x = (i: number) => pad + (W - pad - 8) * (i / Math.max(1, points.length - 1));
  const y = (v: number) => 10 + (H - 34) * (1 - (v - lo) / Math.max(0.1, hi - lo));
  const pts = points.map((p, i) => `${x(i)},${y(p.kg)}`).join(" ");
  const L = points.length - 1;
  const month = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("es-ES", { month: "short" });
  const ticks = Array.from(new Set([lo, Math.round((lo + hi) / 2), hi]));
  return (
    <div ref={ref} className="r-fig" style={{ height: H }}>
      {W > 0 && (
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Evolución del peso corporal">
          {ticks.map((g) => (
            <g key={g}>
              <line x1={pad} x2={W} y1={y(g)} y2={y(g)} stroke="var(--r-line)" />
              <text x={0} y={y(g) + 4} fontSize={12} fill="var(--r-muted)">{g}</text>
            </g>
          ))}
          <polygon points={`${x(0)},${H - 24} ${pts} ${x(L)},${H - 24}`} fill="var(--r-gold-bg)" />
          <polyline points={pts} fill="none" stroke="var(--r-gold)" strokeWidth={3} strokeLinejoin="round" />
          <circle cx={x(L)} cy={y(points[L].kg)} r={5} fill="var(--r-ink)" />
          <text x={pad} y={H - 6} fontSize={12} fill="var(--r-muted)">{month(points[0].date)}</text>
          <text x={W - 4} y={H - 6} fontSize={12} textAnchor="end" fill="var(--r-muted)">{month(points[L].date)}</text>
        </svg>
      )}
    </div>
  );
}

const REPORT_CSS = `
.coach-report{--r-bg:#F6F4EF;--r-paper:#FFFFFF;--r-ink:#141311;--r-muted:#6E6A62;--r-line:#E6E2D9;--r-gold:#9C7F45;--r-gold-bg:#F3ECDD;--r-good:#2F7D4F;--r-warn:#B06A12;--r-bad:#B23A2B;
  background:var(--r-bg);color:var(--r-ink);font-family:var(--font-display),Manrope,system-ui,sans-serif;font-size:16px;line-height:1.55}
.coach-report h1,.coach-report h2,.coach-report .r-num,.coach-report .r-w b{font-family:var(--font-editorial),"Arial Narrow",sans-serif}
.r-wrap{max-width:980px;margin:0 auto;padding:16px max(16px,4vw) 40px}
.r-sheet{background:var(--r-paper);border:1px solid var(--r-line);border-radius:20px;padding:clamp(18px,3.4vw,40px)}
.r-top{display:flex;flex-wrap:wrap;justify-content:space-between;gap:12px;align-items:flex-end;border-bottom:3px solid var(--r-ink);padding-bottom:16px}
.r-brand{font-weight:800;font-size:13px;color:var(--r-muted)}
.coach-report h1{margin:4px 0 0;font-size:clamp(40px,7vw,64px);line-height:.95;font-weight:900}
.r-meta{font-size:14px;color:var(--r-muted);text-align:right}
.r-verdict{margin:22px 0 0;font-size:clamp(20px,2.6vw,26px);line-height:1.3;font-weight:700;text-wrap:balance;max-width:34ch}
.r-verdict b{color:var(--r-gold)}
.r-notes{list-style:none;padding:0;margin:16px 0 0;display:grid;gap:8px}
.r-notes li{display:flex;gap:10px;align-items:baseline;font-size:15px}
.r-dot{width:10px;height:10px;border-radius:50%;flex:none;transform:translateY(1px)}
.r-kpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;margin-top:26px}
.r-kpi{background:var(--r-bg);border-radius:14px;padding:12px 14px}
.r-num{font-size:clamp(30px,4vw,40px);font-weight:800;line-height:1}
.r-l{font-size:13px;color:var(--r-muted)}.r-d{font-size:13px;font-weight:700}
.coach-report section{margin-top:34px}
.coach-report h2{font-size:30px;line-height:1.05;margin:0;font-weight:800}
.r-sub{color:var(--r-muted);font-size:14px;margin:2px 0 14px}
.r-empty{color:var(--r-muted);font-size:14px;border:1px dashed var(--r-line);border-radius:12px;padding:14px}
.r-lift{display:grid;grid-template-columns:10.5em minmax(0,1fr) 5.5em;gap:10px;align-items:center;padding:7px 0;border-bottom:1px solid var(--r-line)}
.r-n{font-weight:700;font-size:15px}.r-n small{display:block;color:var(--r-muted);font-weight:500;font-size:13px}
.r-bar{position:relative;height:26px;background:var(--r-bg);border-radius:8px;overflow:hidden}
.r-bar i{position:absolute;inset:0 auto 0 0;background:var(--r-ink);border-radius:8px}
.r-bar i.up{background:linear-gradient(90deg,var(--r-ink) 0 var(--old),var(--r-gold) var(--old))}
.r-w{text-align:right}.r-w b{font-size:26px;font-weight:800}
.r-w em{display:block;font-style:normal;font-size:13px;font-weight:700;color:var(--r-good)}.r-w em.same{color:var(--r-muted);font-weight:500}
.r-legend{display:flex;gap:16px;flex-wrap:wrap;font-size:13px;color:var(--r-muted);margin-top:10px}
.r-legend i{display:inline-block;width:14px;height:10px;border-radius:3px;margin-right:6px;vertical-align:middle}
.r-two{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,1fr);gap:28px}
.r-fig{position:relative}.r-fig svg{position:absolute;inset:0;width:100%;height:100%}
.r-meter{display:grid;grid-template-columns:5.5em minmax(0,1fr) 4.5em;gap:10px;align-items:center;padding:6px 0}
.r-t{height:10px;background:var(--r-bg);border-radius:6px;overflow:hidden}.r-t i{display:block;height:100%;border-radius:6px}
.r-v{text-align:right;font-weight:700;font-size:15px;white-space:nowrap}
.r-goal{padding:10px 0;border-bottom:1px solid var(--r-line)}.r-goal .r-t{margin-top:6px;height:8px}
.r-gh{display:flex;justify-content:space-between;gap:10px;font-size:15px}.r-gh span{color:var(--r-muted);white-space:nowrap}
.r-sessions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.r-ses{border:1px solid var(--r-line);border-radius:14px;padding:12px 14px;break-inside:avoid}
.r-sd{display:flex;justify-content:space-between;gap:8px;font-size:13px;color:var(--r-muted)}.r-sd b{color:var(--r-ink);font-size:15px;text-transform:capitalize}
.r-ses ul{margin:6px 0 0;padding:0;list-style:none;font-size:14px}
.r-ses li{display:flex;justify-content:space-between;gap:10px;padding:2px 0}
.r-ses li span:first-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.r-ses li span:last-child{font-weight:700;white-space:nowrap}
.r-foot{margin-top:30px;font-size:13px;color:var(--r-muted);border-top:1px solid var(--r-line);padding-top:12px}
@media(max-width:760px){.r-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.r-kpis .r-kpi:last-child{grid-column:1/-1}.r-two,.r-sessions{grid-template-columns:minmax(0,1fr)}.r-meta{text-align:left}}
@media(max-width:560px){.r-lift{grid-template-columns:minmax(0,1fr) auto;grid-template-areas:"n w" "b b";row-gap:6px}.r-n{grid-area:n}.r-w{grid-area:w;white-space:nowrap}.r-w em{display:inline;margin-left:6px}.r-bar{grid-area:b;height:16px}}
@media print{@page{size:A4;margin:12mm}.no-print{display:none!important}.coach-report{background:#fff}.r-wrap{padding:0;max-width:none}.r-sheet{border:0;padding:0}.coach-report section{break-inside:avoid}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
`;

function buildSimplePdf(lines: string[]): Uint8Array {
  const PAGE_WIDTH = 595;
  const PAGE_HEIGHT = 842;
  const LEFT = 42;
  const TOP = 800;
  const BOTTOM = 42;
  const LINE_HEIGHT = 13;
  const MAX_LINES = Math.floor((TOP - BOTTOM) / LINE_HEIGHT);

  const pages: string[][] = [];
  for (let i = 0; i < lines.length; i += MAX_LINES) {
    pages.push(lines.slice(i, i + MAX_LINES));
  }
  if (!pages.length) pages.push(["RM OR DIE"]);

  const encodeWinAnsi = (text: string) => {
    const map: Record<string, number> = {
      "á": 0xE1, "é": 0xE9, "í": 0xED, "ó": 0xF3, "ú": 0xFA,
      "ü": 0xFC, "ñ": 0xF1, "Á": 0xC1, "É": 0xC9, "Í": 0xCD,
      "Ó": 0xD3, "Ú": 0xDA, "Ü": 0xDC, "Ñ": 0xD1, "¿": 0xBF,
      "¡": 0xA1, "€": 0x80, "·": 0xB7, "—": 0x97,
    };
    const bytes: number[] = [];
    for (const char of text) {
      const code = char.charCodeAt(0);
      if (code <= 0x7F) bytes.push(code);
      else if (map[char] != null) bytes.push(map[char]);
      else bytes.push(0x3F);
    }
    return bytes.map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
  };

  const objects: string[] = [];
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";

  const pageIds: number[] = [];
  pages.forEach((pageLines, pageIndex) => {
    const pageId = 4 + pageIndex * 2;
    const contentId = pageId + 1;
    pageIds.push(pageId);
    const content = [
      "BT",
      "/F1 9 Tf",
      `${LEFT} ${TOP} Td`,
      ...pageLines.map((line, index) => {
        const prefix = index === 0 ? "" : `0 -${LINE_HEIGHT} Td\n`;
        return `${prefix}<${encodeWinAnsi(line)}> Tj`;
      }),
      "ET",
    ].join("\n");
    objects[contentId] = `<< /Length ${content.length} >>\nstream\n${content}\nendstream`;
    objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`;
  });

  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;

  let pdf = "%PDF-1.4\n%RMOR\n";
  const offsets: number[] = [0];
  for (let i = 1; i < objects.length; i++) {
    if (!objects[i]) continue;
    offsets[i] = pdf.length;
    pdf += `${i} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let i = 1; i < objects.length; i++) {
    pdf += `${String(offsets[i] ?? 0).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return new TextEncoder().encode(pdf);
}

function formatDate(value: string) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString("es-ES");
}
