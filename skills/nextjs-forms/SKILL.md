---
name: nextjs-forms
description: "Use when building, reviewing or testing a form in a Next.js App Router app: create/edit forms, settings forms, filters, wizards; react-hook-form + zod schemas shared with the server action, shadcn Field components on Base UI controls (inputs, selects, checkboxes, switches, radios, comboboxes, number and date fields, file inputs), showing server field errors from a 422, submit and pending states, edit forms that only PATCH changed fields, field arrays, dependent fields, unsaved-changes guards, and form tests."
user-invocable: true
license: MIT
compatibility: Designed for Claude Code, Codex, OpenCode, oh-my-pi or similar harness, and for Next.js apps.
metadata:
  author: firmansyahn
  version: "0.1.1"
---

# Forms in Next.js

**Principle:** Every form uses one stack: a zod schema shared with its server action, react-hook-form for state, shadcn `Field` for the UI, and server errors shown on their fields.

One stack for every form: **react-hook-form** holds the state, **zod** defines the rules (one schema, shared by the form and its server action), **shadcn `Field` components** render label, control, description and error, **Base UI** provides the controls, and the submit goes through **`useMutation` → server action → `Result`**.

Related: `nextjs-data` (the action side, the mutation, loading the record), `nextjs-ui` (`Field` components, Base UI controls, dialogs and drawers), `nextjs-app-structure` (where the form sits in a page). Details:
- [references/controls.md](references/controls.md): binding each kind of control (text, number, select, checkbox, switch, radio, combobox, date, file)
- [references/form-patterns.md](references/form-patterns.md): edit forms, drawers and dialogs, field arrays, dependent fields, wizards, filters, unsaved changes, tests

## Rules

One file per rule in `rules/`; the file name is the rule ID. Cite a rule by its ID. Sections and prefixes: [rules/_sections.md](rules/_sections.md).

### Fields

| ID | Rule | Impact | Check |
|---|---|---|---|
| [forms-react-hook-form-zod](rules/forms-react-hook-form-zod.md) | Build forms on react-hook-form with the shared zod schema | MEDIUM | review |
| [forms-default-values](rules/forms-default-values.md) | Give every field a default value | MEDIUM | review |
| [forms-labelled-controls](rules/forms-labelled-controls.md) | Label every control and mark invalid ones | MEDIUM | test |
| [forms-placeholder-not-label](rules/forms-placeholder-not-label.md) | Placeholders are examples, not labels | MEDIUM | review |
| [forms-controller-for-callback-controls](rules/forms-controller-for-callback-controls.md) | Bind callback controls with Controller | MEDIUM | review |
| [forms-controls-match-schema-type](rules/forms-controls-match-schema-type.md) | Controls produce the schema's type | MEDIUM | review |
| [forms-select-items-labels](rules/forms-select-items-labels.md) | Select shows labels through items | MEDIUM | review |
| [forms-options-from-lookup-hook](rules/forms-options-from-lookup-hook.md) | Options come from a shared lookup hook | MEDIUM | review |
| [forms-field-array-keys](rules/forms-field-array-keys.md) | Field arrays are keyed by field.id | MEDIUM | review |
| [forms-dependent-fields-usewatch](rules/forms-dependent-fields-usewatch.md) | Dependent fields read with useWatch and reset explicitly | MEDIUM | review |
| [forms-autocomplete-hints](rules/forms-autocomplete-hints.md) | Personal fields carry autocomplete hints | MEDIUM | review |
| [forms-read-only-disabled](rules/forms-read-only-disabled.md) | Read-only users get disabled controls | MEDIUM | review |

### Validation

| ID | Rule | Impact | Check |
|---|---|---|---|
| [forms-schema-outside-use-server](rules/forms-schema-outside-use-server.md) | The schema lives outside the "use server" file | MEDIUM | test: kit (`use-server-exports.test.ts`) |
| [forms-zod-4-api](rules/forms-zod-4-api.md) | Use the zod 4 API | MEDIUM | review |
| [forms-extend-shared-schema](rules/forms-extend-shared-schema.md) | Form-only rules extend the shared schema | MEDIUM | review |
| [forms-validate-on-touch](rules/forms-validate-on-touch.md) | Validate on touch, and let zod be the only validator | MEDIUM | review |
| [forms-submit-enabled-when-invalid](rules/forms-submit-enabled-when-invalid.md) | Submit stays enabled while the form is invalid | MEDIUM | review |
| [forms-server-errors-on-fields](rules/forms-server-errors-on-fields.md) | Show server field errors on their fields and keep the form open | MEDIUM | test |
| [forms-refusals-inside-form](rules/forms-refusals-inside-form.md) | Other refusals show inside the form, and the form stays open | MEDIUM | review |
| [forms-messages-translated](rules/forms-messages-translated.md) | Validation messages are translated | MEDIUM | review |

### Edit forms and dialogs

| ID | Rule | Impact | Check |
|---|---|---|---|
| [forms-seed-once](rules/forms-seed-once.md) | Seed the form once per record | MEDIUM | review |
| [forms-patch-dirty-only](rules/forms-patch-dirty-only.md) | Send only changed fields when editing | MEDIUM | test |
| [forms-reset-after-save](rules/forms-reset-after-save.md) | Reset to the saved row after a successful save | MEDIUM | review |
| [forms-load-states-not-blank](rules/forms-load-states-not-blank.md) | Loading and load errors aren't an empty form | MEDIUM | review |
| [forms-submit-via-mutation](rules/forms-submit-via-mutation.md) | Submit through the mutation, and disable Save while pending | MEDIUM | review |
| [forms-stay-open-on-failure](rules/forms-stay-open-on-failure.md) | A drawer keeps its form open on failure and ignores close while pending | MEDIUM | review |
| [forms-fresh-on-open](rules/forms-fresh-on-open.md) | Every open starts from a fresh form state | MEDIUM | review |
| [forms-confirm-unsaved-close](rules/forms-confirm-unsaved-close.md) | Closing with unsaved changes asks first | MEDIUM | review |
| [forms-no-alert-confirm](rules/forms-no-alert-confirm.md) | Use the confirm dialog and toasts, never alert() or confirm() | MEDIUM | eslint: kit; scan |
| [forms-filters-in-url](rules/forms-filters-in-url.md) | Filters are URL state, not a form | MEDIUM | review |
| [forms-upload-then-reference](rules/forms-upload-then-reference.md) | Files are uploaded first, then referenced | MEDIUM | review |

### Testing

| ID | Rule | Impact | Check |
|---|---|---|---|
| [forms-test-like-a-user](rules/forms-test-like-a-user.md) | Drive the form like a user | LOW | review |
| [forms-test-required-message](rules/forms-test-required-message.md) | An empty required field shows its message and sends nothing | LOW | review |
| [forms-test-valid-submit-call](rules/forms-test-valid-submit-call.md) | A valid submit sends one call with the expected body | LOW | review |
| [forms-test-dirty-only-body](rules/forms-test-dirty-only-body.md) | An edit sends only the changed fields | LOW | review |
| [forms-test-422-on-fields](rules/forms-test-422-on-fields.md) | A 422 puts messages on the fields and focuses the first | LOW | review |
| [forms-test-form-level-refusal](rules/forms-test-form-level-refusal.md) | Other refusals show the form-level notice and keep the form open | LOW | review |
| [forms-test-pending-disables-save](rules/forms-test-pending-disables-save.md) | Save is disabled while pending | LOW | review |
| [forms-test-read-only-user](rules/forms-test-read-only-user.md) | The read-only user can't edit | LOW | review |
| [forms-test-second-locale](rules/forms-test-second-locale.md) | A second locale renders translated labels and messages | LOW | review |

## 1. Schema (shared with the action)

```ts
// src/services/<domain>/input.ts  (not the "use server" file)
import { z } from "zod";

export const itemSchema = z.object({
  name: z.string().trim().min(1, { error: "Required" }).max(100),
  email: z.email({ error: "Enter a valid email" }).optional().or(z.literal("")),
  quota: z.number().int().min(0).nullable(),
  enabled: z.boolean(),
  customerId: z.string().min(1, { error: "Choose a customer" }),
});
export type ItemInput = z.input<typeof itemSchema>;
export type Item = z.output<typeof itemSchema>;
```

- Zod 4: `z.email()`, `z.url()`, `z.uuid()` are top-level; custom messages use `{ error: "..." }`. Message keys may be translation keys if the form translates them (below).
- The same schema validates in the browser (zodResolver) and again in the action (`safeParse` on `unknown`). The browser check is for the user; the action's check is the real one.
- Keep form-only concerns out of the shared schema (password confirmation is a `.refine` on a form-level extension, `itemSchema.extend({...}).refine(...)`).
- Prefer controls that produce the right type (a number field gives a number) over `z.coerce`, which makes the input type `unknown`.

## 2. The form

```tsx
"use client";
const form = useForm<ItemInput, unknown, Item>({
  resolver: zodResolver(itemSchema),
  defaultValues: { name: "", email: "", quota: null, enabled: true, customerId: "" },
  mode: "onTouched",
});

const save = useFeedbackMutation(
  { mutationFn: (v: Item) => runAction(() => saveItem({ ...v, scope })) },
  { success: t("saved"), failure: false },          // the form shows refusals itself
);

const onSubmit = form.handleSubmit((values) =>
  save.mutateAsync(values).then(onDone).catch((e) => applyServerErrors(form, e)),
);

return (
  <form onSubmit={onSubmit} noValidate>
    <FieldGroup>
      <Controller
        control={form.control}
        name="name"
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor="item-name">{t("name")}</FieldLabel>
            <Input id="item-name" {...field} aria-invalid={fieldState.invalid} autoComplete="off" />
            <FieldError errors={[fieldState.error]} />
          </Field>
        )}
      />
      {/* ...more fields... */}
    </FieldGroup>
    <FormNotice error={form.formState.errors.root?.message} />
    <Button type="submit" disabled={save.isPending}>{t("save")}</Button>
  </form>
);
```

- **Always `defaultValues`** for every field (`""`, `null`, `false`, `[]`), so inputs are controlled from the start and `isDirty`/`dirtyFields` work.
- **`mode: "onTouched"`**: errors appear after the user leaves a field, then update as they type. Don't validate on every keystroke from the start.
- **`noValidate`** on `<form>`: zod is the one validator; browser bubbles would duplicate and contradict it.
- **One `id` per control**, linked by `FieldLabel htmlFor`; `aria-invalid` on the control; `FieldError` renders with `role="alert"`.
- **Submit button** disabled only while pending (not while invalid, so a submit reveals all errors). It says what it does ("Save", "Create customer").
- `FormNotice` is the project's notice composite for a form-level refusal (403, 409, network), shown inside the form.

## 3. Server errors

The action returns a `Result`; `runAction` throws an `ApiError` with `status`, `message` and `fields` (`nextjs-data`).

```ts
export function applyServerErrors<T extends FieldValues>(form: UseFormReturn<T>, err: unknown) {
  if (!(err instanceof ApiError)) return form.setError("root", { message: errorText(err) });
  let focused = false;
  for (const [name, messages] of Object.entries(err.fields)) {
    if (name === "" || form.getValues(name as Path<T>) === undefined) continue;   // unknown paths → root
    form.setError(name as Path<T>, { type: "server", message: messages[0] }, { shouldFocus: !focused });
    focused = true;
  }
  const rest = err.fields[""]?.[0];
  if (!focused || rest) form.setError("root", { message: rest ?? err.message });
}
```

- Field errors go on their fields and focus the first one; anything else goes to `root` and the form-level notice.
- Field error keys are dotted JSON paths (`address.city`, `rules.2.value`), the same as react-hook-form field names, so nested and array fields work without mapping (`go-nextjs-api-contract`). The lookup relies on every field having a default value.
- Server errors clear when the user edits that field (react-hook-form clears a field's error on the next validation).
- A 401 has already sent the user to sign in (`runAction`); don't render it as a form error.

## 4. Rules

- **No hand-rolled form state** (`useState` per field, `onChange={(e) => setForm({...form, x: e.target.value})}`).
- **No `alert()`/`confirm()`**; ask with the confirm dialog composite.
- **Edit forms send only changed fields** (`dirtyFields`), and never overwrite what the user is typing when data refetches ([form-patterns.md](references/form-patterns.md)).
- **Strings** (labels, descriptions, placeholders, errors) come from translations; zod messages are keys, translated where `FieldError` renders them, or built with a schema factory that takes `t`.
- **Autocomplete hints** on personal fields (`autoComplete="email"`, `"new-password"`, `"one-time-code"`); `autoComplete="off"` for codes and names of records.
- **Placeholders are examples, not labels.** Every control has a visible label (or an `aria-label` for a search box with a visible icon).

## Reviewing

1. **Scope.** The diff (`git diff <base>...HEAD`), a merge request's files or the whole app, read for what this skill covers: forms, their schemas and the actions behind them.
2. **Scan.** `bash <this skill>/scripts/scan.sh <app-root>` lists candidates for the rules whose check includes `scan`. On a diff, keep only findings in changed lines or files. Every line is a candidate: open the rule and confirm it before reporting.
3. **Read** the changed code against the Rules above. Open each rule you cite and match its "Incorrect" shape, not just its title.
4. **Report** each finding in the format of `agent-skills-authoring` ("Scan scripts and findings"): impact, rule ID, file and line, what to change citing the rule's "Correct" shape; ordered by impact. Raise the impact one level on an authentication, payment or deletion path.
5. **Say what's not covered:** rules whose check is `test` or `eslint` but the project has no such test or lint rule. `kit` in the Check column means a ready-to-copy check exists (`nextjs-new-app`, references/enforcement-kit.md).

## Checklist

- [ ] One zod schema in a non-`"use server"` file, used by `zodResolver` and by the action's `safeParse`
- [ ] `useForm` with full `defaultValues`, `mode: "onTouched"`, `noValidate` on the form
- [ ] Every control in a `Field` with `FieldLabel htmlFor`, `aria-invalid`, `FieldError`; controls bound per [controls.md](references/controls.md)
- [ ] Submit through `useMutation` → `runAction` → action; button disabled while pending
- [ ] Server field errors mapped onto fields with focus; others to a form-level notice; form stays open on failure
- [ ] Edit forms: seeded once, PATCH only dirty fields, protected from refetch
- [ ] Strings translated; autocomplete hints set
- [ ] Tests: validation, the call made, server field errors, pending state, read-only user
