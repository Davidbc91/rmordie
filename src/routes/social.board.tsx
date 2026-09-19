import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeft, Medal } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Avatar } from "@/components/social/PostCard";
import { usePrBoard, useLeaderboard, fmtTime, timeAgo } from "@/lib/social";

export const Route = createFileRoute("/social/board")({
  head: () => ({
    meta: [
      { title: "PR Board — RM OR DIE" },
      { name: "description", content: "Ranking de récords personales y benchmarks de la comunidad RM OR DIE por movimiento y tipo de RM." },
      { property: "og:title", content: "PR Board de la comunidad" },
      { property: "og:description", content: "Leaderboard de récords y WODs entre atletas." },
    ],
  }),
  component: BoardPage,
});

function BoardPage() {
  const [view, setView] = useState<"pr" | "wod">("pr");
  return (
    <AppShell>
      <header className="rise rise-1 mb-6">
        <Link to="/social" className="mb-4 inline-flex items-center gap-2 text-xs text-muted-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Social
        </Link>
        <h1 className="text-[2rem] font-semibold leading-none tracking-tight">PR Board</h1>
        <p className="mt-2 text-sm text-muted-foreground">Solo atletas con marcas públicas.</p>
        <div className="mt-5 flex gap-2">
          {(["pr", "wod"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className="rounded-full px-3.5 py-2 text-xs"
              style={view === v ? { background: "linear-gradient(140deg,#EBD6A6,#D8B46B)", color: "#0A0A0B" } : { background: "rgba(255,255,255,0.06)", color: "var(--muted-foreground)" }}
            >
              {v === "pr" ? "Récords" : "WODs"}
            </button>
          ))}
        </div>
      </header>
      {view === "pr" ? <PrBoard /> : <WodBoard />}
    </AppShell>
  );
}

function PrBoard() {
  const { data: rows = [], isLoading } = usePrBoard();
  const [repMax, setRepMax] = useState(1);
  const exercises = useMemo(() => [...new Set(rows.filter((r) => r.rep_max === repMax).map((r) => r.exercise))].sort(), [rows, repMax]);
  const [exercise, setExercise] = useState<string | null>(null);
  const active = exercise && exercises.includes(exercise) ? exercise : exercises[0] ?? null;
  const list = rows.filter((r) => r.rep_max === repMax && r.exercise === active).sort((a, b) => b.weight - a.weight);

  if (isLoading) return <p className="text-sm text-muted-foreground">Cargando ranking…</p>;
  if (!rows.length) return <Empty text="Aún no hay marcas públicas." />;

  return (
    <>
      <div className="no-scrollbar mb-3 flex gap-2 overflow-x-auto">
        {[1, 3, 5, 10].map((r) => (
          <button
            key={r}
            onClick={() => setRepMax(r)}
            className="shrink-0 rounded-full px-3.5 py-2 text-xs"
            style={repMax === r ? { background: "linear-gradient(140deg,#EBD6A6,#D8B46B)", color: "#0A0A0B" } : { background: "rgba(255,255,255,0.06)", color: "var(--muted-foreground)" }}
          >
            {r}RM
          </button>
        ))}
      </div>
      <div className="no-scrollbar mb-5 flex gap-2 overflow-x-auto">
        {exercises.map((e) => (
          <button
            key={e}
            onClick={() => setExercise(e)}
            className="shrink-0 rounded-full border px-3.5 py-2 text-xs"
            style={{ borderColor: active === e ? "#FFFFFF" : "rgba(255,255,255,0.09)", color: active === e ? "#FFFFFF" : "var(--muted-foreground)" }}
          >
            {e}
          </button>
        ))}
      </div>
      <div className="space-y-2">
        {list.map((r, i) => (
          <div
            key={`${r.user_id}-${r.exercise}`}
            className="flex items-center gap-3 rounded-[18px] border p-4"
            style={{ borderColor: "rgba(255,255,255,0.09)", background: i === 0 ? "#FFFFFF" : "rgba(255,255,255,0.045)", color: i === 0 ? "#000" : undefined }}
          >
            <span className="w-5 text-center text-sm font-semibold tabular">{i + 1}</span>
            <Avatar profile={r.author} size={34} />
            <Link to="/social/u/$username" params={{ username: r.author?.username ?? "" }} className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{r.author?.display_name || r.author?.username || "Atleta"}</span>
              <span className="block truncate text-[11px] opacity-60">{timeAgo(r.changed_at)}</span>
            </Link>
            {i === 0 && <Medal className="h-4 w-4" />}
            <span className="text-lg font-semibold tabular">
              {r.weight}
              <span className="text-xs"> kg</span>
            </span>
          </div>
        ))}
        {list.length === 0 && <Empty text="Sin marcas para este filtro." />}
      </div>
    </>
  );
}

function WodBoard() {
  const { data: rows = [], isLoading } = useLeaderboard();
  const names = useMemo(() => [...new Set(rows.map((r) => r.name))].sort(), [rows]);
  const [name, setName] = useState<string | null>(null);
  const active = name && names.includes(name) ? name : names[0] ?? null;
  const list = rows
    .filter((r) => r.name === active)
    .sort((a, b) => (a.seconds ?? Infinity) - (b.seconds ?? Infinity));

  if (isLoading) return <p className="text-sm text-muted-foreground">Cargando…</p>;
  if (!rows.length) return <Empty text="Todavía no se han compartido WODs." />;

  return (
    <>
      <div className="no-scrollbar mb-5 flex gap-2 overflow-x-auto">
        {names.map((n) => (
          <button
            key={n}
            onClick={() => setName(n)}
            className="shrink-0 rounded-full border px-3.5 py-2 text-xs"
            style={{ borderColor: active === n ? "#FFFFFF" : "rgba(255,255,255,0.09)", color: active === n ? "#FFFFFF" : "var(--muted-foreground)" }}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="space-y-2">
        {list.map((r, i) => (
          <div
            key={r.post.id}
            className="flex items-center gap-3 rounded-[18px] border p-4"
            style={{ borderColor: "rgba(255,255,255,0.09)", background: i === 0 ? "#FFFFFF" : "rgba(255,255,255,0.045)", color: i === 0 ? "#000" : undefined }}
          >
            <span className="w-5 text-center text-sm font-semibold tabular">{i + 1}</span>
            <Avatar profile={r.post.author} size={34} />
            <Link to="/social/u/$username" params={{ username: r.post.author?.username ?? "" }} className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{r.post.author?.display_name || r.post.author?.username || "Atleta"}</span>
              <span className="block truncate text-[11px] opacity-60">{r.scale}</span>
            </Link>
            <span className="text-lg font-semibold tabular">{r.seconds != null ? fmtTime(r.seconds) : r.score}</span>
          </div>
        ))}
      </div>
    </>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <p className="rounded-[20px] border p-6 text-center text-sm text-muted-foreground" style={{ borderColor: "#1C1C1C" }}>
      {text}
    </p>
  );
}
