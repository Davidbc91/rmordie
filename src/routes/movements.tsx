import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search, Play } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { MOVEMENTS, videoUrl, thumbUrl, type Movement } from "@/lib/movements";

export const Route = createFileRoute("/movements")({
  head: () => ({
    meta: [
      { title: "Movimientos — RM OR DIE" },
      { name: "description", content: "Biblioteca de movimientos de CrossFit con vídeos de técnica y claves de ejecución." },
      { property: "og:title", content: "Movimientos — RM OR DIE" },
      { property: "og:description", content: "Biblioteca de movimientos de CrossFit con vídeos de técnica." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MovementsPage,
});

const CATEGORIES = ["Todos", "Halterofilia", "Gimnásticos", "Fuerza", "Monoestructural", "Accesorios"] as const;

function MovementsPage() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<(typeof CATEGORIES)[number]>("Todos");

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return MOVEMENTS.filter(
      (m) => (cat === "Todos" || m.category === cat) && (!needle || m.name.toLowerCase().includes(needle)),
    );
  }, [q, cat]);

  return (
    <AppShell>
      <header className="rise-in mb-6">
        <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Biblioteca</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Movimientos</h1>
        <p className="mt-2 text-sm text-muted-foreground">Técnica y vídeo de cada movimiento.</p>
      </header>

      <div className="rise-in mb-4 flex items-center gap-2 rounded-[18px] border border-border bg-surface-2 px-3 py-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar movimiento…"
          className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
      </div>

      <div className="rise-in mb-5 flex gap-2 overflow-x-auto pb-1">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className="pressable shrink-0 rounded-full border px-3 py-1.5 text-xs"
            style={
              cat === c
                ? { background: "#FFFFFF", color: "#000000", borderColor: "#FFFFFF" }
                : { borderColor: "#1F1F1F", color: "#8A8A8A" }
            }
          >
            {c}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {list.map((m, i) => (
          <MovementCard key={m.name} m={m} index={i} />
        ))}
      </div>

      {list.length === 0 && (
        <p className="mt-10 text-center text-sm text-muted-foreground">Sin resultados para “{q}”.</p>
      )}
    </AppShell>
  );
}

function MovementCard({ m, index }: { m: Movement; index: number }) {
  const thumb = thumbUrl(m);
  return (
    <a
      href={videoUrl(m)}
      target="_blank"
      rel="noopener noreferrer"
      className="pressable rise-in card-elevated block overflow-hidden"
      style={{ animationDelay: `${Math.min(index, 12) * 30}ms` }}
    >
      <div className="relative aspect-video w-full overflow-hidden bg-black">
        {thumb && (
          <img
            src={thumb}
            alt={`Vídeo de técnica: ${m.name}`}
            loading="lazy"
            className="h-full w-full object-cover opacity-90"
          />
        )}
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/90">
            <Play className="h-5 w-5 translate-x-[1px] text-black" fill="currentColor" />
          </span>
        </span>
      </div>
      <div className="p-4">
        <p className="text-[10px] uppercase tracking-[0.18em] opacity-60">{m.category}</p>
        <h2 className="mt-1 text-base font-semibold">{m.name}</h2>
        <p className="mt-1 text-xs leading-relaxed opacity-70">{m.cues}</p>
      </div>
    </a>
  );
}
