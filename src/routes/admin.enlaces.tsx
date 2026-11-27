import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Check, EyeOff, Link2, Loader2, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { isVideoAdmin } from "@/lib/admin-videos";
import { getCurrentUserId } from "@/lib/pin-gate";
import { usePlanning } from "@/lib/store";
import { movements } from "@/lib/dictionary/catalog";
import { useCustomMovements } from "@/lib/dictionary/custom";
import { useAddMovementAlias, useDeleteMovementAlias, useMovementAliases } from "@/lib/dictionary/plan-aliases";
import { auditPlanLinks, suggestAlias, type AuditLine } from "@/lib/plan-link-audit";
import type { Movement } from "@/lib/dictionary/types";

export const Route = createFileRoute("/admin/enlaces")({
  head: () => ({ meta: [{ title: "Enlaces del plan — RM OR DIE" }] }),
  component: PlanLinksPage,
});

type Filter = "missing" | "partial" | "all" | "manual";
const IGNORE_KEY = "rmordie:enlaces-ignorados";

function readIgnored(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(IGNORE_KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}
function writeIgnored(value: Set<string>) {
  try {
    localStorage.setItem(IGNORE_KEY, JSON.stringify([...value]));
  } catch {
    /* sin almacenamiento: se olvida al cerrar */
  }
}

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

function PlanLinksPage() {
  const me = getCurrentUserId();
  const { data: isAdmin, isLoading } = useQuery({ queryKey: ["video-admin", me], queryFn: isVideoAdmin, enabled: !!me, staleTime: 5 * 60 * 1000 });
  if (isLoading) return <AppShell><div className="h-60 animate-pulse rounded-[24px] bg-white/[0.04]" /></AppShell>;
  if (!isAdmin) return <AppShell><p className="text-sm text-muted-foreground">Esta página es solo para el administrador.</p></AppShell>;
  return <AppShell><Review /></AppShell>;
}

function Review() {
  const { data: planning, isLoading } = usePlanning();
  const { data: custom = [] } = useCustomMovements();
  const { data: aliases = [], isFetched } = useMovementAliases();
  const all = useMemo(() => [...movements, ...custom], [custom]);
  const byId = useMemo(() => new Map(all.map((m) => [m.id, m])), [all]);
  const [filter, setFilter] = useState<Filter>("missing");
  const [ignored, setIgnored] = useState<Set<string>>(() => readIgnored());
  const [open, setOpen] = useState<string | null>(null);

  // aliases en la dependencia: al guardar uno se recalculan los enlaces.
  const lines = useMemo(() => (isFetched ? auditPlanLinks(planning?.data) : []), [planning, aliases, isFetched, custom]);
  const visibleLines = lines.filter((l) => !ignored.has(l.key));
  const missing = visibleLines.filter((l) => l.matches.length === 0);
  const partial = visibleLines.filter((l) => l.matches.length > 0 && l.leftover);
  const manualLines = visibleLines.filter((l) => l.matches.some((m) => m.manual));
  const shown = filter === "missing" ? missing : filter === "partial" ? partial : filter === "manual" ? manualLines : visibleLines;
  const sorted = [...shown].sort((a, b) => b.places.length - a.places.length);

  function ignore(line: AuditLine) {
    const next = new Set(ignored);
    next.add(line.key);
    setIgnored(next);
    writeIgnored(next);
  }
  function restoreIgnored() {
    setIgnored(new Set());
    writeIgnored(new Set());
  }

  return (
    <div className="space-y-5 pb-10">
      <div className="flex items-center gap-3">
        <Link to="/admin/videos" className="grid h-10 w-10 place-items-center rounded-full bg-white/[0.06]" aria-label="Volver">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0">
          <h1 className="text-xl font-extrabold">Enlaces del plan</h1>
          <p className="truncate text-xs text-muted-foreground">
            {planning?.source_filename ?? "Planificación activa"} · cada ejercicio con su movimiento del diccionario
          </p>
        </div>
      </div>

      {isLoading || !isFetched ? (
        <div className="grid h-40 place-items-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : !planning ? (
        <p className="rounded-[20px] bg-[color:var(--card)] p-5 text-sm text-muted-foreground">No tienes ninguna planificación activa.</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2">
            <Stat n={visibleLines.length - missing.length} label="Enlazadas" tone="var(--gold)" />
            <Stat n={missing.length} label="Sin enlace" tone="#FF8A3D" />
            <Stat n={partial.length} label="A medias" tone="#3BB8F5" />
          </div>

          <div className="flex flex-wrap gap-2">
            {([
              ["missing", `Sin enlace · ${missing.length}`],
              ["partial", `A medias · ${partial.length}`],
              ["manual", `Corregidas · ${manualLines.length}`],
              ["all", `Todas · ${visibleLines.length}`],
            ] as const).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setFilter(k)}
                className={`min-h-9 rounded-full px-3.5 text-xs font-bold ${filter === k ? "bg-[color:var(--gold-tint)] text-[var(--gold)]" : "bg-[color:var(--chip)] text-muted-foreground"}`}
              >
                {label}
              </button>
            ))}
          </div>

          {filter === "partial" && (
            <p className="text-xs text-muted-foreground">Líneas con algún movimiento enlazado pero con texto que no se ha reconocido. Revisa que no falte un segundo ejercicio.</p>
          )}

          {sorted.length === 0 ? (
            <p className="rounded-[20px] bg-[color:var(--card)] p-5 text-sm text-muted-foreground">
              {filter === "missing" ? "Todas las líneas del plan tienen su movimiento enlazado." : "No hay líneas en este grupo."}
            </p>
          ) : (
            <ul className="space-y-2.5">
              {sorted.map((line) => (
                <LineCard
                  key={line.key}
                  line={line}
                  all={all}
                  byId={byId}
                  open={open === line.key}
                  onToggle={() => setOpen(open === line.key ? null : line.key)}
                  onIgnore={() => ignore(line)}
                />
              ))}
            </ul>
          )}

          {ignored.size > 0 && (
            <button onClick={restoreIgnored} className="text-xs font-semibold text-muted-foreground underline underline-offset-2">
              Volver a mostrar {ignored.size} {ignored.size === 1 ? "línea ocultada" : "líneas ocultadas"}
            </button>
          )}

          <AliasList byId={byId} />
        </>
      )}
    </div>
  );
}

function Stat({ n, label, tone }: { n: number; label: string; tone: string }) {
  return (
    <div className="rounded-[18px] bg-[color:var(--card)] p-3">
      <div className="text-[28px] font-extrabold leading-none" style={{ fontFamily: "var(--font-num)", color: tone }}>{n}</div>
      <div className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  );
}

function LineCard({ line, all, byId, open, onToggle, onIgnore }: {
  line: AuditLine;
  all: Movement[];
  byId: Map<string, Movement>;
  open: boolean;
  onToggle: () => void;
  onIgnore: () => void;
}) {
  const first = line.places[0];
  const segments: Array<{ text: string; movementId?: string; manual?: boolean }> = [];
  let cursor = 0;
  for (const m of line.matches) {
    if (cursor < m.start) segments.push({ text: line.text.slice(cursor, m.start) });
    segments.push({ text: line.text.slice(m.start, m.end), movementId: m.movementId, manual: m.manual });
    cursor = m.end;
  }
  if (cursor < line.text.length) segments.push({ text: line.text.slice(cursor) });

  return (
    <li className="rounded-[20px] bg-[color:var(--card)] p-4">
      <p className="text-[15px] font-semibold leading-snug">
        {segments.map((s, i) =>
          s.movementId ? (
            <span key={i} className="rounded-md bg-[color:var(--gold-tint)] px-1 text-[var(--gold)]" title={byId.get(s.movementId)?.name}>{s.text}</span>
          ) : (
            <span key={i}>{s.text}</span>
          ),
        )}
      </p>
      {line.matches.length > 0 && (
        <p className="mt-1.5 text-xs text-muted-foreground">
          → {line.matches.map((m) => `${byId.get(m.movementId)?.nameEs || m.matchedName}${m.manual ? " (corregido)" : ""}`).join(" · ")}
        </p>
      )}
      <p className="mt-1 text-[11px] text-muted-foreground/80">
        {line.places.length} {line.places.length === 1 ? "vez" : "veces"} · {first.month}, semana {first.week}, {cap(first.day)} · bloque {first.block}
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={onToggle} className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-[var(--gold)] px-3.5 text-xs font-extrabold text-[color:var(--gold-foreground)]">
          <Link2 className="h-3.5 w-3.5" /> {line.matches.length ? "Corregir enlace" : "Enlazar"}
        </button>
        {line.matches.length === 0 && (
          <button onClick={onIgnore} className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-[color:var(--chip)] px-3.5 text-xs font-bold text-muted-foreground">
            <EyeOff className="h-3.5 w-3.5" /> No es un ejercicio
          </button>
        )}
      </div>

      {open && <LinkEditor line={line} all={all} onDone={onToggle} />}
    </li>
  );
}

function LinkEditor({ line, all, onDone }: { line: AuditLine; all: Movement[]; onDone: () => void }) {
  const [alias, setAlias] = useState(() => suggestAlias(line.matches.length ? line.leftover || line.text : line.text));
  const [query, setQuery] = useState(() => suggestAlias(line.matches.length ? line.leftover || line.text : line.text));
  const [picked, setPicked] = useState<Movement | null>(null);
  const add = useAddMovementAlias();

  const results = useMemo(() => {
    const q = fold(query.trim());
    if (!q) return all.slice(0, 6);
    const words = q.split(/\s+/);
    return all
      .map((m) => {
        const hay = fold([m.name, m.nameEs, ...m.aliases].join(" | "));
        const score = words.filter((w) => hay.includes(w)).length;
        return { m, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || a.m.name.length - b.m.name.length)
      .slice(0, 6)
      .map((x) => x.m);
  }, [query, all]);

  async function save() {
    if (!picked) return;
    try {
      await add.mutateAsync({ alias, movementId: picked.id });
      toast.success(`«${alias}» ahora enlaza con ${picked.nameEs || picked.name}`);
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar el enlace");
    }
  }

  return (
    <div className="mt-3 space-y-3 rounded-[16px] bg-[color:var(--background)]/60 p-3">
      <label className="block">
        <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Texto del plan que se enlaza</span>
        <input
          value={alias}
          onChange={(e) => setAlias(e.target.value)}
          className="mt-1 h-11 w-full rounded-xl bg-[color:var(--chip)] px-3 text-base outline-none focus:ring-1 focus:ring-[var(--gold)]"
        />
        <span className="mt-1 block text-[11px] text-muted-foreground">Vale para todas las líneas donde aparezca este texto, en cualquier plan.</span>
      </label>

      <label className="block">
        <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Movimiento del diccionario</span>
        <div className="relative mt-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPicked(null); }}
            placeholder="Buscar movimiento"
            className="h-11 w-full rounded-xl bg-[color:var(--chip)] pl-9 pr-3 text-base outline-none focus:ring-1 focus:ring-[var(--gold)]"
          />
        </div>
      </label>

      <div className="space-y-1.5">
        {results.length === 0 && <p className="text-xs text-muted-foreground">Ningún movimiento coincide. Prueba con el nombre en inglés.</p>}
        {results.map((m) => (
          <button
            key={m.id}
            onClick={() => setPicked(m)}
            className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left ${picked?.id === m.id ? "bg-[color:var(--gold-tint)]" : "bg-[color:var(--card)]"}`}
          >
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold">{m.nameEs || m.name}</span>
              <span className="block truncate text-[11px] text-muted-foreground">{m.name} · {m.category}</span>
            </span>
            {picked?.id === m.id && <Check className="h-4 w-4 shrink-0 text-[var(--gold)]" />}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <button
          onClick={save}
          disabled={!picked || !alias.trim() || add.isPending}
          className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-full bg-[var(--gold)] px-4 text-sm font-extrabold text-[color:var(--gold-foreground)] disabled:opacity-40"
        >
          {add.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Guardar enlace
        </button>
        <button onClick={onDone} className="grid min-h-10 w-10 place-items-center rounded-full bg-[color:var(--chip)]" aria-label="Cancelar">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function AliasList({ byId }: { byId: Map<string, Movement> }) {
  const { data: aliases = [] } = useMovementAliases();
  const del = useDeleteMovementAlias();
  if (aliases.length === 0) return null;
  return (
    <section className="space-y-2 pt-2">
      <h2 className="text-sm font-extrabold uppercase tracking-wide text-muted-foreground">Enlaces corregidos · {aliases.length}</h2>
      <ul className="space-y-1.5">
        {aliases.map((a) => (
          <li key={a.id} className="flex items-center justify-between gap-3 rounded-xl bg-[color:var(--card)] px-3 py-2.5">
            <span className="min-w-0 text-sm">
              <span className="font-semibold">«{a.alias}»</span>
              <span className="text-muted-foreground"> → {byId.get(a.movement_id)?.nameEs || byId.get(a.movement_id)?.name || a.movement_id}</span>
            </span>
            <button
              onClick={() => del.mutate(a.id, { onError: () => toast.error("No se pudo borrar") })}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[color:var(--chip)] text-muted-foreground"
              aria-label="Borrar enlace"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
