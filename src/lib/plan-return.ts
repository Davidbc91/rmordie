/**
 * Volver a la planificación donde la dejaste: la pestaña «Plan» recuerda la
 * última pantalla del plan (semana del calendario o día de entreno) y en qué
 * punto de la página estabas.
 */
const KEY = "rmordie_plan_last";
const RESTORE = "rmordie_plan_restore";

export const isPlanPath = (p: string) => p.startsWith("/calendar") || p.startsWith("/workout/") || p.startsWith("/plan-builder");

type Last = { href: string; scroll: number };

function read(): Last | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Last) : null;
  } catch {
    return null;
  }
}

export function rememberPlanPlace(href: string, scroll: number) {
  try { sessionStorage.setItem(KEY, JSON.stringify({ href, scroll })); } catch { /* sin almacenamiento */ }
}

export function lastPlanPlace(): Last | null {
  return read();
}

/** Marca que la próxima pantalla del plan debe volver a su posición. */
export function requestPlanRestore(scroll: number) {
  try { sessionStorage.setItem(RESTORE, String(scroll)); } catch { /* sin almacenamiento */ }
}

/** Si hay que volver a una posición, la recupera (esperando a que cargue el contenido). */
export function consumePlanRestore() {
  let y = 0;
  try {
    const raw = sessionStorage.getItem(RESTORE);
    if (raw == null) return;
    sessionStorage.removeItem(RESTORE);
    y = Number(raw) || 0;
  } catch {
    return;
  }
  if (y <= 0) return;
  const started = performance.now();
  const tryScroll = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    window.scrollTo({ top: Math.min(y, Math.max(0, max)) });
    if (max < y && performance.now() - started < 2500) requestAnimationFrame(tryScroll);
  };
  requestAnimationFrame(tryScroll);
}
