import { useMemo, useState } from "react";
import { Calculator, ChevronDown } from "lucide-react";
import { roundToPlates } from "@/lib/plates";
import { formatKg } from "@/lib/rm-matcher";
import type { AppSettings, PersonalRecord } from "@/lib/store";

const QUICK_PCTS = [50, 55, 60, 65, 70, 75, 80, 85, 90, 95];

/**
 * Calculadora de % del RM disponible en todos los días de entreno.
 * Eliges un ejercicio de tus RM (o escribes un RM a mano) y ves el peso de
 * cada porcentaje, redondeado a tus barras y discos de Ajustes.
 */
export function RmCalculator({ records, settings }: { records: PersonalRecord[]; settings: AppSettings | undefined }) {
  const [open, setOpen] = useState(false);
  const [recordId, setRecordId] = useState<string>("");
  const [manual, setManual] = useState("");
  const [customPct, setCustomPct] = useState("");

  const sorted = useMemo(
    () => [...records].sort((a, b) => a.exercise.localeCompare(b.exercise, "es") || (a.rep_max ?? 1) - (b.rep_max ?? 1)),
    [records],
  );
  const selected = sorted.find((r) => r.id === recordId) ?? null;
  const manualRm = Number(manual.replace(",", "."));
  const rm = selected ? Number(selected.weight) : Number.isFinite(manualRm) && manualRm > 0 ? manualRm : 0;
  const cfg = settings ? { bars: settings.bar_weights, plates: settings.plate_weights } : undefined;
  const custom = Number(customPct.replace(",", "."));
  const pcts = [...QUICK_PCTS, ...(custom >= 1 && custom <= 120 && !QUICK_PCTS.includes(custom) ? [custom] : [])].sort((a, b) => a - b);

  return (
    <div className="mb-3 overflow-hidden rounded-[18px] border border-white/[0.1] bg-white/[0.045]">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-14 w-full items-center gap-3 px-4 text-left"
      >
        <Calculator className="h-[18px] w-[18px] shrink-0 text-gold" />
        <span className="flex-1 text-[15px] font-semibold">Calculadora de % del RM</span>
        <ChevronDown className={`h-[18px] w-[18px] shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="space-y-3 px-4 pb-4">
          <label className="block">
            <span className="mb-1.5 block text-[13px] text-muted-foreground">Ejercicio</span>
            <select
              value={recordId}
              onChange={(e) => setRecordId(e.target.value)}
              className="min-h-12 w-full rounded-[14px] border border-white/[0.14] bg-white/[0.06] px-3 text-[15px] outline-none focus:border-[color:var(--gold)]/60"
            >
              <option value="">Escribir el RM a mano</option>
              {sorted.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.exercise} · {r.rep_max ?? 1}RM {formatKg(Number(r.weight))} kg
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-2.5">
            {!selected && (
              <label className="block">
                <span className="mb-1.5 block text-[13px] text-muted-foreground">Tu RM (kg)</span>
                <input
                  inputMode="decimal"
                  value={manual}
                  onChange={(e) => setManual(e.target.value)}
                  placeholder="100"
                  className="min-h-12 w-full rounded-[14px] border border-white/[0.14] bg-white/[0.06] px-3.5 text-xl font-semibold tabular outline-none placeholder:text-sm placeholder:font-normal focus:border-[color:var(--gold)]/60"
                />
              </label>
            )}
            <label className="block">
              <span className="mb-1.5 block text-[13px] text-muted-foreground">Otro %</span>
              <input
                inputMode="decimal"
                value={customPct}
                onChange={(e) => setCustomPct(e.target.value)}
                placeholder="72,5"
                className="min-h-12 w-full rounded-[14px] border border-white/[0.14] bg-white/[0.06] px-3.5 text-xl font-semibold tabular outline-none placeholder:text-sm placeholder:font-normal focus:border-[color:var(--gold)]/60"
              />
            </label>
          </div>

          {rm > 0 ? (
            <div className="grid grid-cols-2 gap-2">
              {pcts.map((p) => {
                const exact = (rm * p) / 100;
                const rounded = cfg ? roundToPlates(exact, cfg) : Math.round(exact * 2) / 2;
                return (
                  <div
                    key={p}
                    className={`flex items-baseline justify-between rounded-[12px] px-3 py-2.5 ${p === custom ? "bg-[color:var(--gold)]/15" : "bg-black/25"}`}
                  >
                    <span className="text-[13px] text-muted-foreground">{p} %</span>
                    <span className="metric text-[1.5rem] leading-none">
                      {formatKg(rounded)} <span className="font-sans text-xs font-medium text-muted-foreground">kg</span>
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-[13px] text-muted-foreground">Elige un ejercicio o escribe tu RM para ver los pesos.</p>
          )}
          <p className="text-xs text-muted-foreground">Redondeado a tus barras y discos (Ajustes).</p>
        </div>
      )}
    </div>
  );
}
