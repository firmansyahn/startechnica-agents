---
name: nextjs-ui
description: "Use for the visual layer of a Next.js App Router app built on Tailwind CSS v4 and shadcn/ui: setting up Tailwind (CSS-first config, @theme inline tokens), choosing classes and colors, adding or customizing shadcn components (components.json, primitives vs composites, forms, dialogs, tables, toasts, accessibility), Base UI primitives (@base-ui/react: render prop, nativeButton, data-* state styling, animations, events, migrating from Radix asChild), and runtime theming (light/dark/system mode, color presets, white-label or per-tenant branding, fonts, a theme picker, painting without a flash, migrating hard-coded colors onto tokens, color audits, contrast checks)."
user-invocable: true
license: MIT
compatibility: Designed for Claude Code, Codex, OpenCode, oh-my-pi or similar harness, and for Next.js apps.
metadata:
  author: firmansyahn
  version: "0.1.1"
---

# Next.js UI: Tailwind, shadcn, Base UI and themes

**Principle:** Colors come only from semantic theme tokens and primitives only from the shadcn folder, and nothing is done until it has been looked at in light and dark.

One system with three layers:

```
themes      CSS variables per mode / preset / font, switched by attributes on <html>
   ▲
tailwind    @theme inline maps the variables to utilities: bg-primary, text-muted-foreground, ...
   ▲
shadcn      primitives (generated, on Base UI) and the project's composites, colored only with those utilities
   ▲
pages       compose primitives and composites; never pick colors themselves
```

Related: `nextjs-app-structure` (how pages use components, and where component folders live), `nextjs-package-manager` (commands run through Yarn).

## Read the reference for the task

| Task | Reference |
|---|---|
| Set up Tailwind v4, write classes, `cn()`, variants, responsive, monorepo `@source`, migrate from v3 | [references/tailwind.md](references/tailwind.md) |
| Set up `components.json`, add or update a primitive, build a composite, forms, dialogs, tables, toasts, accessibility | [references/shadcn.md](references/shadcn.md) |
| Use Base UI parts directly: anatomy, `render` and `nativeButton`, `data-*` state styling, animations, events, forms, coming from Radix | [references/base-ui.md](references/base-ui.md) |
| Add light/dark/system, presets, fonts, a picker, per-user or per-tenant themes; theme an existing app | [references/themes.md](references/themes.md) |
| Which tokens switch, role tokens, rules for replacing hard-coded colors | [references/theme-token-model.md](references/theme-token-model.md) |
| Write a preset, chrome direction, fonts, logos, charts, the contrast test, custom tenant colors | [references/theme-presets.md](references/theme-presets.md) |
| Where the theme choice is stored, painting without a flash, the picker, theme tests | [references/theme-switching.md](references/theme-switching.md) |
| Audit an app's colors and theming for known pitfalls | [references/theme-audit-checklist.md](references/theme-audit-checklist.md) + `scripts/audit-theme.sh` |

## Rules

One file per rule in `rules/`; the file name is the rule ID. Cite a rule by its ID. Sections and prefixes: [rules/_sections.md](rules/_sections.md).

### Styling

| ID | Rule | Impact | Check |
|---|---|---|---|
| [ui-theme-tokens-only](rules/ui-theme-tokens-only.md) | Color with semantic tokens only | MEDIUM | test: kit (eslint warns; scan candidates) |
| [ui-status-color-map](rules/ui-status-color-map.md) | Status colors through one map of tokens | MEDIUM | review |
| [ui-no-dark-overrides](rules/ui-no-dark-overrides.md) | No manual dark: color overrides | MEDIUM | review |
| [ui-classname-layout-only](rules/ui-classname-layout-only.md) | className on primitives is for layout | MEDIUM | review |
| [ui-cn-merge-classes](rules/ui-cn-merge-classes.md) | cn() for conditional and overridable classes | LOW | review |
| [ui-literal-class-names](rules/ui-literal-class-names.md) | Write class names as complete literal strings | MEDIUM | review |
| [ui-gap-not-space](rules/ui-gap-not-space.md) | gap-*, not space-x-* / space-y-* | LOW | review |
| [ui-size-shorthand](rules/ui-size-shorthand.md) | size-* when width and height match | LOW | review |
| [ui-tabular-nums](rules/ui-tabular-nums.md) | Numbers use tabular-nums | LOW | review |
| [ui-no-arbitrary-values](rules/ui-no-arbitrary-values.md) | No arbitrary values where the scale has one | LOW | review |
| [ui-no-overlay-z-index](rules/ui-no-overlay-z-index.md) | No z-index on overlays | MEDIUM | review |
| [ui-third-party-follows-mode](rules/ui-third-party-follows-mode.md) | Make toasts and charts follow the theme | LOW | scan |
| [ui-no-theme-flash](rules/ui-no-theme-flash.md) | Paint the theme before first render, with one owner for .dark | LOW | review |

### Composition

| ID | Rule | Impact | Check |
|---|---|---|---|
| [ui-existing-primitive-first](rules/ui-existing-primitive-first.md) | Use an existing primitive or composite before writing markup | HIGH | review |
| [ui-composite-on-second-use](rules/ui-composite-on-second-use.md) | A pattern used twice becomes a composite | MEDIUM | review |
| [ui-one-primary-button](rules/ui-one-primary-button.md) | One primary button per view | LOW | review |
| [ui-button-pending-state](rules/ui-button-pending-state.md) | Buttons show pending state through disabled and a spinner, not a prop | MEDIUM | review |
| [ui-notice-composite](rules/ui-notice-composite.md) | Callouts and form-level messages use the notice composite | LOW | review |
| [ui-parts-inside-parents](rules/ui-parts-inside-parents.md) | Tabs, groups and items stay inside their parents | MEDIUM | review |
| [ui-base-ui-composition](rules/ui-base-ui-composition.md) | Compose Base UI parts with render, and set nativeButton for non-buttons | MEDIUM | scan |
| [ui-render-forward-props](rules/ui-render-forward-props.md) | Components passed to render forward refs and spread props | MEDIUM | review |
| [ui-one-primitives-folder](rules/ui-one-primitives-folder.md) | Import primitives from components/shadcn-ui only | LOW | eslint: kit (scan candidates) |

### Icons

| ID | Rule | Impact | Check |
|---|---|---|---|
| [ui-icon-library-lucide](rules/ui-icon-library-lucide.md) | lucide-react only | LOW | review |
| [ui-button-icon-data-icon](rules/ui-button-icon-data-icon.md) | Icons in buttons use data-icon, no size classes | LOW | review |
| [ui-icon-no-size-in-primitives](rules/ui-icon-no-size-in-primitives.md) | No size classes on icons inside primitives | LOW | review |
| [ui-dialog-title](rules/ui-dialog-title.md) | Title every dialog and name every icon button | MEDIUM | test |
| [ui-icon-decorative-hidden](rules/ui-icon-decorative-hidden.md) | Decorative icons stay hidden from screen readers | LOW | review |
| [ui-icon-color-from-text](rules/ui-icon-color-from-text.md) | Icon color comes from the text token | LOW | test: kit (`theme-tokens.test.ts`), eslint (palette warning), review |
| [ui-status-not-color-alone](rules/ui-status-not-color-alone.md) | Status is never shown by icon or color alone | MEDIUM | review |

### Overlays

| ID | Rule | Impact | Check |
|---|---|---|---|
| [ui-overlay-by-task](rules/ui-overlay-by-task.md) | Choose the overlay by what the user does in it | MEDIUM | review |
| [ui-confirm-composite](rules/ui-confirm-composite.md) | Destructive confirmations use the confirm composite | MEDIUM | review |
| [ui-overlay-locked-while-pending](rules/ui-overlay-locked-while-pending.md) | An overlay with a pending write can't be dismissed | MEDIUM | review |
| [ui-overlay-form-state](rules/ui-overlay-form-state.md) | Forms in overlays keep their state on failure and reset on open | MEDIUM | review |
| [ui-tooltip-not-sole-info](rules/ui-tooltip-not-sole-info.md) | Tooltips only add, never hold, information | MEDIUM | review |
| [ui-toast-for-outcomes](rules/ui-toast-for-outcomes.md) | Toasts for outcomes, not for questions or form errors | MEDIUM | review |

### States

| ID | Rule | Impact | Check |
|---|---|---|---|
| [ui-skeleton-first-load](rules/ui-skeleton-first-load.md) | First load shows a skeleton of the content, not a spinner page | MEDIUM | review |
| [ui-refetch-keeps-content](rules/ui-refetch-keeps-content.md) | Background refetches don't blank the content | MEDIUM | review |
| [ui-row-state-composite](rules/ui-row-state-composite.md) | Lists use the row-state composite with its default texts | MEDIUM | review |
| [ui-error-state-retry](rules/ui-error-state-retry.md) | Errors say what failed and offer a retry | MEDIUM | review |
| [ui-empty-state-action](rules/ui-empty-state-action.md) | Empty states say what's missing and what to do | LOW | review |
| [ui-read-only-disabled](rules/ui-read-only-disabled.md) | Read-only users see disabled controls with a reason, not missing ones | MEDIUM | review |
| [ui-disabled-reason-visible](rules/ui-disabled-reason-visible.md) | Disabled is never the only explanation | MEDIUM | review |

### Tables

| ID | Rule | Impact | Check |
|---|---|---|---|
| [ui-table-primitive](rules/ui-table-primitive.md) | Tables are the Table primitive plus the list composites | MEDIUM | review |
| [ui-table-headers-numbers](rules/ui-table-headers-numbers.md) | Every column has a header; numbers right-aligned | LOW | review |
| [ui-table-row-actions](rules/ui-table-row-actions.md) | Row actions sit in the last column as ghost icon buttons or a menu | MEDIUM | review |
| [ui-table-truncate-full-value](rules/ui-table-truncate-full-value.md) | Long text truncates with the full value available | LOW | review |
| [ui-table-scroll-container](rules/ui-table-scroll-container.md) | Wide tables scroll inside their container | MEDIUM | review |
| [ui-table-selection](rules/ui-table-selection.md) | Selection uses checkboxes with a select-all and a bulk action bar | MEDIUM | review |
| [ui-dates-formatted](rules/ui-dates-formatted.md) | Dates and times are formatted, localised and absolute | LOW | review |

### Layout

| ID | Rule | Impact | Check |
|---|---|---|---|
| [ui-page-title-component](rules/ui-page-title-component.md) | Every page starts with the page title component | LOW | review |
| [ui-spacing-steps](rules/ui-spacing-steps.md) | Spacing comes from a small set of steps | LOW | review |
| [ui-mobile-first](rules/ui-mobile-first.md) | Mobile first, and no horizontal page scroll | MEDIUM | review |
| [ui-content-width](rules/ui-content-width.md) | Content width is constrained for reading | LOW | review |
| [ui-cards-group-not-decorate](rules/ui-cards-group-not-decorate.md) | Cards group, they don't decorate | LOW | review |
| [ui-heading-hierarchy](rules/ui-heading-hierarchy.md) | Headings follow the page hierarchy | MEDIUM | review |

### Accessibility

| ID | Rule | Impact | Check |
|---|---|---|---|
| [ui-keyboard-operable](rules/ui-keyboard-operable.md) | Everything works with the keyboard | HIGH | review |
| [ui-focus-visible](rules/ui-focus-visible.md) | Focus is always visible | HIGH | review |
| [ui-visible-labels](rules/ui-visible-labels.md) | Names come from visible labels | HIGH | review |
| [ui-announce-changes](rules/ui-announce-changes.md) | Errors and changes are announced | MEDIUM | review |
| [ui-reduced-motion](rules/ui-reduced-motion.md) | Motion respects reduced-motion | LOW | review |
| [ui-contrast-aa](rules/ui-contrast-aa.md) | Contrast meets AA in every theme | MEDIUM | test |
| [ui-links-vs-buttons](rules/ui-links-vs-buttons.md) | Links go places, buttons do things | MEDIUM | review |
| [ui-test-by-role](rules/ui-test-by-role.md) | Tests query by role and name | LOW | review |

If the upstream shadcn skill is installed too, its rules apply as well; where they differ, these win for the team.

## Files

| File | What it is |
|---|---|
| `scripts/audit-theme.sh` | Read-only scan of an app: stack detection, hard-coded colors, chart and Toaster bugs, dead or duplicate tokens, existing presets. `bash scripts/audit-theme.sh <app-root>`; `UI_DIR="app components src"` chooses the folders |
| `assets/theme-presets.css` | Ready OKLCH preset pairs (light + dark) to rename and adapt |
| `assets/appearance.ts` | Theme mechanism C (choice saved on the account, painted by the server): option lists, cookie parser, layout attributes, constant mode script, `applyAppearance`. Proven shape |
| `assets/ThemeProvider.tsx`, `assets/set-appearance.action.ts` | Theme mechanism B (next-themes for mode, session for preset/font). Plan-derived: validate on first use |

## Rules that hold everywhere

1. **Colors only through semantic tokens** (`bg-card`, `text-muted-foreground`, `bg-primary text-primary-foreground`, `bg-success/10 text-success`, `chart-1..5`). No palette classes (`text-slate-500`, `bg-white`), arbitrary colors (`bg-[#1a2352]`) or inline color styles; a test enforces it (`assets/tests/theme-tokens.test.ts`), with an allow-list for deliberate exceptions.
2. **Tokens switch only through `@theme inline`** (`--color-x: var(--x)`); plain `@theme` values are fixed at build.
3. **One primitives folder, `components/shadcn-ui/`, generated by the shadcn CLI** (`yarn dlx shadcn@latest add ...`); edits there stay small, token-based and commented. Reused patterns become composites in `components/<brand>-ui/`. Pages don't restyle primitives with long class lists.
4. **One primitive flavour per project, Base UI by default** (`@base-ui/react`, `render` prop, `nativeButton={false}` for non-button triggers, state in `data-*` attributes); an existing Radix project (`asChild`) stays on Radix until it migrates on purpose.
5. **Class names are literal strings**; variants via `cva` or a lookup of full class strings; merge with `cn()`.
6. **One owner for `.dark`**: next-themes, or the server plus one constant inline script, never both. The right theme is painted before first render: no flash.
7. **Every preset defines the full switchable set for light and dark**; status colors and neutrals are inherited, not overridden. Option names are shared by CSS, config and validators, with a parity test.
8. **Third-party UI follows the mode** (Toaster without a hard-coded theme, charts on `var(--chart-N)`, never `hsl(var(...))` around OKLCH).
9. **Accessible by default:** dialogs titled, inputs labelled, icon buttons named; contrast tested per preset × mode (4.5:1 text, 3:1 control boundaries).
10. **Look before you call it done:** screenshots of the page in light and dark (and each preset when tokens changed).

## Reviewing

1. **Scope.** The diff (`git diff <base>...HEAD`), a merge request's files or the whole app, read for what this skill covers: components, page markup, class names and theme files.
2. **Scan.** `bash <this skill>/scripts/scan.sh <app-root>` lists candidates for the rules whose check includes `scan`. On a diff, keep only findings in changed lines or files. Every line is a candidate: open the rule and confirm it before reporting.
3. **Read** the changed code against the Rules above. Open each rule you cite and match its "Incorrect" shape, not just its title.
4. **Report** each finding in the format of `agent-skills-authoring` ("Scan scripts and findings"): impact, rule ID, file and line, what to change citing the rule's "Correct" shape; ordered by impact. Raise the impact one level on an authentication, payment or deletion path.
5. **Say what's not covered:** rules whose check is `test` or `eslint` but the project has no such test or lint rule. `kit` in the Check column means a ready-to-copy check exists (`nextjs-new-app`, references/enforcement-kit.md).

## Checklist

- [ ] Tailwind v4 CSS-first setup; tokens in `:root`/`.dark`/presets, exposed with `@theme inline`
- [ ] No literal colors outside the allow-list; literal class names; `cn()` merging
- [ ] Primitives from the CLI in one folder; composites for reused patterns; one primitive flavour
- [ ] Forms on react-hook-form + zod; confirm dialog and toasts instead of `confirm`/`alert`
- [ ] Theme mechanism chosen on purpose; no flash; presets complete; contrast test passes
- [ ] Audit script clean (when theming or migrating); screenshots in light and dark looked at
