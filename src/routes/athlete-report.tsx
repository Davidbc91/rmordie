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
import { windowStats, wellnessAverages, fmtNum } from "@/lib/analytics";

export const Route = createFileRoute("/athlete-report")({
  component: AthleteReport,
});

function AthleteReport() {
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

    section("Recovery y bienestar");
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

  return (
    <main className="min-h-screen bg-white text-[#111]">
      <style>{`
        @media print {
          @page { size: A4; margin: 14mm; }
          .no-print { display: none !important; }
          body { background: white !important; }
          .report-page { box-shadow: none !important; }
          .break-before { break-before: page; }
          .avoid-break { break-inside: avoid; }
        }
      `}</style>

      <div className="no-print sticky top-0 z-50 flex items-center justify-between border-b bg-white/95 px-4 py-3 backdrop-blur">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-neutral-500">RM OR DIE</p>
          <p className="text-sm font-semibold">Informe para entrenador</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={downloadPdf}
            className="rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white"
          >
            Descargar PDF
          </button>
          <button
            onClick={printReport}
            className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-semibold"
          >
            Imprimir
          </button>
        </div>
      </div>

      <div className="report-page mx-auto max-w-[900px] px-5 py-8">
        <header className="border-b-2 border-black pb-6">
          <div className="flex items-start justify-between gap-6">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-neutral-500">RM OR DIE · ATHLETE REPORT</p>
              <h1 className="mt-3 text-4xl font-bold tracking-tight">{profile?.display_name || "Atleta"}</h1>
              <p className="mt-2 text-sm text-neutral-600">
                Informe generado el {new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" })}
              </p>
            </div>
            <div className="text-right text-sm text-neutral-600">
              {profile?.level && <div>{profile.level}</div>}
              {profile?.box_name && <div>{profile.box_name}</div>}
              {profile?.crossfit_start_date && <div>CrossFit desde {formatDate(profile.crossfit_start_date)}</div>}
            </div>
          </div>
        </header>

        <Section title="Resumen del atleta">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Kpi label="Peso actual" value={profile?.current_weight_kg != null ? `${profile.current_weight_kg} kg` : "—"} />
            <Kpi label="Altura" value={profile?.height_cm != null ? `${profile.height_cm} cm` : "—"} />
            <Kpi label="Entrenamientos" value={String(stats.sessions ?? 0)} />
            <Kpi label="Bloques registrados" value={String(stats.blocks ?? 0)} />
            <Kpi label="Volumen total" value={stats.volume != null ? `${Math.round(stats.volume).toLocaleString("es-ES")} kg` : "—"} />
            <Kpi label="RPE medio" value={stats.avgRpe != null ? fmtNum(stats.avgRpe) : "—"} />
            <Kpi label="Frecuencia" value={stats.weeklyFreq != null ? `${fmtNum(stats.weeklyFreq)} / sem` : "—"} />
            <Kpi label="PRs registrados" value={String(history.length)} />
          </div>
          {profile?.goals?.length ? (
            <p className="mt-4 text-sm"><strong>Objetivos:</strong> {profile.goals.join(", ")}</p>
          ) : null}
        </Section>

        <Section title="1RM actuales" className="break-before">
          {prRows.length ? (
            <Table
              headers={["Movimiento", "1RM", "Actualizado"]}
              rows={prRows.map((r) => [r.exercise, `${r.weight} kg`, formatDate(r.updated_at)])}
            />
          ) : <Empty />}
        </Section>

        <Section title="Evolución de fuerza">
          {recentHistory.length ? (
            <Table
              headers={["Fecha", "Movimiento", "Anterior", "Nuevo"]}
              rows={recentHistory.map((r) => [
                formatDate(r.changed_at),
                r.exercise,
                r.previous_weight != null ? `${r.previous_weight} kg` : "—",
                `${r.new_weight} kg`,
              ])}
            />
          ) : <Empty />}
        </Section>

        <Section title="Composición corporal">
          {metrics.length ? (
            <>
              <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Kpi label="Primer peso" value={firstMetric?.weight_kg != null ? `${firstMetric.weight_kg} kg` : "—"} />
                <Kpi label="Peso actual" value={lastMetric?.weight_kg != null ? `${lastMetric.weight_kg} kg` : "—"} />
                <Kpi label="Cambio" value={weightChange != null ? `${weightChange > 0 ? "+" : ""}${weightChange.toFixed(1)} kg` : "—"} />
                <Kpi label="Registros" value={String(metrics.length)} />
              </div>
              <Table
                headers={["Fecha", "Peso", "% grasa", "Músculo", "Cintura"]}
                rows={metrics.slice(-20).reverse().map((m) => [
                  formatDate(m.measured_on),
                  m.weight_kg != null ? `${m.weight_kg} kg` : "—",
                  m.body_fat_pct != null ? `${m.body_fat_pct}%` : "—",
                  m.muscle_mass_kg != null ? `${m.muscle_mass_kg} kg` : "—",
                  m.waist_cm != null ? `${m.waist_cm} cm` : "—",
                ])}
              />
            </>
          ) : <Empty />}
        </Section>

        <Section title="Recovery y bienestar">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <Kpi label="Sueño" value={recovery.sleep != null ? `${fmtNum(recovery.sleep)} h` : "—"} />
            <Kpi label="Energía" value={recovery.energy != null ? fmtNum(recovery.energy) : "—"} />
            <Kpi label="Fatiga" value={recovery.fatigue != null ? fmtNum(recovery.fatigue) : "—"} />
            <Kpi label="Dolor" value={recovery.soreness != null ? fmtNum(recovery.soreness) : "—"} />
            <Kpi label="Ánimo" value={recovery.mood != null ? fmtNum(recovery.mood) : "—"} />
          </div>
          {wellness.length ? (
            <Table
              headers={["Fecha", "Sueño", "Energía", "Fatiga", "Dolor", "Ánimo"]}
              rows={wellness.slice(-20).reverse().map((w) => [
                formatDate(w.logged_on),
                w.sleep_hours != null ? `${w.sleep_hours} h` : "—",
                w.energy != null ? String(w.energy) : "—",
                w.fatigue != null ? String(w.fatigue) : "—",
                w.soreness != null ? String(w.soreness) : "—",
                w.mood != null ? String(w.mood) : "—",
              ])}
            />
          ) : null}
        </Section>

        <Section title="Objetivos y hitos">
          {goals.length ? (
            <Table
              headers={["Objetivo", "Tipo", "Actual", "Objetivo", "Estado"]}
              rows={goals.map((g) => [
                g.title,
                g.goal_type,
                g.current_value != null ? `${g.current_value} ${g.unit ?? ""}` : "—",
                `${g.target_value} ${g.unit ?? ""}`,
                g.status,
              ])}
            />
          ) : <Empty text="Sin objetivos registrados." />}
          {milestones.length ? (
            <div className="mt-5">
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-neutral-500">Hitos alcanzados</p>
              <ul className="grid grid-cols-1 gap-1 text-sm sm:grid-cols-2">
                {milestones.map((m) => <li key={m.id}>✓ {m.label}{m.achieved_at ? ` · ${formatDate(m.achieved_at)}` : ""}</li>)}
              </ul>
            </div>
          ) : null}
        </Section>

        <Section title="Entrenamientos registrados" className="break-before">
          {recentResults.length ? (
            <Table
              headers={["Fecha", "Semana", "Día", "Bloque", "Carga", "Reps", "RPE", "Estado"]}
              rows={recentResults.map((r) => [
                formatDate(r.updated_at),
                String(r.week),
                r.day_key,
                r.block_key,
                r.weight != null ? `${r.weight} kg` : "—",
                r.reps != null ? String(r.reps) : "—",
                r.rpe != null ? fmtNum(r.rpe) : "—",
                r.status,
              ])}
            />
          ) : <Empty text="Sin entrenamientos registrados." />}
        </Section>

        <Section title="Notas para el entrenador">
          <div className="min-h-[130px] rounded-xl border border-dashed border-neutral-300 p-4 text-sm text-neutral-500">
            Espacio reservado para observaciones, prioridades técnicas y objetivos del siguiente bloque.
          </div>
          <p className="mt-4 text-[10px] leading-relaxed text-neutral-500">
            Este informe se genera con los datos registrados en RM OR DIE. Los 1RM mostrados como actuales son los registros confirmados guardados en la aplicación. Los datos de entrenamiento reflejan las sesiones que has registrado.
          </p>
        </Section>

        <footer className="mt-8 border-t pt-4 text-[10px] text-neutral-400">
          RM OR DIE · Informe de atleta · {planning?.source_filename ? `Plan activo: ${planning.source_filename}` : "Sin plan activo"}
        </footer>
      </div>
    </main>
  );
}


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

function Section({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`mt-8 ${className}`}>
      <h2 className="mb-3 border-b border-neutral-200 pb-2 text-sm font-bold uppercase tracking-[0.16em]">{title}</h2>
      {children}
    </section>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
      <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-neutral-500">{label}</p>
      <p className="mt-1 text-lg font-bold tabular-nums">{value}</p>
    </div>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="bg-neutral-100 text-left">
            {headers.map((h) => <th key={h} className="px-2 py-2 font-semibold">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-neutral-200">
              {row.map((cell, j) => <td key={j} className="px-2 py-2 align-top">{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Empty({ text = "Sin datos registrados." }: { text?: string }) {
  return <p className="rounded-xl border border-dashed border-neutral-300 p-4 text-sm text-neutral-500">{text}</p>;
}

function formatDate(value: string) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString("es-ES");
}
