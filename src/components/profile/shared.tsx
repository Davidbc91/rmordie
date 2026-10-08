import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { RANGES, type RangeKey, type Trend } from "@/lib/analytics";

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`cinematic-card-strong min-w-0 max-w-full rounded-[24px] p-5 ${className}`}>{children}</section>;
}

export function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="cinematic-card-dark rounded-[20px] border border-white/[.07] p-4">
      <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
      <div className="mt-2 text-2xl font-semibold tabular tracking-tight">{value}</div>
      {sub && <div className="mt-1 text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

export function Empty({ text = "Aún no hay suficientes datos." }: { text?: string }) {
  return (
    <div className="rounded-[22px] border border-dashed border-border p-6 text-center">
      <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Not enough data</p>
      <p className="mt-2 text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

export function TrendIcon({ trend }: { trend: Trend }) {
  if (trend === "up") return <ArrowUpRight className="h-4 w-4" />;
  if (trend === "down") return <ArrowDownRight className="h-4 w-4" />;
  return <Minus className="h-4 w-4" />;
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block min-w-0 max-w-full">
      <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{label}</span>
      <div className="mt-1.5 min-w-0 max-w-full">{children}</div>
    </label>
  );
}

export const inputCls =
  "w-full min-w-0 max-w-full rounded-xl border border-border bg-surface-2 px-3.5 py-2.5 text-sm text-foreground outline-none focus:border-foreground/40";

export function RangePicker({ range, setRange }: { range: RangeKey; setRange: (r: RangeKey) => void }) {
  return (
    <div className="mb-4 flex gap-1 overflow-x-auto rounded-2xl border border-white/[.08] bg-black/20 p-1">
      {RANGES.map((r) => (
        <button
          key={r.key}
          onClick={() => setRange(r.key)}
          className={`flex-1 whitespace-nowrap rounded-xl px-3 py-2 text-xs font-semibold transition ${
            range === r.key ? "gold-gradient" : "text-muted-foreground"
          }`}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}

export function MonoChart({ data, dataKey = "value" }: { data: { label: string; value: number }[]; dataKey?: string }) {
  if (data.length < 2) return <Empty text="Necesitas al menos dos registros para ver la evolución." />;
  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid stroke="#E4E4E4" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#6F6F6F" }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 10, fill: "#6F6F6F" }} tickLine={false} axisLine={false} width={44} domain={["auto", "auto"]} />
          <Tooltip
            contentStyle={{ background: "#101114", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 14, color: "#FFFFFF", fontSize: 12 }}
            labelStyle={{ color: "#B8B8B8" }}
          />
          <Line type="monotone" dataKey={dataKey} stroke="var(--gold)" strokeWidth={2} dot={{ r: 2.5, fill: "var(--gold)" }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ---------------- 1. Profile ---------------- */

export function num(v: any): number | null {
  if (v === "" || v == null) return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export function invert(t: Trend): Trend {
  return t === "up" ? "down" : t === "down" ? "up" : t;
}

export function trendWord(t: Trend) {
  return t === "up" ? "Improving" : t === "down" ? "Down" : t === "stable" ? "Stable" : "No data";
}

/* ---------------- 5-7. Strength ---------------- */

export function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span>{label}</span>
      <span className="font-semibold" style={{ color: "var(--foreground)" }}>{value}</span>
    </div>
  );
}

/* ---------------- 11. Consistency ---------------- */

export function ReportList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.24em]" style={{ color: "#6F6F6F" }}>{title}</p>
      {items.length === 0 ? (
        <p className="mt-2 text-sm" style={{ color: "#6F6F6F" }}>Not enough data</p>
      ) : (
        <ul className="mt-2 space-y-1 text-sm">
          {items.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ---------------- 19. Privacy & data ---------------- */
