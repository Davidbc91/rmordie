import { usePersonalRecordHistory } from "@/lib/store";
import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

export function Sparkline({ exercise, repMax }: { exercise: string; repMax: number }) {
  const { data: history = [] } = usePersonalRecordHistory(exercise, repMax);
  const points = useMemo(() => {
    const sorted = [...history].sort(
      (a, b) => new Date(a.changed_at).getTime() - new Date(b.changed_at).getTime(),
    );
    return sorted.map((h) => Number(h.new_weight));
  }, [history]);

  if (points.length < 2) return <div className="h-8 w-16 shrink-0" />;

  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const w = 64;
  const h = 28;
  const d = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * (w - 4) + 2;
      const y = h - 3 - ((p - min) / span) * (h - 6);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg width={w} height={h} className="shrink-0" aria-hidden="true">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.85" />
    </svg>
  );
}

export function EvolutionChart({
  history,
  estimated,
}: {
  history: { changed_at: string; new_weight: number }[];
  estimated: { changed_at: string; weight: number; reps: number; sourceWeight: number }[];
}) {
  const data = useMemo(() => {
    const points = [
      ...history.map((h) => ({ changed_at: h.changed_at, real: Number(h.new_weight), estimated: null as number | null, reps: null as number | null })),
      ...estimated.map((p) => ({ changed_at: p.changed_at, real: null as number | null, estimated: p.weight, reps: p.reps })),
    ];
    return points.sort((a, b) => new Date(a.changed_at).getTime() - new Date(b.changed_at).getTime()).map((p) => ({
      date: new Date(p.changed_at).toLocaleDateString(undefined, { day: "2-digit", month: "short" }),
      real: p.real,
      estimated: p.estimated,
      reps: p.reps,
    }));
  }, [history, estimated]);

  if (data.length < 2) return null;

  const weights = data.flatMap((d) => [d.real, d.estimated].filter((v): v is number => v != null));
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const pad = Math.max(2, (max - min) * 0.15);

  return (
    <div className="glass-quiet mb-5 rounded-[20px] border-white/[.11] bg-white/[.045] p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          Evolución
        </p>
        <p className="text-[11px] text-muted-foreground tabular">
          <span className="font-semibold text-foreground">{max} kg</span> máx · {min} kg mín
        </p>
      </div>
      <div className="h-40 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="date"
              stroke="var(--muted-foreground)"
              tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              domain={[Math.floor(min - pad), Math.ceil(max + pad)]}
              stroke="var(--muted-foreground)"
              tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
              tickLine={false}
              axisLine={false}
              width={40}
            />
            <Tooltip
              contentStyle={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                fontSize: 12,
                color: "var(--foreground)",
              }}
              labelStyle={{ color: "var(--muted-foreground)" }}
              formatter={(v: number) => [`${v} kg`, "Peso"]}
            />
            <Line
              type="monotone"
              dataKey="real"
              name="RM confirmado"
              stroke="var(--gold)"
              strokeWidth={2.5}
              dot={{ r: 3, fill: "var(--gold)", strokeWidth: 0 }}
              activeDot={{ r: 5 }}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="estimated"
              name="1RM estimado"
              stroke="var(--foreground)"
              strokeWidth={1.5}
              strokeDasharray="5 4"
              dot={{ r: 2, fill: "var(--foreground)", strokeWidth: 0 }}
              activeDot={{ r: 4 }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
