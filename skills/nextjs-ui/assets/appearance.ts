// assets/appearance.ts — the appearance module for mechanism C (everything saved on the user's
// account, painted by the server). Copy to src/libs/appearance.ts and adapt the option lists,
// the cookie name and the defaults.
//
// STATUS: proven shape (in production use), generalised. The backend saves the choice and writes
// the cookie `v1.<mode>.<preset>.<font>` as a paint hint whenever it saves or reads it; the
// browser never writes that cookie, so it can be HttpOnly. The option lists must match the
// backend's (a fixture both sides test against).

export const MODES = ["light", "dark", "system"] as const;
export const PRESETS = ["default", "ocean", "green"] as const; // ADAPT: one entry per [data-theme] block
export const FONTS = ["inter", "system", "roboto", "geist"] as const; // ADAPT: one per [data-font] block

export type Mode = (typeof MODES)[number];
export type Preset = (typeof PRESETS)[number];
export type Font = (typeof FONTS)[number];

export interface Appearance {
  mode: Mode;
  preset: Preset;
  font: Font;
}

export const APPEARANCE_DEFAULTS: Appearance = { mode: "light", preset: "default", font: "inter" };

export const APPEARANCE_COOKIE = "app_appearance"; // ADAPT

function pick<T extends string>(options: readonly T[], value: unknown, fallback: T): T {
  return options.includes(value as T) ? (value as T) : fallback;
}

/**
 * Reads a cookie value (`v1.<mode>.<preset>.<font>`) or a reply object ({mode, preset, font}).
 * Each axis that isn't a known option gets its default; any other shape gets all defaults.
 */
export function resolveAppearance(raw: unknown): Appearance {
  let mode: unknown, preset: unknown, font: unknown;
  if (typeof raw === "string") {
    const parts = raw.split(".");
    if (parts.length === 4 && parts[0] === "v1") [, mode, preset, font] = parts;
  } else if (raw && typeof raw === "object") {
    ({ mode, preset, font } = raw as Record<string, unknown>);
  }
  return {
    mode: pick(MODES, mode, APPEARANCE_DEFAULTS.mode),
    preset: pick(PRESETS, preset, APPEARANCE_DEFAULTS.preset),
    font: pick(FONTS, font, APPEARANCE_DEFAULTS.font),
  };
}

/**
 * The <html> attributes the root layout stamps from the cookie value. `dark` says whether to add
 * the .dark class; for system, MODE_SCRIPT decides that in the browser.
 */
export function layoutAttributes(raw: unknown) {
  const { mode, preset, font } = resolveAppearance(raw);
  return { "data-mode": mode, "data-theme": preset, "data-font": font, dark: mode === "dark" };
}

/**
 * The root layout's inline <head> script. A constant (CSP-hashable): it never reads the cookie and
 * carries nothing from the request. Before paint it resolves .dark from the OS when data-mode is
 * system, and it keeps listening for OS changes, applying them only while data-mode is system, so
 * a later in-page switch to System follows the OS.
 */
export const MODE_SCRIPT =
  '(function(){try{var d=document.documentElement,q=window.matchMedia("(prefers-color-scheme: dark)");' +
  'var s=function(){if(d.getAttribute("data-mode")==="system")d.classList.toggle("dark",q.matches)};' +
  's();q.addEventListener("change",s)}catch(e){}})()';

/** Stamps a choice on <html> at once (the picker): data-mode, data-theme, data-font and .dark. */
export function applyAppearance(prefs: Appearance) {
  const html = document.documentElement;
  html.dataset.mode = prefs.mode;
  html.dataset.theme = prefs.preset;
  html.dataset.font = prefs.font;
  const dark =
    prefs.mode === "dark" || (prefs.mode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  html.classList.toggle("dark", dark);
}
