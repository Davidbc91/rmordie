import { useMemo } from "react";
import { Activity } from "lucide-react";
import {
  windowStats,
  streaks,
  exerciseStats,
  bodyChange,
  wellnessAverages,
  fmtKg,
  fmtNum,
} from "@/lib/analytics";
import { Card, Stat, Empty, MonoChart } from "./shared";

export function ProgressSection({ results, history, records, metrics, plannedDays, completedSessions, days, rangeLabel, goStrength, wellness }: any) {
  const cur = windowStats(results, history, days);
  const prev = windowStats(results, history, days, true);
  const s = streaks(results);
  const body = bodyChange(metrics);
  const completion = plannedDays ? Math.min(100, Math.round((completedSessions / plannedDays) * 100)) : null;

  const volumeSeries = useMemo(() => {
    const bucketDays = days == null ? 28 : days <= 28 ? 7 : 14;
    const count = days == null ? 8 : Math.min(8, Math.max(4, Math.ceil(days / bucketDays)));
    const now = Date.now();

    return Array.from({ length: count }, (_, index) => {
      const end = now - (count - 1 - index) * bucketDays * 864e5;
      const start = end - bucketDays * 864e5;
      const volume = results
        .filter((r: any) => r.status === "completed")
        .filter((r: any) => {
          const t = new Date(r.updated_at).getTime();
          return t >= start && t < end;
        })
        .reduce(
          (sum: number, r: any) =>
            sum + Number(r.weight ?? 0) * Number(r.sets ?? 1) * Number(r.reps ?? 0),
          0,
        );

      return {
        label: new Date(end).toLocaleDateString("es-ES", { day: "2-digit", month: "short" }),
        value: Math.round(volume),
      };
    });
  }, [results, days]);

  const strengthProgress = useMemo(
    () =>
      exerciseStats(records, history, days)
        .filter((item) => item.changePct != null)
        .sort((a, b) => Math.abs(b.changePct ?? 0) - Math.abs(a.changePct ?? 0))
        .slice(0, 3),
    [records, history, days],
  );

  const movementTrends = useMemo(() => {
    const stats = exerciseStats(records, history, days).filter((item) => item.changePct != null);
    const classify = (pct: number) => pct >= 2.5 ? "up" as const : pct <= -2.5 ? "down" as const : "stable" as const;
    return {
      up: stats.filter((item) => classify(item.changePct ?? 0) === "up").sort((a, b) => (b.changePct ?? 0) - (a.changePct ?? 0)).slice(0, 3),
      stable: stats.filter((item) => classify(item.changePct ?? 0) === "stable").slice(0, 3),
      down: stats.filter((item) => classify(item.changePct ?? 0) === "down").sort((a, b) => (a.changePct ?? 0) - (b.changePct ?? 0)).slice(0, 3),
      total: stats.length,
    };
  }, [records, history, days]);

  const intelligence = useMemo(() => {
    const recent = windowStats(results, history, 28);
    const prior = windowStats(results, history, 28, true);
    const recentWellness = wellnessAverages(wellness, 28);
    const trainingLoadHigh = recent.avgRpe != null && recent.avgRpe >= 8.5 && recent.sessions >= 3;
    const volumeRising = prior.volume > 0 && recent.volume > prior.volume * 1.1;
    const recoveryLimited = recentWellness && (
      (recentWellness.sleep != null && recentWellness.sleep < 6.5) ||
      (recentWellness.energy != null && recentWellness.energy <= 4)
    );
    const topUp = movementTrends.up[0];
    const topDown = movementTrends.down[0];
    const signals: { label: string; text: string; tone: "positive" | "attention" | "neutral" }[] = [];

    if (topUp) {
      signals.push({
        label: "Progresión",
        text: `${topUp.exercise} muestra una mejora reciente del ${Math.abs(topUp.changePct ?? 0).toFixed(1)}%.`,
        tone: "positive",
      });
    }
    if (trainingLoadHigh || (volumeRising && recent.avgRpe != null && recent.avgRpe >= 8)) {
      signals.push({
        label: "Carga",
        text: `Has acumulado una carga reciente elevada: ${recent.sessions} sesiones en 28 días y RPE medio ${fmtNum(recent.avgRpe ?? 0)}.`,
        tone: "attention",
      });
    }
    if (recoveryLimited) {
      signals.push({
        label: "Recuperación",
        text: "Tus últimos registros de recuperación muestran margen de mejora en sueño o energía.",
        tone: "attention",
      });
    }
    if (topDown) {
      signals.push({
        label: "Movimiento a vigilar",
        text: `${topDown.exercise} está un ${Math.abs(topDown.changePct ?? 0).toFixed(1)}% por debajo de su referencia reciente.`,
        tone: "attention",
      });
    }
    if (signals.length === 0) {
      signals.push({
        label: "Estado",
        text: "No aparece un patrón dominante con los datos disponibles. Sigue registrando sesiones para aumentar la precisión.",
        tone: "neutral",
      });
    }

    return {
      recent,
      recentWellness,
      signals: signals.slice(0, 3),
    };
  }, [results, history, wellness, movementTrends]);

  const volumeChange = prev.volume > 0 ? ((cur.volume - prev.volume) / prev.volume) * 100 : null;
  const rpeChange =
    prev.avgRpe != null && cur.avgRpe != null ? cur.avgRpe - prev.avgRpe : null;

  const summary = (() => {
    const parts: string[] = [];

    if (volumeChange != null) {
      parts.push(
        `Has acumulado ${Math.round(cur.volume).toLocaleString("es-ES")} kg, un ${Math.abs(Math.round(volumeChange))}% ${volumeChange >= 0 ? "más" : "menos"} que en el periodo anterior.`,
      );
    } else if (cur.volume > 0) {
      parts.push(
        `Has acumulado ${Math.round(cur.volume).toLocaleString("es-ES")} kg en ${rangeLabel.toLowerCase()}.`,
      );
    }

    if (cur.avgRpe != null) {
      parts.push(`Tu RPE medio es ${fmtNum(cur.avgRpe)}.`);
    }

    const improving = strengthProgress.find((item) => (item.changePct ?? 0) > 0);
    if (improving) {
      parts.push(
        `${improving.exercise} ha mejorado un ${Math.abs(improving.changePct ?? 0).toFixed(1)}%.`,
      );
    }

    return parts.slice(0, 3).join(" ");
  })();

  if (cur.sessions === 0 && metrics.length === 0) {
    return <Empty text="Registra entrenamientos y datos corporales para activar tu análisis de progreso." />;
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="cinematic-label">ANÁLISIS DEL ENTRENAMIENTO</p>
            <h2 className="mt-2 text-xl font-semibold">Lectura de tu entrenamiento</h2>
          </div>
          <Activity className="h-5 w-5 text-gold" />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Stat label="Sesiones · 28d" value={String(intelligence.recent.sessions)} />
          <Stat label="RPE medio" value={intelligence.recent.avgRpe != null ? fmtNum(intelligence.recent.avgRpe) : "—"} />
        </div>
        <div className="mt-4 space-y-2">
          {intelligence.signals.map((signal) => (
            <div key={signal.label} className="rounded-2xl border border-white/[.07] bg-black/20 p-4">
              <div className="text-xs uppercase tracking-[0.12em] text-muted-foreground">{signal.label}</div>
              <p className="mt-1.5 text-sm leading-relaxed">{signal.text}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-[13px] leading-relaxed text-muted-foreground">
          Análisis descriptivo basado en tus entrenamientos y registros de recuperación. No modifica tu planificación.
        </p>
      </Card>

      <Card>
        <p className="text-xs uppercase tracking-[0.12em]" style={{ color: "#6F6F6F" }}>
          Resumen del periodo
        </p>
        <p className="mt-3 text-base leading-relaxed">
          {summary || "Todavía no hay suficientes datos para generar un resumen automático."}
        </p>
      </Card>

      <Card>
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.12em]" style={{ color: "#6F6F6F" }}>
              Volumen de entrenamiento
            </p>
            <p className="mt-1 text-2xl font-semibold tabular">
              {cur.volume ? `${Math.round(cur.volume).toLocaleString("es-ES")} kg` : "—"}
            </p>
          </div>
          {volumeChange != null && (
            <div className="text-right text-xs font-semibold">
              {volumeChange >= 0 ? "+" : ""}{Math.round(volumeChange)}%
              <div className="font-normal text-muted-foreground">vs periodo anterior</div>
            </div>
          )}
        </div>
        <div className="mt-4">
          <MonoChart data={volumeSeries} />
        </div>
        <p className="mt-2 text-[13px] text-muted-foreground">
          Evolución del volumen registrado en {rangeLabel.toLowerCase()}.
        </p>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Stat label="Sesiones" value={String(cur.sessions)} sub={`antes: ${prev.sessions}`} />
        <Stat label="Frecuencia" value={cur.weeklyFreq != null ? fmtNum(cur.weeklyFreq) : "—"} sub="sesiones/sem" />
        <Stat label="RPE medio" value={cur.avgRpe != null ? fmtNum(cur.avgRpe) : "—"} sub={rpeChange != null ? `Δ ${rpeChange >= 0 ? "+" : ""}${fmtNum(rpeChange)}` : undefined} />
        <Stat label="Horas" value={cur.hours ? fmtNum(cur.hours) : "—"} />
        <Stat label="PRs" value={String(cur.prs)} sub={prev.prs ? `antes: ${prev.prs}` : undefined} />
        <Stat label="Cumplimiento" value={completion != null ? `${completion}%` : "—"} sub={plannedDays ? `de ${plannedDays} días planificados` : undefined} />
      </div>

      <Card>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.12em]" style={{ color: "#6F6F6F" }}>
              Fuerza
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Movimientos con evolución registrada</p>
          </div>
          <button type="button" onClick={goStrength} className="text-xs font-semibold text-gold">
            Ver fuerza
          </button>
        </div>

        {strengthProgress.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Necesitas más registros de RM para ver progresión.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {strengthProgress.map((item) => (
              <div key={item.exercise} className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{item.exercise}</p>
                  <p className="mt-1 text-[13px] text-muted-foreground">
                    {item.currentPr != null ? `${fmtNum(item.currentPr)} kg actual` : "Sin 1RM confirmado"}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold">
                    {item.changePct != null ? `${item.changePct >= 0 ? "+" : ""}${item.changePct.toFixed(1)}%` : "—"}
                  </p>
                  <p className="text-[13px] text-muted-foreground">evolución</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.12em]" style={{ color: "#6F6F6F" }}>
              Tendencias por movimiento
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Evolución reciente de tus RM y 1RM estimados.
            </p>
          </div>
          <span className="text-[13px] text-muted-foreground">{movementTrends.total} con historial</span>
        </div>
        {movementTrends.total === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">Necesitas más registros para detectar tendencias.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {[
              { label: "Progresando", items: movementTrends.up },
              { label: "Estables", items: movementTrends.stable },
              { label: "A vigilar", items: movementTrends.down },
            ].map((group) => (
              <div key={group.label} className="rounded-2xl border border-border bg-surface p-3.5">
                <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">{group.label}</p>
                {group.items.length === 0 ? (
                  <p className="mt-2 text-xs text-muted-foreground">Sin movimientos en esta categoría.</p>
                ) : (
                  <div className="mt-2 space-y-2">
                    {group.items.map((item) => (
                      <div key={item.exercise} className="flex items-center justify-between gap-3">
                        <span className="min-w-0 truncate text-sm font-medium">{item.exercise}</span>
                        <span className="shrink-0 text-xs font-semibold">
                          {item.changePct! >= 0 ? "+" : ""}{item.changePct!.toFixed(1)}%
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Stat label="Racha actual" value={`${s.current} d`} />
        <Stat label="Racha máxima" value={`${s.best} d`} />
        <Stat label="Volumen" value={cur.volume ? `${Math.round(cur.volume).toLocaleString("es-ES")} kg` : "—"} />
        <Stat label="Bloques" value={String(cur.blocks)} />
      </div>

      <Card>
        <p className="text-xs uppercase tracking-[0.12em]" style={{ color: "#6F6F6F" }}>
          Cambios corporales
        </p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Stat label="Peso actual" value={body.current != null ? fmtKg(body.current) : "—"} />
          <Stat label="Cambio total" value={body.change != null ? `${body.change >= 0 ? "+" : ""}${fmtNum(body.change)} kg` : "—"} sub="desde primer registro" />
        </div>
      </Card>
    </div>
  );
}
/* ---------------- 4. Performance + Athlete status + Progression ---------------- */
