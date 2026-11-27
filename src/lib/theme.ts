import { useEffect, useLayoutEffect } from "react";

/** Apariencia elegida por el usuario (Ajustes → Apariencia). */
export type ThemePrefs = { accent: AccentId; bg: BackgroundId; brand: boolean };

export type AccentId = "lima" | "naranja" | "cielo" | "rosa" | "violeta" | "rojo" | "oro" | "menta";
export type BackgroundId = "grafito" | "negro" | "noche";

type Accent = { id: AccentId; name: string; color: string; rgb: string; light: string; deep: string; soft: string };
type Background = { id: BackgroundId; name: string; bg: string; level1: string; card: string; chip: string; chipSoft: string; glass3: string };

export const ACCENTS: Accent[] = [
  { id: "lima", name: "Lima", color: "#C6FF00", rgb: "198, 255, 0", light: "#D8FF4D", deep: "#AEE600", soft: "#DBFF66" },
  { id: "naranja", name: "Naranja", color: "#FF8A3D", rgb: "255, 138, 61", light: "#FFA766", deep: "#F2701E", soft: "#FFB07A" },
  { id: "cielo", name: "Cielo", color: "#3BB8F5", rgb: "59, 184, 245", light: "#6CCBF8", deep: "#1A9FE0", soft: "#7FD2FA" },
  { id: "rosa", name: "Rosa", color: "#FF4FA3", rgb: "255, 79, 163", light: "#FF7DBB", deep: "#F02D8A", soft: "#FF8FC4" },
  { id: "violeta", name: "Violeta", color: "#A78BFA", rgb: "167, 139, 250", light: "#BFAAFC", deep: "#8B6CF5", soft: "#C4B2FC" },
  { id: "rojo", name: "Rojo", color: "#FF4D4D", rgb: "255, 77, 77", light: "#FF7676", deep: "#EB2F2F", soft: "#FF8A8A" },
  { id: "oro", name: "Oro", color: "#F5C542", rgb: "245, 197, 66", light: "#F8D570", deep: "#E0AE22", soft: "#FADC85" },
  { id: "menta", name: "Menta", color: "#2EE6A6", rgb: "46, 230, 166", light: "#5FEDBB", deep: "#16CC8D", soft: "#7AF0C6" },
];

export const BACKGROUNDS: Background[] = [
  { id: "grafito", name: "Grafito", bg: "#0C0C0E", level1: "#141416", card: "#1B1B1D", chip: "#2C2C2F", chipSoft: "#232326", glass3: "rgba(30, 30, 33, 0.94)" },
  { id: "negro", name: "Negro puro", bg: "#000000", level1: "#0B0B0C", card: "#141415", chip: "#262628", chipSoft: "#1C1C1E", glass3: "rgba(20, 20, 22, 0.94)" },
  { id: "noche", name: "Azul noche", bg: "#0A0E17", level1: "#0F1420", card: "#161C29", chip: "#252D3D", chipSoft: "#1C2332", glass3: "rgba(22, 28, 41, 0.94)" },
];

export const DEFAULT_THEME: ThemePrefs = { accent: "lima", bg: "grafito", brand: true };

const LIME = ACCENTS[0];
const CACHE_KEY = "rmordie_theme_v1";

/** Acepta lo guardado aunque venga incompleto o con valores antiguos. */
export function normalizeTheme(raw: unknown): ThemePrefs {
  const t = (raw && typeof raw === "object" ? raw : {}) as Partial<ThemePrefs>;
  return {
    accent: ACCENTS.some((a) => a.id === t.accent) ? (t.accent as AccentId) : DEFAULT_THEME.accent,
    bg: BACKGROUNDS.some((b) => b.id === t.bg) ? (t.bg as BackgroundId) : DEFAULT_THEME.bg,
    brand: typeof t.brand === "boolean" ? t.brand : DEFAULT_THEME.brand,
  };
}

export function readCachedTheme(profileId: string | null): ThemePrefs | null {
  if (!profileId) return null;
  try {
    const raw = window.localStorage.getItem(`${CACHE_KEY}:${profileId}`);
    return raw ? normalizeTheme(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function writeCachedTheme(profileId: string | null, theme: ThemePrefs) {
  if (!profileId) return;
  try {
    window.localStorage.setItem(`${CACHE_KEY}:${profileId}`, JSON.stringify(theme));
  } catch {
    /* almacenamiento no disponible */
  }
}

/** Pone en la página las variables de color del tema. */
export function applyTheme(theme: ThemePrefs) {
  if (typeof document === "undefined") return;
  const a = ACCENTS.find((x) => x.id === theme.accent) ?? LIME;
  const b = BACKGROUNDS.find((x) => x.id === theme.bg) ?? BACKGROUNDS[0];
  const st = document.documentElement.style;
  st.setProperty("--gold", a.color);
  st.setProperty("--gold-rgb", a.rgb);
  st.setProperty("--gold-light", a.light);
  st.setProperty("--gold-deep", a.deep);
  st.setProperty("--gold-soft", a.soft);
  st.setProperty("--ring", `rgba(${a.rgb}, 0.6)`);
  // Logo y portada: con el color del usuario o con el lima de la marca.
  const brand = theme.brand ? a : LIME;
  st.setProperty("--aurora", `linear-gradient(135deg, ${brand.light} 0%, ${brand.color} 55%, ${brand.deep} 100%)`);
  st.setProperty("--background", b.bg);
  st.setProperty("--level-1", b.level1);
  st.setProperty("--card", b.card);
  st.setProperty("--chip", b.chip);
  st.setProperty("--chip-soft", b.chipSoft);
  st.setProperty("--glass-bg-3", b.glass3);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", b.bg);
}

/**
 * Aplica el tema del usuario mientras está dentro de la app.
 * Primero el guardado en el dispositivo (sin parpadeo) y luego el de su cuenta.
 */
export function useApplyTheme(profileId: string | null, remote: unknown) {
  const useIso = typeof window === "undefined" ? useEffect : useLayoutEffect;
  useIso(() => {
    const cached = readCachedTheme(profileId);
    if (cached) applyTheme(cached);
  }, [profileId]);
  useEffect(() => {
    if (remote == null || typeof remote !== "object" || Object.keys(remote as object).length === 0) return;
    const t = normalizeTheme(remote);
    applyTheme(t);
    writeCachedTheme(profileId, t);
  }, [profileId, remote]);
}
