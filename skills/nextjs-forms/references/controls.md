# Binding controls

Every control sits in a `Field` (`FieldLabel`, the control, optional `FieldDescription`, `FieldError`). Text-like inputs pass `field` straight through; Base UI controls that report values through callbacks map `field.value` / `field.onChange` onto their own props. Check the control's page in `node_modules/@base-ui/react/docs/react/components/` when a prop is unclear.

## Text, textarea, password

```tsx
<Controller control={form.control} name="name" render={({ field, fieldState }) => (
  <Field data-invalid={fieldState.invalid}>
    <FieldLabel htmlFor="name">{t("name")}</FieldLabel>
    <Input id="name" {...field} aria-invalid={fieldState.invalid} />
    <FieldError errors={[fieldState.error]} />
  </Field>
)} />
```

- `form.register("name")` also works for plain inputs; use `Controller` consistently when the form mixes in callback controls, so every field reads the same way.
- Trim in the schema (`z.string().trim()`), not in `onChange`.
- Passwords: `type="password"`, `autoComplete="current-password"` or `"new-password"`; a show/hide toggle is a button with an `aria-label` and `aria-pressed`.

## Number

- Prefer the Base UI number field primitive (`NumberField`) via `Controller`: `value={field.value}` and `onValueChange={(v) => field.onChange(v)}`; it gives `number | null`, matching `z.number().nullable()`.
- With a plain `<Input type="number">`, convert explicitly: `onChange={(e) => field.onChange(e.target.value === "" ? null : e.target.valueAsNumber)}`.
- Units go in the label or an addon (`InputGroup`), not in the value.

## Select

```tsx
<Controller control={form.control} name="customerId" render={({ field, fieldState }) => (
  <Field data-invalid={fieldState.invalid}>
    <FieldLabel htmlFor="customer">{t("customer")}</FieldLabel>
    <Select items={customerItems} value={field.value || null} onValueChange={(v) => field.onChange(v ?? "")}>
      <SelectTrigger id="customer" aria-invalid={fieldState.invalid} onBlur={field.onBlur}>
        <SelectValue placeholder={t("chooseCustomer")} />
      </SelectTrigger>
      <SelectContent>
        {customerItems.map((z) => <SelectItem key={z.value} value={z.value}>{z.label}</SelectItem>)}
      </SelectContent>
    </Select>
    <FieldError errors={[fieldState.error]} />
  </Field>
)} />
```

- Pass `items` so the trigger shows the label, not the raw value.
- Options come from a shared lookup hook (`useCustomerNames()`), never fetched inside the form.
- Wire `onBlur` so `mode: "onTouched"` sees the field as touched.

## Combobox (long or searchable lists)

- Base UI `Combobox` through the project's composite; bind `value`/`onValueChange` like Select.
- Server-side search: the input's text drives a `useQuery` with `placeholderData: keepPreviousData` and a debounce; the form stores the id, not the label.

## Checkbox and switch

```tsx
<Controller control={form.control} name="enabled" render={({ field }) => (
  <Field orientation="horizontal">
    <Switch id="enabled" checked={field.value} onCheckedChange={field.onChange} />
    <FieldLabel htmlFor="enabled">{t("enabled")}</FieldLabel>
  </Field>
)} />
```

- A switch applies a setting; a checkbox confirms or selects. Both bind `checked` / `onCheckedChange`.
- A group of checkboxes for a `string[]`: one `Controller` for the array, each checkbox toggling its value in or out; wrap them in `FieldSet` + `FieldLegend`.

## Radio group

`RadioGroup value={field.value} onValueChange={field.onChange}` inside a `FieldSet` with a `FieldLegend`; each option a `Field orientation="horizontal"` with its own label.

## Date and time

- A date picker composite (Popover + Calendar) bound through `Controller`; store an ISO string or `Date` consistently with the schema (`z.iso.date()` for `YYYY-MM-DD`, `z.date()` for `Date`).
- Send dates to the API in the format its spec documents; convert at the action, not in the control.
- Show and parse in the user's locale and time zone; store instants in UTC.

## File input

- Files don't go through server actions (1 MB cap, no streaming). The form holds a `File` (or `File[]`) for client-side checks (type, size) and uploads with the project's `uploadFile` helper (multipart through a route handler), then submits the returned id or URL with the rest of the form.
- `accept` lists types; the schema checks size and type again (`z.instanceof(File).refine((f) => f.size <= MAX, ...)`); the server checks a third time.
- Show the chosen file's name and a remove button; never preview untrusted SVG inline.

## Read-only users

Pass `disabled` to every control (or wrap them in a `<fieldset disabled>`), keep the values readable, and replace Save with nothing or a disabled write-aware button with a hint. The form is then a view, not an editor.
