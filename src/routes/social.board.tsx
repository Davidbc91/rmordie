import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Medal } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Avatar } from "@/components/social/PostCard";
import { useLeaderboard, useLeaderboardExercises } from "@/lib/social";

export const Route = createFileRoute("/social/board")({
  head: () => ({
    meta: [
      { title: "PR Board — RM OR DIE" },
      { name: "description", content: "Ranking de récords personales de la comunidad RM OR DIE por ejercicio y fuerza relativa." },
      { property: "og:title", content: "PR Board de la comunidad" },
      { property: "og:description", content: "Leaderboard de récords por movimiento." },
    ],
  }),
  component: BoardPage,
});

function BoardPage() {
  const { data: exercises = [] } = useLeaderboardExercises();
  const [exercise, setExercise] = useState<string | null>(null);
  const active = exercise ?? exercises[0] ?? null;
  const [repMax, setRepMax] = useState(1);
  const { data: rows = [], isLoading } = useLeaderboard(active, repMax);

  return (
    <AppShell>
      <header className="rise rise-1 mb-6">
        <Link to="/social" className="mb-4 inline-flex items-center gap-2 text-xs text-muted-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Social
        </Link>
        <h1 className="text-[2rem] font-semibold leading-none tracking-tight">PR Board</h1>
        <p className="mt-2 text-sm text-muted-foreground">Ranking por movimiento entre atletas con estadísticas públicas.</p>
      </header>

      <div className="no-scrollbar mb-3 flex gap-2 overflow-x-auto">
        {[1, 3, 5, 10].map((r) => (
          <button
            key={r}
            onClick={() => setRepMax(r)}
            className="shrink-0 rounded-full px-3.5 py-2 text-xs"
            style={repMax === r ? { background: "#FFFFFF", color: "#000" } : { background: "#181818", color: "#9A9A9A" }}
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
            style={{ borderColor: active === e ? "#FFFFFF" : "#242424", color: active === e ? "#FFFFFF" : "#9A9A9A" }}
          >
            {e}
          </button>
        ))}
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Cargando ranking…</p>}
      {!isLoading && rows.length === 0 && (
        <p className="rounded-[20px] border p-6 text-center text-sm text-muted-foreground" style={{ borderColor: "#1C1C1C" }}>
          Aún no hay marcas públicas para este movimiento.
        </p>
      )}

      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={r.user_id} className="flex items-center gap-3 rounded-[18px] border p-4" style={{ borderColor: "#1A1A1A", background: i === 0 ? "#FFFFFF" : "#111", color: i === 0 ? "#000" : undefined }}>
            <span className="w-6 text-center text-sm font-semibold tabular">{i + 1}</span>
            <Avatar profile={r.profile} size={34} />
            <Link
              to="/social/u/$username"
              params={{ username: r.profile?.username ?? "" }}
              className="min-w-0 flex-1 truncate text-sm font-semibold"
            >
              {r.profile?.display_name || r.profile?.username || "Atleta"}
            </Link>
            {i === 0 && <Medal className="h-4 w-4" />}
            <span className="text-lg font-semibold tabular">{r.weight}<span className="text-xs"> kg</span></span>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
