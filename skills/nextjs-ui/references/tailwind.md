# Tailwind CSS v4 in Next.js

Tailwind v4 is configured **in CSS**, not in `tailwind.config.js`. Components are colored **only with semantic tokens** (`bg-card`, `text-muted-foreground`, `bg-primary`), so light/dark mode and themes work by swapping CSS variables, never by editing components.

Related: [shadcn.md](shadcn.md) (the primitives built on these tokens), [themes.md](themes.md) (light/dark/system mode, color presets, per-tenant branding, fonts, the picker and painting without a flash).

## 1. Setup

```js
// postcss.config.mjs
export default { plugins: { "@tailwindcss/postcss": {} } };
```

```css
/* app/globals.css */
@import "tailwindcss";

@custom-variant dark (&:where(.dark, .dark *));   /* dark: follows a .dark class, not only the OS */

:root {                    /* light values */
  --background: oklch(1 0 0);
  --foreground: oklch(0.15 0 0);
  --primary: oklch(0.45 0.2 265);
  --primary-foreground: oklch(0.98 0 0);
  --success: oklch(0.65 0.15 160);
  --success-foreground: oklch(0.98 0 0);
  /* card, popover, muted, accent, destructive, border, input, ring, warning, info, chart-1..5, ... */
}
.dark {                    /* dark values: same names */
  --background: oklch(0.15 0 0);
  --foreground: oklch(0.96 0 0);
}

@theme inline {            /* expose variables as utilities: bg-primary, text-success-foreground, ... */
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-success: var(--success);
  --color-success-foreground: var(--success-foreground);
  --font-sans: var(--font-inter), ui-sans-serif, system-ui, sans-serif;
  --radius-lg: var(--radius);
}

@layer base {
  * { @apply border-border outline-ring/50; }
  body { @apply bg-background text-foreground; }
}
```

- `@theme inline` (not plain `@theme`) because the values are `var(...)`: the utility must read the variable at use time so a `.dark` or `[data-theme]` scope can change it.
- Themes beyond light/dark: more variable blocks on `[data-theme="<name>"]` (and `.dark[data-theme="<name>"]`), switched by an attribute on `<html>`, no rebuild.
- Set the mode class before first paint (a small inline script in the root layout reading the saved choice or `prefers-color-scheme`) to avoid a flash; `suppressHydrationWarning` on `<html>`.
- Fonts from `next/font` expose CSS variables (`variable: "--font-inter"`) that `@theme` points `--font-sans` at.
- No `tailwind.config.js` in a new v4 project. A legacy one can be loaded with `@config "../tailwind.config.js";` while migrating; remove it once its values are tokens.

## 2. Token rules

- **Surfaces:** `bg-background`, `bg-card`, `bg-popover`, `bg-muted`, `bg-sidebar`; borders `border-border`, fields `border-input`; focus `ring-ring`.
- **Text:** `text-foreground`, `text-muted-foreground`; on a solid fill, that fill's `-foreground` pair (`bg-primary text-primary-foreground`).
- **Status:** `success`, `warning`, `info`, `destructive` (each with `-foreground`); tints with opacity: `bg-success/10 text-success`.
- **Categories in charts and badges:** `chart-1` … `chart-5`.
- **Never** literal palette classes (`text-slate-500`, `bg-blue-600`, `border-gray-200`, `bg-white`, `text-black`), arbitrary colors (`bg-[#1a2352]`, `text-[rgb(...)]`, `bg-[oklch(...)]`) or inline `style={{ color }}`. They look right in the mode the author used and break in the other. A token that doesn't exist yet gets added to `:root`, `.dark` and `@theme inline` together.
- A deliberate exception (a printed slip that is always white paper) goes on an explicit allow-list with its reason.

## 3. Writing classes

- **`cn()`** (`clsx` + `tailwind-merge`) for conditional and overridable classes: `cn("rounded-md border px-3", active && "bg-accent", className)`. Components accept `className` and merge it last.
- **Classes must be literal strings** in the source. Tailwind scans files for complete class names; `bg-${color}-500` is never generated. Map a variant to full class strings (`const tone = { ok: "bg-success/10 text-success", bad: "bg-destructive/10 text-destructive" }`) or use `cva` for component variants.
- Mobile-first: unprefixed is the phone layout, `sm:`/`md:`/`lg:` widen it. Use container queries (`@container`, `@md:`) for components whose layout depends on their own width.
- Prefer the spacing scale (`p-4`, `gap-2`) and theme radii (`rounded-lg`); arbitrary values (`w-[372px]`) only for one-off measurements, never for colors.
- Numbers in tables: `tabular-nums`, not a monospace font.
- `@apply` only in `globals.css` base styles, not to build component classes; components are React components.
- Long or repeated class lists become a component or a `cva` variant, not a string constant shared across files.
- Optional: `prettier-plugin-tailwindcss` sorts classes; use it if the project has Prettier.

## 4. Monorepos and packages

- Tailwind scans the app's own files automatically (respecting `.gitignore`). A shared UI package outside the app needs `@source "../../packages/ui/src";` in the app's CSS.
- Tokens and base styles live once (in the UI package's CSS, imported by each app, or in each app's `globals.css` if apps theme differently); utilities are generated per app.

## 5. Migrating

- **From v3:** run `yarn dlx @tailwindcss/upgrade`, then move `theme.extend` values into `@theme`, replace `tailwind.config.js` content paths with automatic detection (`@source` for the rest), and check renamed utilities (`shadow-sm` → `shadow-xs`, `ring` width, `outline-none` → `outline-hidden`) in the v4 upgrade guide.
- **From hard-coded colors:** grep for literal palette, hex and `rgb(`/`oklch(` arbitrary classes, map each to a token by role (surface, text, border, status, category), and add the enforcement test before the last file is converted so no new ones arrive.

## 6. Enforce it

- A test (and optionally an editor hook) scans `app/` and `components/` for literal palette classes, arbitrary color values and inline color styles, with an allow-list of file + pattern + reason, and suggests the token to use.
- Look at the page in light and dark mode (screenshots from a Playwright script) before calling a visual change done.

## Checklist

- [ ] `@import "tailwindcss"` + `@tailwindcss/postcss`; no new `tailwind.config.js`
- [ ] Tokens defined in `:root`, `.dark` (and themes), exposed with `@theme inline`
- [ ] Only semantic token classes; no palette, hex or inline colors outside the allow-list
- [ ] Literal class names; `cn()` for merging; `cva` or a lookup for variants
- [ ] `@source` for shared packages; mode set before paint
- [ ] Checked in light and dark
