# Form patterns

## Edit form (load, seed once, PATCH the changes)

```tsx
const item = useQuery({ ...items.get(scope, id), staleTime: Infinity, refetchOnWindowFocus: false });
const form = useForm<ItemInput, unknown, Item>({ resolver: zodResolver(itemSchema), defaultValues: EMPTY });

const seeded = useRef<string | null>(null);
useEffect(() => {
  if (item.data && seeded.current !== item.data.id) {
    form.reset(toFormValues(item.data));          // also resets dirty state
    seeded.current = item.data.id;
  }
}, [item.data, form]);

const onSubmit = form.handleSubmit((values) => {
  const changes = pickDirty(values, form.formState.dirtyFields);
  if (Object.keys(changes).length === 0) return onDone();
  return save.mutateAsync({ id, changes }).then((row) => { form.reset(toFormValues(row)); onDone(); })
    .catch((e) => applyServerErrors(form, e));
});
```

- Seed once per record id, so a background refetch never overwrites typing; `form.reset(row)` after a successful save makes the saved values the new baseline.
- `toFormValues` maps API shapes to form shapes (`null` → `""` for text inputs, ids for relations); the action maps back.
- `pickDirty` keeps only fields in `dirtyFields` (recursing into nested objects); a backend that refuses unknown keys stays happy.
- While loading show the form's skeleton; on load error show the error row, not an empty form.

## Create/edit in a drawer or dialog

- The form lives inside the project's form drawer composite; the drawer's Save is `type="submit"` with `form="<form-id>"` when it sits outside the `<form>`.
- Open with a fresh form state: `form.reset(defaults)` when opening for create, `reset(toFormValues(row))` for edit.
- On failure the drawer stays open with the errors; on success it closes and the list updates (`setQueryData`/`invalidateQueries`).
- While pending: Save and Cancel disabled, and the drawer ignores close requests (Escape, outside press) so the outcome isn't lost.
- Closing with unsaved changes asks first (confirm dialog), unless nothing is dirty.

## Field arrays

```tsx
const { fields, append, remove, move } = useFieldArray({ control: form.control, name: "rules" });
```

- Key rows by `field.id` (react-hook-form's), never the index.
- Each row's controls use `rules.${index}.name` paths; row errors come from `fieldState` as usual, array-level errors (`min(1)`) from `form.formState.errors.rules?.root`.
- Add/remove buttons have names ("Add rule", "Remove rule 3"); removing the last required row is prevented by the schema, not by hiding the button.

## Dependent fields

- Read with `useWatch({ control, name: "kind" })` (not `watch()` at the top of a big form: it re-renders everything).
- Hide or disable dependents through rendering, and make the schema agree with a discriminated union (`z.discriminatedUnion("kind", [...])`) so hidden fields aren't validated or sent.
- When a parent changes, reset dependents explicitly (`form.setValue("subtype", "", { shouldDirty: true })`).

## Wizards (multi-step)

- One `useForm` for all steps; each step validates its own fields with `form.trigger(["a", "b"])` before moving on.
- Schema per step composed into the full schema, so the action still validates everything at the end.
- Keep the step in the URL (`?step=2`) only if users must deep-link to it; otherwise component state.

## Filter forms (lists)

- Filters are URL state (`useSearchParams` + `router.replace`), debounced for text, so a list is shareable and survives reloads; a react-hook-form instance is unnecessary for one or two inputs.
- The list's query key includes the filters; `placeholderData: keepPreviousData` avoids flashing empty.

## Unsaved changes

- In-app navigation: intercept the app's own links/back actions when `isDirty` and ask with the confirm dialog.
- Tab close/reload: `beforeunload` listener only while `isDirty` (the browser shows its own text).

## Translated validation messages

Either schema messages are translation keys rendered by a small wrapper (`<FieldError errors={[translate(fieldState.error)]} />`), or the schema is built by a factory that receives `t` (`makeItemSchema(t)`), with the action using the default-locale build. Pick one per project.

## Tests

- Render with `renderWithQuery`; type with `userEvent`; submit by clicking the button.
- **Validation:** empty required field shows its message after submit; no call was made.
- **Call:** a valid submit calls the backend once with the expected path, scope and body (dirty fields only for edits).
- **Server errors:** a 422 with `fields` shows messages on those fields and focuses the first; a 409/403 shows the form-level notice; the form stays open.
- **Pending:** Save is disabled while the call is in flight.
- **Read-only:** controls disabled, no Save.
- **Second locale:** labels and messages render translated.
