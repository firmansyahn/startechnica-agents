# Themes: mode, presets, fonts

A theme is **CSS variables swapped by attributes on `<html>`**: never a rebuild, never a component change. Three independent axes:

| Axis | Values | Applied as |
|---|---|---|
| Mode | `light`, `dark`, `system` | `class="dark"` (resolved), `data-mode="<choice>"` |
| Preset | `default`, `<brand>`, ... | `data-theme="<preset>"` |
| Font | `inter`, `system`, ... | `data-font="<font>"` |

Components use only semantic token classes ([tailwind.md](tailwind.md)), so every axis reaches everything at once. Deeper detail: [theme-token-model.md](theme-token-model.md), [theme-presets.md](theme-presets.md), [theme-switching.md](theme-switching.md), [theme-audit-checklist.md](theme-audit-checklist.md). Starting code: `../assets/` (B: `ThemeProvider.tsx` + `set-appearance.action.ts`, plan-derived; C: `appearance.ts`, proven shape; presets: `theme-presets.css`). Scan: `../scripts/audit-theme.sh`.

## 1. Pick the mechanism

| Situation | Mechanism |
|---|---|
| Mode only, saved per device, no accounts | **A.** `next-themes` (`attribute="class"`, `defaultTheme="system"`, `enableSystem`) |
| Mode per device, preset/font per user session or env | **B.** next-themes for mode + `data-theme`/`data-font` stamped from the session |
| Mode, preset and font saved on the user's account, per-tenant defaults, server-painted | **C.** Own appearance module: server stamps attributes from a cookie, one constant script resolves `system` |

One owner for `.dark`: next-themes (A, B) **or** the server plus the constant script (C), never both.

## 2. Root layout (mechanism C shown)

```tsx
export default async function RootLayout({ children }: { children: ReactNode }) {
  const { dark, ...attrs } = layoutAttributes((await cookies()).get(APPEARANCE_COOKIE)?.value);
  return (
    <html lang={locale} {...attrs} className={cn(fontVariables, dark && "dark")} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: MODE_SCRIPT }} /></head>
      <body className="bg-background text-foreground font-sans antialiased">{children}</body>
    </html>
  );
}
```

- `suppressHydrationWarning` on `<html>` only.
- Reading `cookies()`/the session makes the layout dynamic; fine for signed-in apps. A static marketing site uses mechanism A.
- `color-scheme: light` in `:root`, `dark` in `.dark`, so scrollbars and native controls follow.

## 3. Rules

- **Every preset defines the full switchable set for both modes** (`[data-theme="x"]` and `[data-theme="x"].dark`): surfaces, brand roles, border/input/ring, the chrome surfaces in use, and `chart-1..5`. Status colors and neutral ramps are **inherited**, not overridden.
- **Only `@theme inline` tokens switch.** A value in plain `@theme` is fixed at build.
- **One source of truth for option names**, shared by the CSS blocks, the config validator and the save action, with a parity test.
- **Third-party UI follows the mode:** Toaster (no hard-coded `theme="light"`), charts, editors, maps.
- **Charts read tokens directly** (`var(--chart-1)`), never `hsl(var(--chart-1))` around OKLCH.
- **Print** uses the light styles (scope the `dark` variant to `@media not print`).
- **A subtree can pin a theme** (a brand preview, a printed slip) with its own `data-theme`/`class="dark"`.
- **Contrast is tested** per preset × mode (WCAG AA: 4.5:1 text, 3:1 control boundaries).

## 4. Theming an existing app (migration procedure)

1. **Detect the stack.** Next.js App Router, Tailwind v4 (`@import "tailwindcss"`, `@theme inline` in `globals.css`), shadcn primitives, and whether `next-themes` is installed. If one differs, say so before going on.
2. **Inventory, don't assume.** Run `bash ../scripts/audit-theme.sh <app-root>`. Then locate by grep: the runtime-config module, the session API, the root layout, the chrome components (navbar, sidebar). Record the real paths.
3. **Plan.** Preset names, mechanism (A/B/C), chrome direction (light or dark chrome in light mode), whether per-user saving is in scope. Large repos: write a plan first.
4. **Apply, in dependency order:**
   1. Config defaults (`THEME_PRESET_DEFAULT`, `THEME_FONT_DEFAULT`, `THEME_MODE_DEFAULT`, validated).
   2. CSS: `[data-theme]` pairs (start from `../assets/theme-presets.css`, full switchable set) and `[data-font]` blocks.
   3. Layout: stamp attributes, load fonts at module scope, mount one provider (B) or the script (C).
   4. Saving and the picker, if per-user.
   5. Migrate hard-coded colors onto role tokens (`theme-token-model.md` rules), area by area, last.
5. **Gap-hunt.** Walk `theme-audit-checklist.md`; rerun the script until clean or only documented exceptions remain.
6. **Verify.** Build and type check; contrast test; visual matrix of every preset × light/dark: default content unchanged, charts recolor, chrome readable, no flash on reload, toasts follow the mode.

## Checklist

- [ ] One owner for `.dark`; mechanism chosen on purpose
- [ ] Allow-listed option lists shared by CSS, config and action; unknown values fall back per axis
- [ ] Attributes painted before first render; no flash in any mode
- [ ] Every preset × mode defines the switchable set; status and neutrals inherited; contrast test passes
- [ ] Toaster, charts and other libraries follow the mode; logos switch per mode
- [ ] Picker applies instantly, saves server-side (merging), reverts on failure
- [ ] Audit script clean; checklist walked; screenshots of each preset in light and dark looked at
