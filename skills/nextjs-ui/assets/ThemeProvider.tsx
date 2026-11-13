// assets/ThemeProvider.tsx — UNIFIED theme provider (mode + appearance).
//
// STATUS: PLAN-DERIVED. Designed but not yet run in production. Validate on first
// real use and replace this with the shipped version. Adapt import paths + the
// server-action name to the target repo.
//
// One root provider owns BOTH axes but keeps the mechanisms disjoint:
//   - mode (light/dark/auto): next-themes -> .dark class + localStorage
//   - preset/font: data-* attributes on <html> + session (via server action)
// Mount ONCE at the root layout, above both surfaces' Providers.

"use client";

import { ThemeProvider as NextThemes, useTheme } from "next-themes";
import * as React from "react";
// ADAPT: point at your server action (see set-appearance.action.ts)
import { setAppearanceAction } from "@/services/appearance/actions";

type Mode = "light" | "dark" | "system";

type AppearanceCtx = {
  preset: string;
  font: string;
  setTheme: (preset: string) => void; // preset, not mode (mode uses next-themes useTheme)
  setFont: (font: string) => void;
};

const AppearanceContext = React.createContext<AppearanceCtx | null>(null);

export function useAppearance(): AppearanceCtx {
  const ctx = React.useContext(AppearanceContext);
  if (!ctx) throw new Error("useAppearance must be used within <ThemeProvider>");
  return ctx;
}

export function ThemeProvider({
  children,
  defaultMode = "light",
  initialPreset = "default",
  initialFont = "inter",
  sessionMode, // session.theme?.mode, for cross-device seed
}: {
  children: React.ReactNode;
  defaultMode?: Mode;
  initialPreset?: string;
  initialFont?: string;
  sessionMode?: Mode;
}) {
  return (
    <NextThemes
      attribute="class"          // toggles .dark — matches @custom-variant dark
      defaultTheme={defaultMode} // from THEME_MODE_DEFAULT
      enableSystem               // knob offers light/dark/auto
      disableTransitionOnChange
    >
      <AppearanceInner
        initialPreset={initialPreset}
        initialFont={initialFont}
        sessionMode={sessionMode}
      >
        {children}
      </AppearanceInner>
    </NextThemes>
  );
}

function AppearanceInner({
  children,
  initialPreset,
  initialFont,
  sessionMode,
}: {
  children: React.ReactNode;
  initialPreset: string;
  initialFont: string;
  sessionMode?: Mode;
}) {
  const [preset, setPreset] = React.useState(initialPreset);
  const [font, setFontState] = React.useState(initialFont);
  const { setTheme: setMode } = useTheme();

  // Optimistic: flip the <html> attribute now (instant repaint), persist after.
  const setTheme = React.useCallback((next: string) => {
    document.documentElement.dataset.theme = next;
    setPreset(next);
    void setAppearanceAction({ preset: next });
  }, []);

  const setFont = React.useCallback((next: string) => {
    document.documentElement.dataset.font = next;
    setFontState(next);
    void setAppearanceAction({ font: next });
  }, []);

  // Seed-on-mount (cross-device): if localStorage had no mode but the session
  // does, adopt the session mode once. Guard so an explicit local choice wins.
  React.useEffect(() => {
    if (!sessionMode) return;
    try {
      if (!localStorage.getItem("theme")) setMode(sessionMode);
    } catch {
      /* localStorage unavailable — ignore */
    }
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = React.useMemo(
    () => ({ preset, font, setTheme, setFont }),
    [preset, font, setTheme, setFont],
  );

  return (
    <AppearanceContext.Provider value={value}>
      {children}
    </AppearanceContext.Provider>
  );
}

// Mode knob: a small wrapper so the user menu writes BOTH next-themes (runtime)
// and the session (durable) — keeps mode cross-device. ADAPT action import.
export function useMode() {
  const { theme, setTheme } = useTheme();
  const setModeBoth = React.useCallback(
    (m: Mode) => {
      setTheme(m);                        // runtime + localStorage
      void setAppearanceAction({ mode: m }); // durable session
    },
    [setTheme],
  );
  return { mode: (theme as Mode) ?? "system", setMode: setModeBoth };
}
