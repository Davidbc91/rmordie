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

/** Devuelve null si el bloque no tiene un formato con reloj. */
export function timerConfigFor(content: string): WodTimerConfig | null {
  if (!content) return null;
  const t = content.replace(/\r/g, "");

  if (/\btabata\b/i.test(t)) {
    return { kind: "tabata", work: 20, rest: 10, rounds: 8, label: "Tabata 8 × 20/10" };
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
