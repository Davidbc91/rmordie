import { useMemo, useEffect } from "react";
import { Award } from "lucide-react";
import { useMilestones, useSyncMilestones } from "@/lib/profile-store";
import { computeMilestones } from "@/lib/analytics";
import { Empty } from "./shared";

export function MilestonesSection({ results, history }: any) {
  const { data: saved = [] } = useMilestones();
  const sync = useSyncMilestones();
  const computed = useMemo(() => computeMilestones(results, history), [results, history]);

  useEffect(() => {
    const missing = computed.filter((c) => !saved.some((s) => s.code === c.code));
    if (missing.length) sync.mutate(missing.map((m) => ({ ...m, label: m.label, detail: m.detail ?? null })));
  }, [computed.map((c) => c.code).join(","), saved.length]);

  const list = computed.map((c) => ({
    ...c,
    achieved_at: saved.find((s) => s.code === c.code)?.achieved_at ?? null,
  }));

  if (list.length === 0) return <Empty text="Completa tu primer entrenamiento para desbloquear hitos." />;

  return (
    <div className="grid grid-cols-2 gap-3">
      {list.map((m) => (
        <div key={m.code} className="card-elevated p-4">
          <Award className="h-5 w-5" />
          <p className="mt-3 text-sm font-semibold leading-tight">{m.label}</p>
          {m.detail && <p className="mt-1 text-[11px]" style={{ color: "#6F6F6F" }}>{m.detail}</p>}
          {m.achieved_at && (
            <p className="mt-2 text-[10px] uppercase tracking-[0.16em]" style={{ color: "#6F6F6F" }}>
              {new Date(m.achieved_at).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "2-digit" })}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

/* ---------------- 14. Monthly report ---------------- */
