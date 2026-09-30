import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, ExternalLink, Dumbbell } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { GlassCard } from "@/components/glass";
import { movements } from "@/lib/dictionary/catalog";

export const Route = createFileRoute("/dictionary/$movementId")({
  loader: ({ params }) => {
    const movement = movements.find((m) => m.id === params.movementId);
    if (!movement) throw notFound();
    return movement;
  },
  head: ({ loaderData }) => ({
    meta: [{ title: `${loaderData?.name ?? "Movimiento"} — RM OR DIE` }],
  }),
  component: MovementPage,
});

function MovementPage() {
  const movement = Route.useLoaderData();
  const sections = [
    ["Técnica", movement.technique],
    ["Errores frecuentes", movement.commonMistakes],
    ["Progresiones", movement.progressions],
    ["Regresiones", movement.regressions],
    ["Músculos implicados", movement.muscles],
  ] as const;
  return (
    <AppShell>
      <div className="space-y-5">
        <Link
          to="/dictionary"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Diccionario
        </Link>
        <GlassCard level={3} className="p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <Dumbbell className="mt-1 h-6 w-6 shrink-0" style={{ color: "var(--gold)" }} />
            <div>
              <p className="eyebrow">{movement.category}</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight">{movement.name}</h1>
              <p className="mt-1 text-sm text-muted-foreground">{movement.nameEs}</p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full border border-border px-2.5 py-1 text-xs">
              {movement.level}
            </span>
            {movement.equipment.map((x) => (
              <span key={x} className="rounded-full border border-border px-2.5 py-1 text-xs">
                {x}
              </span>
            ))}
            {movement.rm && (
              <span
                className="rounded-full border border-[rgba(216,180,107,0.35)] px-2.5 py-1 text-xs"
                style={{ color: "var(--gold)" }}
              >
                Admite registro de RM
              </span>
            )}
          </div>
          <p className="mt-5 text-sm leading-relaxed text-muted-foreground">
            {movement.description}
          </p>
        </GlassCard>
        {sections.map(([title, items]) => (
          <GlassCard key={title} className="p-4">
            <h2 className="eyebrow">{title}</h2>
            <ul className="mt-3 space-y-2">
              {items.map((item) => (
                <li key={item} className="flex gap-2 text-sm leading-relaxed">
                  <span style={{ color: "var(--gold)" }}>·</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </GlassCard>
        ))}
        <a
          href={movement.videoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="glass glass-sheen pressable flex items-center justify-between rounded-[var(--r-md)] p-4"
        >
          <span>
            <span className="block text-sm font-semibold">Ver demo del movimiento</span>
            <span className="mt-1 block text-xs text-muted-foreground">
              Se abre una búsqueda de vídeo externa.
            </span>
          </span>
          <ExternalLink className="h-4 w-4 shrink-0" style={{ color: "var(--gold)" }} />
        </a>
      </div>
    </AppShell>
  );
}
