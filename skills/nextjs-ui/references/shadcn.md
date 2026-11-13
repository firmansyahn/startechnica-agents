# shadcn/ui in Next.js

shadcn/ui copies component source into the project; it is not a dependency. The team's rules keep that copy maintainable: **generated primitives in one folder, the project's own composites in another, pages use both and build neither by hand.**

Related: [tailwind.md](tailwind.md) (the tokens every component uses), [themes.md](themes.md), `nextjs-app-structure` (how pages use the components), `nextjs-package-manager` (commands). If the official `shadcn` skill is installed, use it for CLI flags, registries and component docs; this skill is the team's conventions on top.

## 1. Setup (`components.json`)

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "<style>",
  "rsc": true,
  "tsx": true,
  "tailwind": { "config": "", "css": "app/globals.css", "baseColor": "neutral", "cssVariables": true, "prefix": "" },
  "aliases": {
    "components": "@/components",
    "ui": "@/components/shadcn-ui",
    "utils": "@/libs/utils",
    "lib": "@/libs",
    "hooks": "@/hooks"
  },
  "iconLibrary": "lucide"
}
```

- `"config": ""` for Tailwind v4 (no config file); `cssVariables: true` so components use tokens.
- Primitives live in `components/shadcn-ui/`: point `ui` there and `utils` at the file exporting `cn()`. Ban `@/components/ui` (shadcn's default) with ESLint `no-restricted-imports`, so a CLI run or a pasted example can't start a second folder. A project still on `components/ui` moves it in one commit.
- **One primitive flavour per project; Base UI by default.** New projects use a shadcn Base UI style (`"style": "base-*"`, `@base-ui/react`), whose parts compose with a `render` prop (`<DialogTrigger render={<Button />} />`); a project already on Radix (`asChild`) stays on it until it migrates on purpose. Never mix the two libraries' primitives, and copy examples from the flavour the project uses. Base UI details: [base-ui.md](base-ui.md).

## 2. Adding components

```sh
yarn dlx shadcn@latest add button dialog form      # never npx
yarn dlx shadcn@latest add --help                   # the installed CLI's options (overwrite, diff/view, paths)
```

Before re-adding a primitive that already exists, compare upstream with the local file and carry the local edits over; never `--overwrite` blind.

- Add a primitive only when a page needs it; commit the generated file on its own or with its first use.
- **Edits to primitives stay small and token-based** (a missing variant, a token instead of a color). Record why in a comment, because `add --overwrite` would erase it. Anything bigger is a composite.
- Primitives import each other and `cn()` through the aliases; never import a page or a composite from a primitive.

## 3. Primitives vs composites

| Layer | Folder | Examples |
|---|---|---|
| Primitives (generated) | `components/shadcn-ui/` | `button`, `input`, `select`, `dialog`, `sheet`, `table`, `form`, `field`, `tabs`, `sonner`, `skeleton` |
| Composites (the project's design system) | `components/<brand>-ui/` | form drawer, confirm dialog, table row states (loading/empty/error), pagination, search input, sortable head, write-aware buttons, notices, setting rows, page tabs, steppers |
| Feature components | `components/<area>/` or beside the page | editors and widgets specific to one product area |

- A pattern a second page needs (a table with row states and pagination, a create/edit drawer, a delete confirmation) becomes a composite, built from primitives, with a test.
- Pages compose primitives and composites; they don't restyle primitives with long class lists. Repeated overrides mean a missing variant or composite.

## 4. Patterns

- **Forms** (full pattern: `nextjs-forms`): `react-hook-form` + `zodResolver(schema)` with the `Form`/`FormField`/`FormItem`/`FormLabel`/`FormControl`/`FormMessage` set (or the newer `Field` components). The zod schema is shared with the server action; a 422's field errors are set with `form.setError(field, { message })`.
- **Create/edit:** a `Sheet` (drawer) or `Dialog` composite that keeps the form open on failure, shows the refusal inside it, and disables Save/Cancel while pending.
- **Confirmations:** an `AlertDialog`/`Dialog` based confirm composite (`await confirm({ title, destructive: true })`); never `window.confirm`/`alert`.
- **Toasts:** `sonner`'s `<Toaster />` mounted once in the layout, above dialog overlays; `toast.success`/`toast.error` through one mutation-feedback hook.
- **Tables:** the `Table` primitive plus the composites for row states, pagination, search and sorting; numbers right-aligned with `tabular-nums`.
- **Selects:** `Select` for short fixed lists (pass `items` so the trigger shows labels), a combobox for long or searchable ones (Base UI `Combobox`; on Radix, `Popover` + `Command`).
- **Icons:** `lucide-react`; inside buttons marked with `data-icon="inline-start|inline-end"` and never sized inside primitives; colored by the text token they sit in ([ui-button-icon-data-icon](../rules/ui-button-icon-data-icon.md), [ui-icon-no-size-in-primitives](../rules/ui-icon-no-size-in-primitives.md)).
- **Loading:** `Skeleton` for first load of content areas; the table's row-state composite for lists; `isPending` on buttons.

## 5. Accessibility

- Every `Dialog`/`Sheet`/`AlertDialog` has a title (`DialogTitle`, visually hidden if the design has none) and a description or `aria-describedby={undefined}`.
- Every input has a label (`FormLabel`/`Label` with `htmlFor`); icon-only buttons have `aria-label`.
- Keep the primitives' focus handling: don't stop propagation of keyboard events or replace a primitive's trigger with a `div`.
- Test with Testing Library role queries (`getByRole("dialog", { name })`, `getByRole("button", { name })`); if a test can't find it by role and name, neither can a screen reader.

## 6. Theming

Components get their colors from the tokens ([tailwind.md](tailwind.md), [themes.md](themes.md)). Changing a brand or adding a theme means changing CSS variables, never component files. A component that needs a color the tokens lack gets a new token, not a literal class.

## Checklist

- [ ] `components.json` aliases point at the one primitives folder and the `cn()` file; other paths banned by ESLint
- [ ] Added with `yarn dlx shadcn@latest add`; primitive edits small, token-based and commented
- [ ] One primitive flavour (Base UI `render` by default, or Radix `asChild` in an existing project), used consistently
- [ ] Reused patterns are composites in `components/<brand>-ui/` with tests; pages don't restyle primitives
- [ ] Forms on react-hook-form + zod with server field errors mapped; confirm dialog and sonner instead of `confirm`/`alert`
- [ ] Dialogs titled, inputs labelled, icon buttons named; tests query by role and name
