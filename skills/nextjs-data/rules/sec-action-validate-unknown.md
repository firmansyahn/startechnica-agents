---
title: Parse action input from unknown with the shared schema
impact: CRITICAL
tags: server-actions, validation, zod
check: test, review (the shared schema)
---

## Parse action input from unknown with the shared schema

**Impact: CRITICAL** (unchecked input reaches the backend or database)

TypeScript types on an action's parameters are erased at runtime; the browser can send anything. Every action takes `unknown` (or `FormData`), parses it with the zod schema the form also uses, and returns a 422-shaped `Result` on failure. Path segments built from input are encoded.

**Incorrect:**

```ts
export async function saveItem(input: ItemInput) {
  return apiAction("PATCH", `items/${input.id}`, { body: input });
}
```

**Correct:**

```ts
export async function saveItem(input: unknown): Promise<Result<Item>> {
  const parsed = saveItemInput.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { id, changes, scope } = parsed.data;
  return apiAction("PATCH", `items/${encodeURIComponent(id)}`, { body: changes, scope });
}
```

**How to check:** `assets/tests/use-server-exports.test.ts` fails on an exported action in a "use server" file whose parameter is typed (or untyped, or destructured) instead of `unknown` or `FormData` (with useActionState, `(prevState, formData: FormData)`), or that never passes that parameter to `.safeParse`/`.parse`; the file, line and fix are in the message. Review that the schema is the one the form shares and that the parsed value, not the raw input, reaches the backend. Encoded path segments: `action-encode-path-segments`.
