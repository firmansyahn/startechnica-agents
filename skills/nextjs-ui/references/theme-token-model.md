# Token model and migration rules

The mental model for shadcn + Tailwind v4 theming, and the rules for moving hard-coded colors onto tokens.

## `@theme` vs `@theme inline` (the load-bearing distinction)

```css
@theme {
  --color-brand-500: oklch(45% 0.11 274);  /* FIXED at build — cannot switch */
  --font-display: "Some Display", ui-serif;
}
@theme inline {
  --color-primary: var(--primary);         /* runtime var() reference — DOES switch */
  --color-success: var(--success);
}
```

- `@theme inline` maps a utility (`bg-primary`) to `var(--primary)`. A `[data-theme="ocean"] { --primary: ... }` block re-resolves it live: no rebuild, no fetch. **Presets target this layer only.**
- Plain `@theme` inlines a literal at build. A preset can't override it. Use it for fixed ramps and fonts, never for anything that must recolor.
- **Failure mode:** a value that must switch but sits in plain `@theme` silently stays fixed. When a preset "doesn't fully recolor", look here first.

## Roles name a job, not a color

Pick a token by asking *"what surface is this on, and what is the text's job?"*, never "what color do I want".

| Role pair | Means | Typical use |
|---|---|---|
| `background` / `foreground` | page and default text | body, paragraphs |
| `card` / `card-foreground` | raised panel | cards, dialog body |
| `popover` / `popover-foreground` | floating overlay | dropdowns, tooltips |
| `primary` / `primary-foreground` | the headline brand action | primary button, active nav |
| `secondary` / `secondary-foreground` | quieter action | secondary button, chips |
| `muted` / `muted-foreground` | de-emphasised surface, dim text | helper text, placeholders |
| `accent` / `accent-foreground` | hover/highlight surface | hovered row, selected item |
| `destructive` / `destructive-foreground` | danger | delete, error |
| `border` / `input` / `ring` | hairline / field / focus | borders, inputs, focus ring |
| `navbar`, `sidebar` (+ `-foreground`) | app chrome surfaces | top bar, side rail |

Chrome that stays dark while the page is light is its own surface with its own `-foreground`; use that, never the global `foreground` (tuned for the page, unreadable on the bar).

## Migration rules (hard-coded color → token)

1. **Brand color as a fill, border or surface → `primary`** (or the matching role): buttons, active-nav backgrounds, accent bars.
2. **Brand-ish color as TEXT → `foreground` / `muted-foreground`, never `primary`.** A saturated brand hue as body text fails legibility under some presets.
3. **White on a brand surface → the paired `-foreground`** (`primary-foreground`).
4. **Gradients are monochromatic brand washes:** `from-primary to-primary/70`, never `from-primary to-<some-blue>`; a hard-coded second hue breaks every preset whose primary isn't that hue.
5. **Status colors are semantic and don't recolor per preset.** Success is green and destructive is red in every theme: declare them once in `:root`/`.dark` and let presets inherit.
6. **Neutral ramps and deliberate fixed accents stay constant.** If a token is meant to be the same in every theme, don't put it in preset blocks; overriding it is the bug.
7. **One `primary` button per view.** Everything else steps down: secondary/outline for cancel/back, ghost for icon and row actions, link for inline navigation, destructive for delete. Semantic actions (approve/reject) keep status tokens.

## What presets override vs inherit

A `[data-theme]` block re-declares only what changes; everything else inherits from `:root` (light) and `.dark` (dark).

- **Override in every preset (the switchable set):** background, card, popover, primary, secondary, accent, muted (each with `-foreground`), border, input, ring, destructive (+ foreground, if the brand changes its tone), the chrome surface pairs actually used, `chart-1` … `chart-5`.
- **Inherit (don't override):** status colors (success, warning, info, failed/pending/...), neutral ramps, fixed accents.

## Light and dark composition

Each preset is a light block `[data-theme="x"]` plus a paired dark block `[data-theme="x"].dark`. Use that one selector form for every preset; mixing `.dark[data-theme="x"]` and `[data-theme="x"].dark` across presets makes override order unpredictable. `default` is `:root` / `.dark` (with `[data-theme="default"]` added to those selectors if a subtree must be able to pin it).

## Why authored CSS, not a registry injected at runtime

`[data-theme]` blocks are authored CSS: Tailwind v4 emits them verbatim and never purges them (they aren't utility classes). Every preset ships in the stylesheet; switching is an attribute change. A TypeScript registry injected as `<style>` adds hydration surface for no gain. Guard against a future purge regression with a build-output check that each `[data-theme="<name>"]` selector is present. (The one exception is a per-tenant custom brand color, `theme-presets.md`.)
