import { roundToPlates } from "@/lib/plates";
import { loadsForPercentages, formatKg } from "@/lib/rm-matcher";
import { Sparkles } from "lucide-react";
import { useState } from "react";

export function PercentAssistant({ percentages, settings, record }: {
  percentages: number[];
  settings: import("@/lib/store").AppSettings;
  record: import("@/lib/store").PersonalRecord | null;
}) {
  const [oneRm, setOneRm] = useState<string>("");
  const cfg = { bars: settings.bar_weights, plates: settings.plate_weights };
  const manualRm = Number(oneRm);

  // Automatic mode: exercise detected in the planning and RM found in records.
  if (record) {
    const loads = loadsForPercentages(record.weight, percentages);
    return (
      <div className="mt-4 rounded-[var(--r-md)] border border-[rgba(216,180,107,0.3)] bg-[rgba(216,180,107,0.06)] p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-medium text-gold">
            <Sparkles className="h-3.5 w-3.5" /> Cargas según tu RM
          </div>
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {record.exercise} · RM {formatKg(record.weight)} kg
          </span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {loads.map((l) => (
            <div key={l.pct} className="glass-quiet px-3 py-2 text-xs text-foreground">
              <span className="text-muted-foreground">{l.pct}%</span>
              <span className="mx-2 text-muted-foreground/50">→</span>
              <span className="font-semibold text-gold tabular">{formatKg(l.suggested)} kg</span>
              <span className="ml-1 text-muted-foreground/60">({l.exact.toFixed(1)})</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-[var(--r-md)] border border-[rgba(216,180,107,0.3)] bg-[rgba(216,180,107,0.06)] p-4">
      <div className="flex items-center gap-2 text-xs font-medium text-gold">
        <Sparkles className="h-3.5 w-3.5" /> Asistente de %
      </div>
      <p className="mt-1.5 text-[11px] text-muted-foreground">RM no disponible para este ejercicio</p>
      <div className="mt-3 flex items-center gap-2">
        <input
          type="text"
          inputMode="decimal"
          placeholder="Tu 1RM (kg)"
          value={oneRm}
          onChange={(e) => setOneRm(e.target.value)}
          className="tap w-32 rounded-[var(--r-md)] border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] px-3.5 py-3 text-[15px] text-foreground tabular outline-none placeholder:text-muted-foreground/70 focus:border-[rgba(216,180,107,0.55)]"
        />
        <span className="text-xs text-muted-foreground">→ peso recomendado, redondeado a tus discos</span>
      </div>
      {manualRm > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {percentages.map((p) => {
            const target = (manualRm * p) / 100;
            const rec = roundToPlates(target, cfg);
            return (
              <div key={p} className="glass-quiet px-3 py-2 text-xs text-foreground">
                <span className="text-muted-foreground">{p}%</span>
                <span className="mx-2 text-muted-foreground/50">·</span>
                <span className="font-semibold text-foreground tabular">{rec} kg</span>
                <span className="ml-1 text-muted-foreground/60">({target.toFixed(1)})</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
