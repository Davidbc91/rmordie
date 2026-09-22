import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Plus, Save, Trash2 } from "lucide-react";
import { GlassBadge, GlassButton, GlassCard, GlassInput, GlassSection, GlassTextarea } from "@/components/glass";
import { usePlanning, useSavePlanning, usePersonalRecords } from "@/lib/store";
import { getCurrentUserId } from "@/lib/pin-gate";
import type { Planning } from "@/lib/excel-parser";
import { detectExercise, loadsForPercentages, formatKg } from "@/lib/rm-matcher";
import {
  BLOCK_TYPES,
  BLOCK_TYPE_LABEL,
  type BlockType,
  type ManualBlock,
  type ManualExercise,
  emptyExercise,
  move,
  nextBlockKey,
  parseBlock,
  serializeBlock,
  uid,
  validateBlock,
} from "@/lib/manual-plan";

export const Route = createFileRoute("/plan-builder")({
  head: () => ({
    meta: [
      { title: "Crear planificación — RM OR DIE" },
      { name: "description", content: "Crea y edita tu planificación de CrossFit a mano: bloques, ejercicios, series, repeticiones y % de RM." },
      { property: "og:title", content: "Crear planificación — RM OR DIE" },
      { property: "og:description", content: "Crea y edita tu planificación de CrossFit a mano, sin Excel." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PlanBuilderPage,
});

const DAYS = ["LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES", "SABADO", "DOMINGO"];

type EditorDay = { key: string; blocks: ManualBlock[] };
type EditorWeek = { id: string; index: number; days: EditorDay[] };
type EditorMonth = { id: string; key: string; label: string; order: number; weeks: EditorWeek[] };

function newWeek(index: number): EditorWeek {
  return { id: uid(), index, days: DAYS.map((k) => ({ key: k, blocks: [] })) };
}

function newMonth(order: number): EditorMonth {
  return { id: uid(), key: `${order}. MI PLAN`, label: "Mi plan", order, weeks: [newWeek(1)] };
}

function PlanBuilderPage() {
  const navigate = useNavigate();
  const { data: current, isLoading } = usePlanning();
  const { data: records = [] } = usePersonalRecords();
  const save = useSavePlanning();
  const myUid = getCurrentUserId();

  const editable = current && current.user_id && current.user_id === myUid ? current : null;

  const [months, setMonths] = useState<EditorMonth[] | null>(null);
  const [mi, setMi] = useState(0);
  const [wi, setWi] = useState(0);
  const [dayKey, setDayKey] = useState(DAYS[0]);

  // Estado inicial: si la planificación activa es propia se carga para editarla.
  const state = useMemo<EditorMonth[]>(() => {
    if (months) return months;
    if (editable) {
      return editable.data.months.map((m, i) => ({
        id: uid(),
        key: m.key,
        label: m.label,
        order: m.order ?? i + 1,
        weeks: m.weeks.map((w) => ({
          id: uid(),
          index: w.index,
          days: DAYS.map((dk) => {
            const day = w.days.find((d) => d.key.toUpperCase() === dk);
            return { key: dk, blocks: (day?.blocks ?? []).map((b) => parseBlock(b.key, b.content)) };
          }),
        })),
      }));
    }
    return [newMonth(1)];
  }, [months, editable]);

  const month = state[Math.min(mi, state.length - 1)];
  const week = month?.weeks[Math.min(wi, month.weeks.length - 1)];
  const day = week?.days.find((d) => d.key === dayKey) ?? week?.days[0];

  function update(fn: (draft: EditorMonth[]) => EditorMonth[]) {
    setMonths(fn(structuredClone(state)));
  }

  function updateBlocks(fn: (blocks: ManualBlock[]) => ManualBlock[]) {
    update((draft) => {
      const m = draft[Math.min(mi, draft.length - 1)];
      const w = m.weeks[Math.min(wi, m.weeks.length - 1)];
      const d = w.days.find((x) => x.key === (day?.key ?? DAYS[0]));
      if (d) d.blocks = fn(d.blocks);
      return draft;
    });
  }

  function addBlock(type: BlockType) {
    updateBlocks((blocks) => [
      ...blocks,
      { id: uid(), key: nextBlockKey(type, blocks), type, header: "", exercises: [emptyExercise()] },
    ]);
  }

  function patchExercise(blockId: string, exId: string, patch: Partial<ManualExercise>) {
    updateBlocks((blocks) =>
      blocks.map((b) =>
        b.id === blockId ? { ...b, exercises: b.exercises.map((e) => (e.id === exId ? { ...e, ...patch } : e)) } : b,
      ),
    );
  }

  function buildPlanning(): { planning: Planning; error?: string } {
    for (const m of state) {
      for (const w of m.weeks) {
        for (const d of w.days) {
          for (const b of d.blocks) {
            const err = validateBlock(b);
            if (err) return { planning: { months: [], importedAt: "" }, error: `${m.key} · Semana ${w.index} · ${d.key}: ${err}` };
          }
        }
      }
    }
    const hasContent = state.some((m) => m.weeks.some((w) => w.days.some((d) => d.blocks.length > 0)));
    if (!hasContent) return { planning: { months: [], importedAt: "" }, error: "Añade al menos un bloque antes de guardar." };

    const planning: Planning = {
      months: state.map((m, i) => ({
        key: m.key.trim() || `${i + 1}. MI PLAN`,
        label: m.label.trim() || m.key.trim() || "Mi plan",
        order: m.order ?? i + 1,
        weeks: m.weeks.map((w) => ({
          index: w.index,
          days: w.days.map((d) => {
            const blocks = d.blocks
              .map((b) => ({ key: b.key, content: serializeBlock(b) }))
              .filter((b) => b.content.trim());
            return { key: d.key, blocks, isRest: blocks.length === 0 };
          }),
        })),
      })),
      importedAt: new Date().toISOString(),
    };
    return { planning };
  }

  async function onSave() {
    const { planning, error } = buildPlanning();
    if (error) {
      toast.error(error);
      return;
    }
    try {
      await save.mutateAsync({ planning, filename: "Planificación manual" });
      toast.success("Planificación guardada.");
      navigate({ to: "/calendar" });
    } catch (e) {
      const err = e as { message?: string };
      toast.error(`No se pudo guardar: ${err?.message ?? "error desconocido"}`);
    }
  }

  if (isLoading) {
    return (
      <AppShell>
        <p className="mt-10 text-sm text-muted-foreground">Cargando…</p>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Crear planificación</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {editable ? "Editas tu planificación activa." : "Diseña tu plan bloque a bloque, sin Excel."}
          </p>
        </div>
        <GlassButton variant="gold" onClick={onSave} disabled={save.isPending}>
          <Save className="h-4 w-4" />
          {save.isPending ? "Guardando…" : "Guardar"}
        </GlassButton>
      </div>

      <GlassSection title="Mes">
        <GlassCard className="p-4">
          <div className="grid grid-cols-2 gap-3">
            <GlassInput
              label="Clave"
              value={month?.key ?? ""}
              onChange={(e) =>
                update((draft) => {
                  draft[Math.min(mi, draft.length - 1)].key = e.target.value;
                  return draft;
                })
              }
            />
            <GlassInput
              label="Nombre"
              value={month?.label ?? ""}
              onChange={(e) =>
                update((draft) => {
                  draft[Math.min(mi, draft.length - 1)].label = e.target.value;
                  return draft;
                })
              }
            />
          </div>
          {state.length > 1 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {state.map((m, i) => (
                <button
                  key={m.id}
                  onClick={() => { setMi(i); setWi(0); }}
                  className={`tap rounded-full px-3 text-xs font-semibold ${i === mi ? "gold-gradient" : "glass"}`}
                >
                  {m.key}
                </button>
              ))}
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <GlassButton
              size="sm"
              onClick={() =>
                update((draft) => {
                  draft.push(newMonth(draft.length + 1));
                  return draft;
                })
              }
            >
              <Plus className="h-3.5 w-3.5" /> Mes
            </GlassButton>
            <GlassButton
              size="sm"
              onClick={() =>
                update((draft) => {
                  const m = draft[Math.min(mi, draft.length - 1)];
                  m.weeks.push(newWeek(m.weeks.length + 1));
                  return draft;
                })
              }
            >
              <Plus className="h-3.5 w-3.5" /> Semana
            </GlassButton>
          </div>
        </GlassCard>
      </GlassSection>

      <GlassSection title="Semana y día">
        <div className="flex flex-wrap gap-2">
          {month?.weeks.map((w, i) => (
            <button
              key={w.id}
              onClick={() => setWi(i)}
              className={`tap rounded-full px-3 text-xs font-semibold ${i === wi ? "gold-gradient" : "glass"}`}
            >
              Semana {w.index}
            </button>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {DAYS.map((d) => {
            const count = week?.days.find((x) => x.key === d)?.blocks.length ?? 0;
            return (
              <button
                key={d}
                onClick={() => setDayKey(d)}
                className={`tap rounded-full px-3 text-[11px] font-semibold uppercase tracking-[0.12em] ${d === day?.key ? "gold-gradient" : "glass"}`}
              >
                {d.slice(0, 3)}{count ? ` ${count}` : ""}
              </button>
            );
          })}
        </div>
      </GlassSection>

      <GlassSection title={`Bloques · ${day?.key ?? ""}`}>
        {(day?.blocks.length ?? 0) === 0 && (
          <p className="text-sm text-muted-foreground">Sin bloques todavía. Añade el primero abajo.</p>
        )}

        <div className="space-y-3">
          {day?.blocks.map((b, bi) => (
            <GlassCard key={b.id} className="p-4">
              <div className="flex items-center justify-between gap-2">
                <GlassBadge tone="gold">{BLOCK_TYPE_LABEL[b.type]}</GlassBadge>
                <div className="flex items-center gap-1">
                  <GlassButton size="sm" variant="ghost" aria-label="Subir bloque" onClick={() => updateBlocks((bl) => move(bl, bi, bi - 1))}>
                    <ArrowUp className="h-4 w-4" />
                  </GlassButton>
                  <GlassButton size="sm" variant="ghost" aria-label="Bajar bloque" onClick={() => updateBlocks((bl) => move(bl, bi, bi + 1))}>
                    <ArrowDown className="h-4 w-4" />
                  </GlassButton>
                  <GlassButton size="sm" variant="ghost" aria-label="Eliminar bloque" onClick={() => updateBlocks((bl) => bl.filter((x) => x.id !== b.id))}>
                    <Trash2 className="h-4 w-4" />
                  </GlassButton>
                </div>
              </div>

              <div className="mt-3">
                <GlassTextarea
                  label="Encabezado (opcional)"
                  rows={2}
                  placeholder="AMRAP 10'"
                  value={b.header}
                  onChange={(e) => updateBlocks((bl) => bl.map((x) => (x.id === b.id ? { ...x, header: e.target.value } : x)))}
                />
              </div>

              <div className="mt-3 space-y-3">
                {b.exercises.map((ex, ei) => {
                  const rec = ex.name.trim() ? detectExercise(ex.name, records) : null;
                  const pct = Number(ex.percent.replace(",", "."));
                  const target = rec && pct > 0 ? loadsForPercentages(rec.weight, [pct])[0] : null;
                  return (
                    <div key={ex.id} className="rounded-[var(--r-md)] border border-[color:var(--glass-border)] p-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <GlassInput
                            label={`Ejercicio ${ei + 1}`}
                            placeholder="Back Squat"
                            value={ex.name}
                            onChange={(e) => patchExercise(b.id, ex.id, { name: e.target.value })}
                          />
                        </div>
                        <div className="mt-5 flex items-center gap-1">
                          <GlassButton size="sm" variant="ghost" aria-label="Subir ejercicio" onClick={() => updateBlocks((bl) => bl.map((x) => (x.id === b.id ? { ...x, exercises: move(x.exercises, ei, ei - 1) } : x)))}>
                            <ArrowUp className="h-4 w-4" />
                          </GlassButton>
                          <GlassButton size="sm" variant="ghost" aria-label="Bajar ejercicio" onClick={() => updateBlocks((bl) => bl.map((x) => (x.id === b.id ? { ...x, exercises: move(x.exercises, ei, ei + 1) } : x)))}>
                            <ArrowDown className="h-4 w-4" />
                          </GlassButton>
                          <GlassButton size="sm" variant="ghost" aria-label="Eliminar ejercicio" onClick={() => updateBlocks((bl) => bl.map((x) => (x.id === b.id ? { ...x, exercises: x.exercises.filter((y) => y.id !== ex.id) } : x)))}>
                            <Trash2 className="h-4 w-4" />
                          </GlassButton>
                        </div>
                      </div>

                      <div className="mt-2 grid grid-cols-3 gap-2">
                        <GlassInput label="Series" inputMode="decimal" value={ex.sets} onChange={(e) => patchExercise(b.id, ex.id, { sets: e.target.value })} />
                        <GlassInput label="Reps" inputMode="decimal" value={ex.reps} onChange={(e) => patchExercise(b.id, ex.id, { reps: e.target.value })} />
                        <GlassInput label="% RM" inputMode="decimal" value={ex.percent} onChange={(e) => patchExercise(b.id, ex.id, { percent: e.target.value })} />
                        <GlassInput label="Tiempo" placeholder="10'" value={ex.time} onChange={(e) => patchExercise(b.id, ex.id, { time: e.target.value })} />
                        <GlassInput label="Distancia" placeholder="5 km" value={ex.distance} onChange={(e) => patchExercise(b.id, ex.id, { distance: e.target.value })} />
                        <GlassInput label="Carga kg" inputMode="decimal" value={ex.load} onChange={(e) => patchExercise(b.id, ex.id, { load: e.target.value })} />
                      </div>

                      {pct > 0 && (
                        <div className="mt-2 text-xs">
                          {rec && target ? (
                            <span className="text-muted-foreground">
                              RM actual: <span className="tabular text-foreground">{formatKg(rec.weight)} kg</span> · Carga objetivo:{" "}
                              <span className="tabular text-gold">{formatKg(target.suggested)} kg</span>
                            </span>
                          ) : (
                            <span className="text-muted-foreground">RM no disponible</span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <GlassButton
                size="sm"
                className="mt-3"
                onClick={() => updateBlocks((bl) => bl.map((x) => (x.id === b.id ? { ...x, exercises: [...x.exercises, emptyExercise()] } : x)))}
              >
                <Plus className="h-3.5 w-3.5" /> Ejercicio
              </GlassButton>
            </GlassCard>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {BLOCK_TYPES.map((t) => (
            <GlassButton key={t} size="sm" onClick={() => addBlock(t)}>
              <Plus className="h-3.5 w-3.5" /> {BLOCK_TYPE_LABEL[t]}
            </GlassButton>
          ))}
        </div>
      </GlassSection>
    </AppShell>
  );
}
