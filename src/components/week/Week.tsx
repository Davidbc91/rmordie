import { useMemo, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { X } from "lucide-react";
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
  const [sharing, setSharing] = useState(false);
  if (hidden || !s) return null;
  // Si nunca has entrenado, no tiene sentido enseñarla
  if (s.sessions === 0 && s.prevVolume === 0) return null;

  const close = () => {
    try { localStorage.setItem(SEEN_KEY(uid), monday); } catch { /* sin almacenamiento */ }
    setHidden(true);
  };

  return (
    <section className="rise rise-1 mb-4 flex flex-col gap-3 rounded-[24px] border p-4" style={{ background: "linear-gradient(135deg, #262C12, #1B1B1D 70%)", borderColor: "rgba(198,255,0,.2)" }}>
      <div className="flex items-center justify-between">
        <span className="text-[12.5px] font-bold text-gold">Tu semana · {weekRange(monday)}</span>
        <button type="button" onClick={close} aria-label="Cerrar el resumen" className="-mr-2 grid h-9 w-9 place-items-center rounded-full text-muted-foreground"><X className="h-4 w-4" /></button>
      </div>
      <h2 className="text-[22px] font-extrabold leading-tight tracking-tight">
        {s.sessions} de {s.target} sesiones. {s.headline}.
      </h2>
      <div className="grid grid-cols-3 gap-2">
        <Mini value={<>{s.sessions}<small className="text-[15px] text-muted-foreground">/{s.target}</small></>} label="sesiones" />
        <Mini
          value={s.volume > 0 ? fmtTons(s.volume) : "—"}
          label={s.volumeDelta != null ? `${s.volumeDelta >= 0 ? "▲" : "▼"} ${Math.abs(s.volumeDelta)} %` : "movidos"}
          labelColor={s.volumeDelta == null ? undefined : s.volumeDelta >= 0 ? "var(--gold)" : "#FF8A3D"}
        />
        <Mini value={<span className={s.prs.length ? "text-gold" : ""}>{s.prs.length}</span>} label={s.prs.length === 1 ? "récord" : "récords"} />
      </div>
      <div className="flex gap-2">
        <Link to="/semana" search={{ w: monday }} className="pressable flex min-h-12 flex-1 items-center justify-center rounded-full text-[15px] font-extrabold" style={{ background: "var(--gold)", color: "var(--gold-foreground)" }}>
          Ver tu semana
        </Link>
        <button type="button" disabled={sharing} onClick={async () => { setSharing(true); await shareWeek(s); setSharing(false); }} className="pressable min-h-12 rounded-full bg-white/[0.08] px-4 text-[15px] font-extrabold">
          {sharing ? "Creando…" : "Compartir"}
        </button>
      </div>
    </section>
  );
}

function Mini({ value, label, labelColor }: { value: ReactNode; label: string; labelColor?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-[14px] bg-white/[0.05] p-2.5">
      <span className="num truncate text-[26px] leading-none">{value}</span>
      <span className="truncate text-[12.5px] font-semibold" style={{ color: labelColor ?? "var(--muted-foreground)" }}>{label}</span>
    </div>
  );
}
