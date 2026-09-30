import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Dumbbell } from "lucide-react";
import { GlassCard } from "@/components/glass";
import { MovementVideoEmbed } from "@/components/MovementVideoEmbed";
import { movements } from "@/lib/dictionary/catalog";
import { resolveMovementId } from "@/lib/dictionary/resolve";
import { usePersonalRecordHistory, usePersonalRecords } from "@/lib/store";
import type { Movement } from "@/lib/dictionary/types";
import { formatKg } from "@/lib/rm-matcher";

export const Route = createFileRoute("/dictionary/$movementId")({
  loader: ({ params }) => {
    const movement = movements.find((item) => item.id === params.movementId);
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
  const navigate = Route.useNavigate();
  const related = useMemo(() => getRelatedMovements(movement), [movement]);
  const online = useOnlineStatus();

  function goBack() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      window.history.back();
      return;
    }
    void navigate({ to: "/dictionary" });
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5 pb-8">
      <button
        type="button"
        onClick={goBack}
        className="inline-flex min-h-11 items-center gap-2 rounded-xl text-sm text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold)]"
        aria-label="Volver a la página anterior"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Volver
      </button>

      <GlassCard level={3} className="overflow-hidden p-5 sm:p-7">
        <div className="flex min-w-0 items-start gap-3">
          <Dumbbell
            className="mt-1 h-6 w-6 shrink-0"
            style={{ color: "var(--gold)" }}
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1">
            <h1 className="break-words text-2xl font-semibold uppercase tracking-tight sm:text-3xl">
              {movement.name}
            </h1>
            <p className="mt-1 break-words text-sm text-muted-foreground">{movement.nameEs}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <MovementBadge>{movement.category}</MovementBadge>
              {movement.equipment.map((item) => (
                <MovementBadge key={item}>{item}</MovementBadge>
              ))}
              <MovementBadge>{movement.level}</MovementBadge>
              {movement.rm && <MovementBadge gold>RM</MovementBadge>}
            </div>
          </div>
        </div>
      </GlassCard>

      <MovementSection title="Demostración">
        <MovementVideoEmbed movementId={movement.id} fallbackUrl={movement.videoUrl} />
      </MovementSection>

      <MovementSection title="Descripción">
        <p className="text-sm leading-relaxed text-muted-foreground">{movement.description}</p>
      </MovementSection>

      <MovementSection title="Técnica">
        <ol className="space-y-3">
          {movement.technique.map((item, index) => (
            <li
              key={`${index}-${item}`}
              className="flex gap-3 rounded-xl border border-border/70 p-3"
            >
              <span
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-[rgba(216,180,107,0.3)] text-xs font-semibold tabular text-[var(--gold)]"
                aria-hidden="true"
              >
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="pt-1 text-sm leading-relaxed">{item}</span>
            </li>
          ))}
        </ol>
      </MovementSection>

      <MovementSection title="Errores frecuentes">
        <MovementList items={movement.commonMistakes} />
      </MovementSection>

      <div className="grid gap-5 md:grid-cols-2">
        <MovementSection title="Progresiones">
          <MovementList items={movement.progressions} linkMovements />
        </MovementSection>
        <MovementSection title="Regresiones">
          <MovementList items={movement.regressions} linkMovements />
        </MovementSection>
      </div>

      <MovementSection title="Músculos implicados">
        <div className="flex flex-wrap gap-2">
          {movement.muscles.map((muscle) => (
            <MovementBadge key={muscle}>{muscle}</MovementBadge>
          ))}
        </div>
      </MovementSection>

      {movement.rm && <MovementRmCard movement={movement} online={online} />}

      {related.length > 0 && (
        <MovementSection title="Movimientos relacionados">
          <ul className="grid gap-2 sm:grid-cols-2">
            {related.map((item) => (
              <li key={item.id}>
                <Link
                  to="/dictionary/$movementId"
                  params={{ movementId: item.id }}
                  className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-border px-3 py-2 text-sm transition hover:border-[rgba(216,180,107,0.45)] hover:text-[var(--gold)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold)]"
                >
                  <span className="min-w-0 truncate">{item.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{item.nameEs}</span>
                </Link>
              </li>
            ))}
          </ul>
        </MovementSection>
      )}
    </div>
  );
}

function MovementBadge({ children, gold = false }: { children: string; gold?: boolean }) {
  return (
    <span
      className={`max-w-full break-words rounded-full border px-2.5 py-1 text-xs ${
        gold
          ? "border-[rgba(216,180,107,0.4)] text-[var(--gold)]"
          : "border-border text-muted-foreground"
      }`}
    >
      {children}
    </span>
  );
}

function MovementSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <GlassCard className="min-w-0 p-4 sm:p-5">
      <h2 className="eyebrow">{title}</h2>
      <div className="mt-3 min-w-0">{children}</div>
    </GlassCard>
  );
}

function MovementList({
  items,
  linkMovements = false,
}: {
  items: string[];
  linkMovements?: boolean;
}) {
  return (
    <ul className="space-y-2">
      {items.map((item, index) => {
        const relatedId = linkMovements ? resolveMovementId(item) : null;
        return (
          <li key={`${index}-${item}`} className="rounded-xl border border-border/70 p-3">
            {relatedId ? (
              <Link
                to="/dictionary/$movementId"
                params={{ movementId: relatedId }}
                className="inline-flex min-h-6 items-center rounded text-sm leading-relaxed text-foreground underline decoration-[var(--gold)]/50 underline-offset-4 hover:text-[var(--gold)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold)]"
              >
                {item}
              </Link>
            ) : (
              <span className="text-sm leading-relaxed">{item}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function MovementRmCard({ movement, online }: { movement: Movement; online: boolean }) {
  const { data: records = [], isLoading, isError } = usePersonalRecords();
  const record = useMemo(
    () =>
      records
        .filter((item) => resolveMovementId(item.exercise) === movement.id)
        .sort(
          (a, b) =>
            (a.rep_max ?? 1) - (b.rep_max ?? 1) ||
            new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
        )[0] ?? null,
    [records, movement.id],
  );
  const {
    data: history = [],
    isLoading: historyLoading,
    isError: historyError,
  } = usePersonalRecordHistory(record?.exercise ?? null, record?.rep_max ?? undefined);

  return (
    <MovementSection title="Tu RM">
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando RM…</p>
      ) : isError && !record ? (
        <p className="text-sm text-muted-foreground">
          {online ? "No se pudo cargar tu RM." : "RM no disponible sin conexión."}
        </p>
      ) : !record ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Sin RM registrado</p>
          <Link
            to="/records"
            search={{ tab: "strength" }}
            className="inline-flex min-h-11 items-center rounded-xl border border-[rgba(216,180,107,0.4)] px-4 text-sm text-[var(--gold)] transition hover:bg-[rgba(216,180,107,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold)]"
          >
            Ir a Mis RM
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-4 rounded-2xl border border-[rgba(216,180,107,0.3)] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Tu RM actual · {record.rep_max ?? 1}RM
            </p>
            <p className="mt-1 text-2xl font-semibold tabular text-[var(--gold)]">
              {formatKg(Number(record.weight))} kg
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Registro guardado como «{record.exercise}»
            </p>
          </div>
          {historyLoading ? (
            <span className="text-sm text-muted-foreground">Consultando historial…</span>
          ) : history.length > 0 ? (
            <Link
              to="/records"
              search={{
                tab: "strength",
                exercise: record.exercise,
                repMax: record.rep_max ?? 1,
              }}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border px-4 text-sm transition hover:border-[rgba(216,180,107,0.45)] hover:text-[var(--gold)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold)]"
            >
              Ver historial
            </Link>
          ) : historyError && !online ? (
            <span className="text-sm text-muted-foreground">
              Historial no disponible sin conexión.
            </span>
          ) : null}
        </div>
      )}
    </MovementSection>
  );
}

function useOnlineStatus() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return online;
}

function getRelatedMovements(movement: Movement): Movement[] {
  const referencedIds = new Set(
    [...movement.progressions, ...movement.regressions]
      .map((entry) => resolveMovementId(entry))
      .filter((id): id is string => id !== null),
  );
  const movementPattern = getMovementPattern(movement.name);

  return movements
    .filter((candidate) => candidate.id !== movement.id)
    .map((candidate) => {
      const sharedEquipment = candidate.equipment.filter((item) =>
        movement.equipment.includes(item),
      ).length;
      const score =
        (referencedIds.has(candidate.id) ? 10 : 0) +
        (candidate.category === movement.category ? 3 : 0) +
        (getMovementPattern(candidate.name) === movementPattern ? 4 : 0) +
        Math.min(sharedEquipment, 2);
      return { candidate, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.candidate.id.localeCompare(b.candidate.id))
    .slice(0, 5)
    .map(({ candidate }) => candidate);
}

function getMovementPattern(name: string): string {
  const label = name.toLowerCase();
  if (/squat|thruster/.test(label)) return "squat";
  if (/deadlift|good morning|hinge|hip thrust|glute bridge/.test(label)) return "hinge";
  if (/clean|snatch|jerk/.test(label)) return "olympic";
  if (/lunge|step-up/.test(label)) return "single-leg";
  if (/press|push-up|pushup/.test(label)) return "push";
  if (/pull-up|muscle-up|row|rope climb/.test(label)) return "pull";
  if (/carry|drag|sled|hold|hang/.test(label)) return "carry";
  if (/jump|burpee|under/.test(label)) return "plyometric";
  if (/run|running|sprint|row$|bike|swim|ski erg/.test(label)) return "monostructural";
  if (/sit-up|v-up|plank|twist|toes-to-bar|knee raise|l-sit/.test(label)) return "core";
  return label;
}
