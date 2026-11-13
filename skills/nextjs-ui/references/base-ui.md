# Base UI

[Base UI](https://base-ui.com) (`@base-ui/react`) is the unstyled, accessible component library under shadcn's Base UI styles (`"style": "base-*"` in `components.json`). The team's default for new projects is **shadcn on Base UI**; a project already on Radix stays on Radix until it migrates on purpose (one flavour per project, `shadcn.md`).

**The package documents itself:** `node_modules/@base-ui/react/docs/` holds the docs for the installed version (`react/components/<name>.md`, `react/handbook/{composition,styling,animation,forms,customization}.md`, `react/utils/{merge-props,use-render}.md`). Read the component's page there before using a part or prop you're unsure of; it wins over memory and over Radix habits. The package was renamed from `@base-ui-components/react`: import only from `@base-ui/react/<component>`.

## Setup

```sh
yarn add @base-ui/react
```

```tsx
// app/layout.tsx
<body className="relative">                 {/* iOS 26+ Safari: backdrops need a positioned body */}
  <div className="isolate">{children}</div>  {/* own stacking context, so portaled popups sit on top */}
</body>
```

Shared providers once near the root, only for the parts the app uses: `Tooltip.Provider` (shared open/close delays), `DirectionProvider` for RTL, `CSPProvider` when inline styles need a nonce. The team's toasts stay on sonner (`shadcn.md`); don't add Base UI's `Toast` beside it.

## Anatomy: compound parts, portals, positioners

Every component is a set of parts imported from one entry point:

```tsx
import { Dialog } from "@base-ui/react/dialog";

<Dialog.Root>
  <Dialog.Trigger />
  <Dialog.Portal>
    <Dialog.Backdrop />
    <Dialog.Viewport>
      <Dialog.Popup>
        <Dialog.Title />
        <Dialog.Description />
        <Dialog.Close />
      </Dialog.Popup>
    </Dialog.Viewport>
  </Dialog.Portal>
</Dialog.Root>
```

- Floating parts (Popover, Menu, Select, Tooltip, Combobox, PreviewCard) go `Portal` → `Positioner` (placement: `side`, `align`, `sideOffset`) → `Popup`.
- Popups are unmounted when closed unless the `Portal` has `keepMounted`.
- The shadcn primitives in `components/shadcn-ui/` wrap these parts with tokens and `data-slot` attributes; pages use the wrappers, and drop down to raw parts only inside a composite.

## Composition: `render`, not `asChild`

```tsx
<Menu.Trigger render={<Button variant="outline" />}>Actions</Menu.Trigger>
<Accordion.Header render={<h2 />}>...</Accordion.Header>
<Button render={<Link href="/items/new" />} nativeButton={false}>New item</Button>
```

- `render` takes an element (its props are merged with the part's) or a function `(props, state) => element` for state-dependent content.
- **The rendered component must forward `ref` and spread every received prop onto its DOM node**, or focus, ARIA and events break.
- Nest `render` to stack behaviours (a Tooltip trigger that is also a Dialog trigger).
- **`nativeButton`:** parts that render a `<button>` assume `nativeButton={true}`; when `render` swaps in something else (a link, a `div`), set `nativeButton={false}` so Base UI adds the keyboard and ARIA handling a non-button needs. A few parts default to `false`; their docs say so.
- Your own parts use `useRender` (the same `render` contract for a custom component) and `mergeProps` (merges handlers, class names, styles and refs correctly).

## Styling (with the tokens from `tailwind.md`)

- `className` accepts a string or a function of state: `className={(s) => cn("...", s.checked && "...")}`.
- **State lives in data attributes**; style them with Tailwind's `data-*` variants:

  | Attribute | Use |
  |---|---|
  | `data-open`, `data-closed` | open/closed popups, panels, triggers |
  | `data-checked`, `data-unchecked`, `data-pressed` | checkbox, switch, radio, toggle |
  | `data-highlighted`, `data-selected` | keyboard/hover item in menus, selects, comboboxes |
  | `data-disabled`, `data-readonly`, `data-required` | form state |
  | `data-invalid`, `data-valid`, `data-dirty`, `data-touched`, `data-focused`, `data-filled` | Field state |
  | `data-side`, `data-align` | where a positioned popup ended up |
  | `data-starting-style`, `data-ending-style` | enter/exit transitions |

- **CSS variables** from positioners and popups: `--transform-origin`, `--available-height`, `--available-width`, `--anchor-width`. Use them as `origin-(--transform-origin)`, `max-h-(--available-height)`, `min-w-(--anchor-width)`.
- **Animations:** prefer transitions (they cancel smoothly mid-way): `transition-[opacity,scale] data-starting-style:opacity-0 data-starting-style:scale-95 data-ending-style:opacity-0 data-ending-style:scale-95`. Keyframe animations go on `data-open` / `data-closed`. JavaScript animation (Motion) needs a controlled `open`, `keepMounted` on the Portal, and `render={<motion.div />}` on the Popup.
- Colors only through tokens: the upstream docs' examples use palette classes (`bg-white`, `text-neutral-950`); translate them to `bg-popover text-popover-foreground`, `data-highlighted:bg-accent data-highlighted:text-accent-foreground`, and so on.

## Behaviour and events

- Components are uncontrolled by default; control them with `open`/`onOpenChange`, `value`/`onValueChange`, `checked`/`onCheckedChange`, `pressed`/`onPressedChange`.
- Change handlers get `(value, eventDetails)`: `eventDetails.reason` says why (`"trigger-press"`, `"escape-key"`, `"outside-press"`, ...), `cancel()` stops the change without controlling the component, `allowPropagation()` lets the DOM event bubble (by default `Esc` stops at the innermost popup).
- `event.preventBaseUIHandler()` in a React handler skips Base UI's own handling: an escape hatch, not a pattern.
- `Popover` is non-modal by default (`modal` prop); `Dialog` and `AlertDialog` are modal. A form or confirmation is a Dialog/AlertDialog, a non-blocking panel a Popover.
- `Select.Root items={[{ value, label }]}` lets `Select.Value` show the label instead of the raw value; use a `placeholder`, or a `null` item if the user must be able to clear it.

## Forms

The team's forms run on react-hook-form + zod (`shadcn.md`). With Base UI controls:

- Text inputs register directly (`<Input {...form.register("name")} />`).
- Controls that report values through callbacks (Select, Checkbox, Switch, RadioGroup, Slider, NumberField, Combobox) go through `Controller` and map `value`/`onChange` to the part's `value`/`onValueChange` (or `checked`/`onCheckedChange`).
- Server field errors (from a 422 `Result`) are set with `form.setError(field, { message })`.

Base UI also has its own `Form` + `Field` (`Field.Root name`, `Field.Label`, `Field.Control`, `Field.Description`, `Field.Error`, `validationMode`, a `validate` function, server `errors` on `Form`, `useActionState` support). Use it only where a form doesn't use react-hook-form, and never mix the two systems in one form.

## Accessibility

- Base UI wires roles, `aria-*`, focus trapping and keyboard navigation; keep it working: forward refs, spread props, set `nativeButton` correctly, and don't stop keyboard events.
- Give every Dialog/AlertDialog a `Title` (and a `Description` where there is text), every field a label, every icon-only trigger an `aria-label`.
- Test with role queries (`getByRole("dialog", { name })`, `getByRole("option", { name })`); open popups by user events (`userEvent.click(trigger)`), because they're portaled and unmounted while closed.

## Coming from Radix

| Radix | Base UI |
|---|---|
| `asChild` | `render={<Child />}` (+ `nativeButton={false}` when the child isn't a button) |
| `Content` | `Portal` → `Positioner` → `Popup` |
| `Overlay` | `Backdrop` |
| `data-state="open"` / `"closed"` | `data-open` / `data-closed` |
| `data-state="checked"` | `data-checked` |
| `onOpenChange(open)` | `onOpenChange(open, eventDetails)` |
| `forceMount` | `keepMounted` on the Portal |
| `Select.Value` showing the label from children | `Select.Root items` (or a `Select.Value` children function) |

Migrating a project means regenerating the shadcn primitives in a Base UI style, carrying local edits over, and replacing `asChild` and `data-state` selectors in composites and pages; do it as its own change.

## Checklist

- [ ] Imports from `@base-ui/react/<component>`; docs read from `node_modules/@base-ui/react/docs/` for anything unsure
- [ ] `isolate` root and positioned `body` in the layout; providers only for parts in use
- [ ] `render` (never `asChild`); rendered components forward refs and spread props; `nativeButton={false}` for non-button triggers
- [ ] State styled through `data-*` variants and the exposed CSS variables; colors only through tokens
- [ ] Transitions on `data-starting-style`/`data-ending-style`; `keepMounted` + controlled `open` for JS animation
- [ ] Callback-driven controls bound through react-hook-form `Controller`; no mixing with Base UI `Form` in one form
- [ ] Titles, labels and names present; tests open popups by user events and query by role
