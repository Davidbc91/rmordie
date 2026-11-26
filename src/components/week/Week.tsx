import { useMemo, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { X, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { useAllResults, usePlanning } from "@/lib/store";
import { useAllPrHistory, useAthleteProfile, useMilestones, useWellnessLogs } from "@/lib/profile-store";
import { plannedPerWeek } from "@/lib/analytics";
import { getCurrentUserId } from "@/lib/pin-gate";
import { shareOrDownloadCard } from "@/lib/share-card";
import { fmtTons, lastWeekMonday, renderWeekStory, weekRange, weekSummary, type WeekSummary } from "@/lib/weekly-summary";

export function useWeekSummary(monday: string): { data: WeekSummary | null; ready: boolean } {
  const results = useAllResults();
  const history = useAllPrHistory();
  const wellness = useWellnessLogs();
  const milestones = useMilestones();
  const { data: profile } = useAthleteProfile();
  const { data: planning } = usePlanning();
  const ready = results.isSuccess && history.isSuccess;
  const data = useMemo(
    () =>
      ready
        ? weekSummary({
            monday,
            results: results.data ?? [],
            history: history.data ?? [],
            wellness: wellness.data ?? [],
            milestones: milestones.data ?? [],
            weeklyTarget: profile?.weekly_target ?? plannedPerWeek(planning?.data) ?? 4,
          })
        : null,
    [ready, monday, results.data, history.data, wellness.data, milestones.data, profile?.weekly_target, planning?.data],
  );
  return { data, ready };
}

export async function shareWeek(s: WeekSummary) {
  try {
    const blob = await renderWeekStory(s);
    const out = await shareOrDownloadCard(blob, `semana-${s.monday}.png`);
    toast.success(out === "shared" ? "Imagen de tu semana compartida" : "Imagen de tu semana descargada");
  } catch (e: any) {
    if (e?.name !== "AbortError") toast.error(e?.message ?? "No se pudo crear la imagen");
  }
}

const SEEN_KEY = (uid: string) => `rmordie_week_seen:${uid}`;

/** Tarjeta de Inicio con la semana pasada. Sale hasta que la cierras. */
export function WeekCard() {
  const monday = lastWeekMonday();
  const uid = getCurrentUserId() ?? "anon";
  const [hidden, setHidden] = useState(() => {
    try { return localStorage.getItem(SEEN_KEY(uid)) === monday; } catch { return false; }
  });
  const { data: s } = useWeekSummary(monday);
  if (hidden || !s) return null;
  // Si nunca has entrenado, no tiene sentido enseñarla
  if (s.sessions === 0 && s.prevVolume === 0) return null;

  const close = () => {
    try { localStorage.setItem(SEEN_KEY(uid), monday); } catch { /* sin almacenamiento */ }
    setHidden(true);
  };

  return (
    <div className="rise rise-2 flex items-center gap-2 rounded-[20px] border py-1 pl-3.5 pr-1" style={{ background: "linear-gradient(135deg, #262C12, #1B1B1D 70%)", borderColor: "rgba(198,255,0,.2)" }}>
      <Link to="/semana" search={{ w: monday }} className="pressable flex min-h-[54px] min-w-0 flex-1 items-center gap-2 py-1.5">
        <span className="min-w-0 flex-1">
          <span className="block text-[12.5px] font-bold text-gold">Tu semana pasada · {weekRange(monday)}</span>
          <span className="block truncate text-[15px] font-bold">
            {s.sessions}/{s.target} · {s.headline}{s.volume > 0 ? ` · ${fmtTons(s.volume)}` : ""}
          </span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      </Link>
      <button type="button" onClick={close} aria-label="Cerrar el resumen" className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-muted-foreground"><X className="h-4 w-4" /></button>
    </div>
  );
}
