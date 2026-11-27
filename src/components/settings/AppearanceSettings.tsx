import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { getCurrentUserId } from "@/lib/pin-gate";
import { useSaveSettings, useSettings } from "@/lib/store";
import {
  ACCENTS,
  BACKGROUNDS,
  DEFAULT_THEME,
  applyTheme,
  normalizeTheme,
  readCachedTheme,
  writeCachedTheme,
  type ThemePrefs,
} from "@/lib/theme";

/** Ajustes → Apariencia: color principal, fondo y logo. Se guarda en la cuenta. */
export function AppearanceSettings() {
  const profileId = getCurrentUserId();
  const { data: settings } = useSettings();
  const save = useSaveSettings();
  const [theme, setTheme] = useState<ThemePrefs>(() => readCachedTheme(profileId) ?? DEFAULT_THEME);

  // Lo guardado en la cuenta manda (por si se cambió desde otro móvil).
  useEffect(() => {
    const remote = settings?.theme;
    if (remote && typeof remote === "object" && Object.keys(remote).length > 0) setTheme(normalizeTheme(remote));
  }, [settings?.theme]);

  function choose(next: Partial<ThemePrefs>) {
    const t = { ...theme, ...next };
    setTheme(t);
    applyTheme(t);
    writeCachedTheme(profileId, t);
    save.mutate(
      { theme: t },
      {
        onError: (e) => {
          // Si la base de datos aún no tiene la columna, el tema queda al menos en este móvil.
          const msg = (e as { message?: string })?.message ?? "";
          if (!/theme/i.test(msg)) toast.error("No se pudo guardar en tu cuenta; se queda en este móvil.");
        },
      },
    );
  }

  return (
    <section className="mt-4 card-elevated p-5">
      <h2 className="text-sm font-semibold">Apariencia</h2>

      <p className="mt-4 text-[13px] font-bold">Color principal</p>
      <p className="mt-0.5 text-xs text-muted-foreground">Botones, números, días entrenados y tus récords.</p>
      <div className="mt-3 grid grid-cols-4 gap-3">
        {ACCENTS.map((a) => {
          const on = theme.accent === a.id;
          return (
            <button
              key={a.id}
              type="button"
              aria-pressed={on}
              aria-label={a.name}
              onClick={() => choose({ accent: a.id })}
              className={`pressable flex flex-col items-center gap-1.5 text-[11.5px] font-semibold ${on ? "text-foreground" : "text-muted-foreground"}`}
            >
              <span
                className="grid h-12 w-12 place-items-center rounded-full outline outline-2 outline-offset-[3px] transition"
                style={{ background: a.color, outlineColor: on ? "var(--foreground)" : "transparent" }}
              >
                {on && <Check className="h-5 w-5" strokeWidth={3} style={{ color: "#0C0C0E" }} />}
              </span>
              {a.name}
            </button>
          );
        })}
      </div>

      <p className="mt-5 text-[13px] font-bold">Fondo</p>
      <div className="mt-2.5 grid grid-cols-3 gap-2">
        {BACKGROUNDS.map((b) => {
          const on = theme.bg === b.id;
          return (
            <button
              key={b.id}
              type="button"
              aria-pressed={on}
              onClick={() => choose({ bg: b.id })}
              className="pressable flex flex-col items-center gap-2 rounded-[16px] border px-2 py-2.5 text-[12px] font-semibold"
              style={{ borderColor: on ? "var(--gold)" : "var(--border)", boxShadow: on ? "inset 0 0 0 1px var(--gold)" : undefined }}
            >
              <span className="block h-8 w-full rounded-[10px] border border-white/10" style={{ background: `linear-gradient(90deg, ${b.bg} 50%, ${b.card} 50%)` }} />
              {b.name}
            </button>
          );
        })}
      </div>

      <div className="mt-5 flex items-center justify-between gap-3">
        <span className="text-[13px]">Logo y portada con tu color</span>
        <button
          type="button"
          role="switch"
          aria-checked={theme.brand}
          aria-label="Logo y portada con tu color"
          onClick={() => choose({ brand: !theme.brand })}
          className="relative h-7 w-12 shrink-0 rounded-full transition"
          style={{ background: theme.brand ? "var(--gold)" : "var(--chip)" }}
        >
          <span
            className="absolute top-[3px] h-[22px] w-[22px] rounded-full transition-all"
            style={{ left: theme.brand ? 23 : 3, background: theme.brand ? "var(--gold-foreground)" : "#FFFFFF" }}
          />
        </button>
      </div>

      {(theme.accent !== DEFAULT_THEME.accent || theme.bg !== DEFAULT_THEME.bg || theme.brand !== DEFAULT_THEME.brand) && (
        <button
          type="button"
          onClick={() => choose(DEFAULT_THEME)}
          className="mt-5 min-h-11 w-full rounded-xl border border-border text-sm font-semibold text-muted-foreground"
        >
          Volver al lima original
        </button>
      )}
    </section>
  );
}
