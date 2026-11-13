# Presets, fonts and tokens

Background on which tokens switch and why: `theme-token-model.md`. A ready starting set of presets: `../assets/theme-presets.css`.

## The token set a preset owns

Write every preset against one list, so none is left half done.

| Group | In every preset block | Notes |
|---|---|---|
| Surfaces | `background`, `card`, `popover`, `muted` (+ `-foreground`) | |
| Brand | `primary`, `secondary`, `accent` (+ `-foreground`) | |
| Lines and focus | `border`, `input`, `ring` | |
| Chrome | the surfaces the app actually renders: `navbar`, `sidebar`, `sidebar-primary`, `sidebar-accent`, `sidebar-border`, ... (+ `-foreground`) | grep for uses first; don't author tokens nothing consumes |
| Data | `chart-1` … `chart-5` | a ramp of the preset's own hue; the most often forgotten group |
| Danger | `destructive` (+ `-foreground`) | only if the brand changes its tone; otherwise inherit |
| **Inherited, not in preset blocks** | status (`success`, `warning`, `info`, ...), neutral ramps, fixed accents | defined once in `:root` and `.dark` |
| Shape | `radius` | only if presets differ in roundness |

Keep the list in a comment above the presets in `globals.css`, and make a test fail when a `[data-theme="x"]` or `[data-theme="x"].dark` block lacks one (or contains an inherited token).

## CSS layout

```css
:root,
[data-theme="default"] {             /* default preset, light */
  color-scheme: light;
  --background: oklch(1 0 0);
  --primary: oklch(0.47 0.2 265);
  --primary-foreground: oklch(0.985 0 0);
  --success: oklch(0.65 0.15 160);   /* status: here only, inherited by presets */
  /* ...the full set... */
}
.dark,
[data-theme="default"].dark {        /* default preset, dark */
  color-scheme: dark;
  --background: oklch(0.17 0 0);
  /* ...the full set... */
}

[data-theme="ocean"] { /* switchable set, light */ }
[data-theme="ocean"].dark { /* switchable set, dark */ }

@theme inline {
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  /* ...one line per token... */
}
```

- One selector form for every preset: `[data-theme="x"].dark`. If the dark class can sit on an ancestor while a subtree pins its preset, add `.dark [data-theme="x"]` too.
- Only tokens mapped through `@theme inline` switch at runtime.
- OKLCH makes presets easy to derive: keep lightness and chroma per role, shift the hue for the brand, then run the contrast check.
- Dark surfaces near zero chroma (hue only on primary, ring and charts) read as a neutral, modern dark theme; keep a tinted dark as its own preset if wanted.

## Chrome direction

Decide once for all presets: is the navbar/sidebar light or dark in light mode? The common default is **light chrome with the brand as accent** (light surface, dark readable text, `bg-primary/10` hover, `bg-primary` or `bg-primary/10` active). Flipping legacy dark chrome to light requires sweeping its hover and active utilities (`theme-audit-checklist.md`, "Chrome").

If the app has both a top bar and a side rail, check whether they share one token or are separate surfaces before authoring overrides.

## Fonts

```tsx
// app/layout.tsx, module scope (next/font requires it)
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", preload: true });
const roboto = Roboto({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--font-roboto", preload: false });
```

```css
:root { --font-sans: var(--font-inter, var(--font-system)), var(--font-system); }
[data-font="roboto"] { --font-sans: var(--font-roboto), var(--font-system); }
[data-font="system"] { --font-sans: var(--font-system); }
@theme inline { --font-sans: var(--font-sans); }
```

Attach every loader's `.variable` class to `<html>`; preload only the default font. Each loader gets its own `--font-*` name (two loaders both claiming `--font-sans` silently kill one).

## Logos and images

- Two images toggled by mode classes (`<Logo className="dark:hidden" /> <LogoDark className="hidden dark:block" />`), or an SVG using `currentColor` / token variables.
- A tenant's uploaded logo needs a light and a dark variant, or a neutral container (`bg-card` with padding) so it reads on both.
- Branding URLs from env are resolved with a coalesce (first non-empty after trim), never `??`, with a bundled fallback image.

## Charts

- Series `var(--chart-1)` … `var(--chart-5)`; axes and grid `var(--muted-foreground)` / `var(--border)`; tooltips `bg-popover text-popover-foreground`. Never `hsl(var(--chart-N))` around OKLCH tokens.
- Canvas libraries read resolved colors with `getComputedStyle(document.documentElement).getPropertyValue("--chart-1")` and re-render when the mode or preset changes (a `MutationObserver` on `<html>` attributes, or the appearance store).

## Contrast check

A Vitest test parses `globals.css`, resolves each preset × mode token set (preset block over `:root`/`.dark`), converts OKLCH to sRGB and asserts:
- text pairs (`x` / `x-foreground`, `background` / `foreground`, `card` / `card-foreground`, `muted` / `muted-foreground`) ≥ 4.5:1
- `border`/`input`/`ring` against `background` ≥ 3:1 where they are a control's only boundary

It fails with the preset, mode and pair, so a new preset can't ship unreadable.

## Custom brand colors per tenant (only if fixed presets aren't enough)

- Accept one brand color, validated strictly (`#rrggbb`, or `oklch(L C H)` with bounded numbers).
- Derive the switchable set on the server (primary and its foreground by contrast, ring, chart ramp, chrome accents) for light and dark.
- Render it as `[data-theme="tenant-<id>"] { ... }` in a `<style>` element with the page's CSP nonce, and stamp `data-theme="tenant-<id>"`.
- Run the contrast check on the derived set before saving; refuse colors that can't meet it.
