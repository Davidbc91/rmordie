// Configura el temporizador a partir del texto del WOD del plan.
import { detectWodType } from "./wod";

export type WodTimerConfig =
  | { kind: "amrap"; totalSec: number; label: string }
  | { kind: "fortime"; capSec: number | null; label: string }
  | { kind: "emom"; intervalSec: number; rounds: number; label: string }
  | { kind: "tabata"; work: number; rest: number; rounds: number; label: string };

function minutesNear(text: string, re: RegExp): number | null {
  const m = text.match(re);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 && n <= 180 ? n : null;
}

/** Etiqueta del reloj según su configuración (tras ajustarla a mano). */
export function timerLabel(c: WodTimerConfig): string {
  if (c.kind === "amrap") return `AMRAP ${Math.round(c.totalSec / 60)}'`;
  if (c.kind === "fortime") return c.capSec ? `For Time · cap ${Math.round(c.capSec / 60)}'` : "For Time";
  if (c.kind === "emom") {
    const every = c.intervalSec / 60;
    return Number.isInteger(every) && every > 1 ? `E${every}MOM ${c.rounds * every}'` : c.intervalSec === 60 ? `EMOM ${c.rounds}'` : `EMOM ${c.rounds} × ${c.intervalSec}s`;
  }
  return `Tabata ${c.rounds} × ${c.work}/${c.rest}`;
}

/** Devuelve null si el bloque no tiene un formato con reloj. */
export function timerConfigFor(content: string): WodTimerConfig | null {
  if (!content) return null;
  const t = content.replace(/\r/g, "");

  if (/\btabata\b/i.test(t)) {
    // "Tabata 30/15", "30'' on / 15'' off", "40s trabajo 20s descanso", "x6", "6 rondas"
    const pair = t.match(/(\d{1,3})\s*(?:s|seg|"|''|”)?\s*(?:on|trabajo|work)?\s*[/:x-]\s*(\d{1,3})\s*(?:s|seg|"|''|”)?\s*(?:off|descanso|rest)?/i);
    const on = t.match(/(\d{1,3})\s*(?:s|seg|"|''|”)?\s*(?:on|trabajo|work)\b/i);
    const off = t.match(/(\d{1,3})\s*(?:s|seg|"|''|”)?\s*(?:off|descanso|rest)\b/i);
    let work = 20;
    let rest = 10;
    if (on && off) { work = Number(on[1]); rest = Number(off[1]); }
    else if (pair && Number(pair[1]) >= 5 && Number(pair[1]) <= 300 && Number(pair[2]) <= 300) { work = Number(pair[1]); rest = Number(pair[2]); }
    const r = t.match(/(\d{1,2})\s*(?:rondas|rounds|series|sets|intervalos)\b/i) ?? t.match(/(?:x|×)\s*(\d{1,2})\b/i);
    const rounds = r && Number(r[1]) > 0 ? Number(r[1]) : 8;
    return { kind: "tabata", work, rest, rounds, label: `Tabata ${rounds} × ${work}/${rest}` };
  }

  const type = detectWodType(t);

  if (type === "amrap") {
    const min =
      minutesNear(t, /AMRAP\s*(?:de\s*)?(\d{1,3})\s*(?:'|’|min|minutos|m\b)?/i) ??
      minutesNear(t, /(\d{1,3})\s*(?:'|’|min|minutos)\s*AMRAP/i) ??
      12;
    return { kind: "amrap", totalSec: min * 60, label: `AMRAP ${min}'` };
  }

  if (type === "emom") {
    const every = t.match(/\bE(\d+)MOM\b/i);
    const everyMin = every ? Number(every[1]) : minutesNear(t, /every\s*(\d{1,2})\s*min/i) ?? minutesNear(t, /cada\s*(\d{1,2})\s*min/i) ?? 1;
    const intervalSec = Math.max(1, everyMin) * 60;
    const explicitRounds = minutesNear(t, /(?:x|×)\s*(\d{1,2})\s*(?:rondas|rounds|sets|series)?\b/i);
    const total = minutesNear(t, /E\d*MOM\s*(?:x\s*)?(\d{1,3})/i) ?? minutesNear(t, /(\d{1,3})\s*(?:'|’|min)\s*E\d*MOM/i);
    const rounds = explicitRounds && !total ? explicitRounds : total ? Math.max(1, Math.floor(total / Math.max(1, everyMin))) : 10;
    const label = everyMin > 1 ? `E${everyMin}MOM ${rounds * everyMin}'` : `EMOM ${rounds}'`;
    return { kind: "emom", intervalSec, rounds, label };
  }

  if (type === "for_time") {
    const cap =
      minutesNear(t, /(?:time\s*cap|cap)\s*[:\-]?\s*(\d{1,3})\s*(?:'|’|min|minutos)?/i) ??
      minutesNear(t, /(\d{1,3})\s*(?:'|’|min)\s*(?:time\s*)?cap/i);
    return { kind: "fortime", capSec: cap ? cap * 60 : null, label: cap ? `For Time · cap ${cap}'` : "For Time" };
  }

  return null;
}
