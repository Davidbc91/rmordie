import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { getCurrentUserId } from "@/lib/pin-gate";
import { enablePush, isPushActive } from "@/lib/push";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  useNotificationPreferences,
  useSaveNotificationPreferences,
} from "@/lib/notification-preferences";

/** Ajustes del recordatorio diario y del resumen semanal. */
export function NotificationSettings() {
  const { data: prefs, isLoading, isError } = useNotificationPreferences();
  const save = useSaveNotificationPreferences();
  const [daily, setDaily] = useState(DEFAULT_NOTIFICATION_PREFERENCES.daily_enabled);
  const [time, setTime] = useState(DEFAULT_NOTIFICATION_PREFERENCES.daily_time);
  const [weekly, setWeekly] = useState(DEFAULT_NOTIFICATION_PREFERENCES.weekly_enabled);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!prefs || dirty) return;
    setDaily(prefs.daily_enabled);
    setTime(prefs.daily_time);
    setWeekly(prefs.weekly_enabled);
  }, [prefs, dirty]);

  async function onSave() {
    const uid = getCurrentUserId();
    if (!uid) return;
    // Sin permiso de notificaciones en este dispositivo, el aviso no llegaría.
    if ((daily || weekly) && !(await isPushActive())) {
      const res = await enablePush(uid);
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
    }
    try {
      await save.mutateAsync({ daily_enabled: daily, daily_time: time, weekly_enabled: weekly });
      setDirty(false);
      toast.success(daily || weekly ? "Avisos guardados." : "Avisos desactivados.");
    } catch (e) {
      toast.error((e as { message?: string })?.message ?? "No se pudieron guardar los avisos.");
    }
  }

  const change = <T,>(setter: (v: T) => void) => (value: T) => {
    setter(value);
    setDirty(true);
  };

  return (
    <section className="mt-4 card-elevated p-5">
      <h2 className="text-sm font-semibold">Avisos</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Se envían como notificación a los dispositivos donde las hayas activado.
      </p>
      {isLoading && <p className="mt-2 text-xs text-muted-foreground">Cargando tus avisos…</p>}
      {isError && <p role="alert" className="mt-2 text-xs text-destructive">No se pudieron cargar tus avisos.</p>}

      <div className="mt-4 flex items-center justify-between gap-4">
        <label htmlFor="daily-reminder" className="min-w-0">
          <span className="block text-sm">Recordatorio diario</span>
          <span className="block text-xs text-muted-foreground">El entreno que toca hoy. No avisa en días de descanso.</span>
        </label>
        <Switch id="daily-reminder" checked={daily} onCheckedChange={change(setDaily)} />
      </div>

      <label className="mt-3 block">
        <span className="mb-1 block text-xs uppercase tracking-wider text-muted-foreground">Hora del recordatorio</span>
        <input
          type="time"
          step={900}
          value={time}
          disabled={!daily}
          onChange={(e) => change(setTime)(e.target.value.slice(0, 5))}
          className="min-h-11 w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm tabular outline-none focus:border-gold disabled:opacity-50"
        />
        <span className="mt-1 block text-xs text-muted-foreground">Llega en un margen de 15 minutos.</span>
      </label>

      <div className="mt-4 flex items-center justify-between gap-4">
        <label htmlFor="weekly-summary" className="min-w-0">
          <span className="block text-sm">Resumen semanal</span>
          <span className="block text-xs text-muted-foreground">Domingo a las 20:00: sesiones, kilos movidos y PR.</span>
        </label>
        <Switch id="weekly-summary" checked={weekly} onCheckedChange={change(setWeekly)} />
      </div>

      <button
        onClick={onSave}
        disabled={save.isPending || isLoading || !dirty}
        className="mt-4 rounded-xl gold-gradient px-4 py-2 text-sm font-semibold disabled:opacity-50"
        style={{ color: "var(--gold-foreground)" }}
      >
        {save.isPending ? "Guardando…" : "Guardar avisos"}
      </button>
    </section>
  );
}
