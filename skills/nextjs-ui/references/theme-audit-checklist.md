# Theming gap-hunt checklist

Run `../scripts/audit-theme.sh` first (mechanical), then walk this list (judgment). Each item: what to check, why it bites, how to confirm.

## Meta-rule: verify before trusting

Every assumption that looks right is a hypothesis until grepped against the live code: which session call the layout makes, what the Toaster passes, whether a token is used at all. **Grep the target repo before applying any rule.**

## Token layer

- [ ] **Partial preset blocks.** A `[data-theme]` block overrides the role tokens but skips `--chart-*` or a chrome surface, so those keep the old hue under every preset (silent). *Confirm:* every block contains `--chart-1` and each chrome surface token the app uses.
- [ ] **Wrong-layer override.** A value that must switch is a plain `@theme` constant, not `@theme inline`. *Confirm:* everything a preset re-declares is mapped as `@theme inline { --color-x: var(--x) }`.
- [ ] **Overriding tokens that should be fixed.** Status colors, neutral ramps or a fixed accent inside a `[data-theme]` block. *Confirm:* preset blocks hold only switchable role, chrome and chart tokens.
- [ ] **Dead starter tokens.** shadcn and template starters ship demo colors (`--color-midnight`, `--color-tahiti`, ...). *Confirm:* grep for uses; delete the unused.
- [ ] **Duplicate token sets.** A second status palette or a second brand ramp under another prefix duplicating the canonical set. Consolidate to one so contributors can't override the wrong one.
- [ ] **Authored-but-unused surface tokens.** A full `--sidebar*` set exists but the rail renders on `--navbar*` (or the reverse), so overriding it does nothing. *Confirm:* grep `bg-sidebar`/`text-sidebar`; zero hits means dead. Wire it or delete it.
- [ ] **Preset-name drift.** CSS block names, the config validator's list and the action's validator differ. One source of truth plus a parity test (CSS blocks ⊇ name list).

## Charts

- [ ] **`hsl(var(--chart-N))` around OKLCH tokens.** The color is invalid, so charts silently fall back and never show brand colors. *Confirm:* grep `hsl(var(--chart`; replace with bare `var(--chart-N)`. (If a chart library truly needs HSL, make the tokens HSL triples instead; match the format to the consumer.)
- [ ] **Canvas charts don't repaint on switch.** They read resolved colors once. Re-read the variables and re-render on mode or preset change.

## Chrome (especially when flipping dark chrome to light)

- [ ] **Dark-surface hovers on a light bar.** `hover:bg-navbar/90`, `data-[state=open]:bg-navbar/90`: translucent dark over dark, invisible on a light bar. *Confirm:* grep `bg-(navbar|sidebar)/[0-9]` in chrome files; replace with `bg-primary/10` (hover) and `bg-primary text-primary-foreground` or `bg-primary/10 text-primary` (active).
- [ ] **Active item has no affordance.** Often only `font-medium`. Flipping chrome is the moment to add a background (an addition, not a swap).
- [ ] **A renderer shared by two surfaces hard-codes one foreground.** A menu item rendered on both navbar and sidebar needs a `surface` prop to pick the right `-foreground`.
- [ ] **All chrome files swept.** Language switcher, layout toggle and notification button often live in the chrome with the same dark-surface hovers.
- [ ] **Neutral vs hue-tinted dark.** Dark surfaces all at the brand hue look tinted next to typical product dark themes, which use near-zero-chroma surfaces and keep hue only on accents. *Confirm:* dark `--background`/`--card`/`--muted`/`--border` have chroma ≈ 0; only `--primary`, `--ring` and `--chart-*` carry chroma. Keep the old tinted dark as a named preset if someone wants it.

## Tailwind v4 Preflight

- [ ] **Buttons lost the hand cursor.** v4's Preflight resets `button` to `cursor: default`. Restore `cursor: pointer` on enabled `button` and `[role="button"|"menuitem"|"tab"]`, excluding `:disabled`/`[aria-disabled="true"]`. The rule must be **unlayered** (outside any `@layer`): unlayered author styles beat every layer; inside `@layer base` it silently loses.

## Provider and runtime

- [ ] **`useTheme()` consumed with no provider mounted** (shadcn `sonner` does this): it silently no-ops. Mount the provider, or pass the resolved mode explicitly.
- [ ] **Hard-coded `theme="light"` on `<Toaster>`.** shadcn's `sonner.tsx` spreads props after `theme={...}`, so the caller's literal wins. Remove it.
- [ ] **The layout reads a narrow wrapper, not the session.** If the layout needs the saved theme, confirm it calls the real session reader, not a helper that returns only the locale.
- [ ] **Two providers where one suffices.** One root provider can own mode and appearance; don't mount a second lower just to re-read the session.
- [ ] **Two mechanisms fighting over `.dark`.** next-themes and a custom script both toggling the class cause flashes. One owner for `.dark`; `data-*` owned separately.
- [ ] **Font variable collision.** Two `next/font` loaders both set `variable: "--font-sans"`, so one is dead. Give each a distinct `--font-*` and point `--font-sans` at it per `[data-font]`.
- [ ] **Hydration warnings.** `suppressHydrationWarning` on `<html>`; render the mode control's resolved value only after mount.

## Migration scope

- [ ] **Brand color used as text mapped to `primary`.** Should be `foreground`/`muted-foreground` (`theme-token-model.md` rule 2).
- [ ] **Gradient with a hard-coded second hue** (rule 4).
- [ ] **Surface reach over-claimed.** "Every surface is themed" when a second app area is still a stub. Scope to what renders; list the rest as follow-up.
- [ ] **Empty env var passed to `next/image`.** Branding resolved with `process.env.X ?? default` keeps `X=` as `""`, and `<Image src="">` throws. Resolve with a coalesce (first non-empty after trim) and a bundled placeholder as the final fallback.
- [ ] **Audit change too large to review.** A hex sweep can touch hundreds of literals in dozens of files. Do it last (it depends on the tokens and blocks nothing), split per area, and treat the system as shippable without it.

## Final verification

- [ ] Build and type check green.
- [ ] `../scripts/audit-theme.sh` clean, or only documented exceptions.
- [ ] Contrast test passes for every preset × mode.
- [ ] Visual matrix: every preset × {light, dark}: default content unchanged, charts recolor, chrome readable, no flash on reload, toasts follow the mode.
