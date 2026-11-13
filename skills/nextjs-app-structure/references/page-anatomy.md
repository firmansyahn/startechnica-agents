# Page anatomy

How a page is built. The data layer is `nextjs-data`, forms are `nextjs-forms`, the visual layer is `nextjs-ui`; this page ties them together.

## Find the reference page first

Before writing, find the project's newest well-tested page of the same kind (list with create/edit, settings form, record detail, wizard) and copy its shape. Check `AGENTS.md` or the project skill for named reference pages, and for pages marked as legacy. **Don't copy a page that** loads data in a `useEffect`, shows results in a hand-made dialog, spreads state in every `onChange`, or calls `alert()`/`confirm()`, even if it is the nearest one.

## Files

```
app/<section>/<page>/
  page.tsx        server component: generateMetadata (from translations), renders <XClient />
  XClient.tsx     "use client": the whole interactive page
  <Sub>Dialog.tsx | helpers.ts | types.ts | schema.ts   only what this page uses
  page.test.tsx
  [id]/           the record's own page, same shape
```

- A helper, type, schema or hook a second route needs moves to `src/<kind>/` ([folders.md](folders.md)).
- **Access is not declared in each page.** One central place (a route → permission map checked by the app shell or `proxy.ts`/`middleware.ts`) decides who sees a page, and the server API enforces the same permission on every call. A new page adds its entry to that map; its backend route declares the same permission.

## Reading data

```tsx
const { current: tenant } = useActiveTenant();            // whatever scopes the data: tenant, workspace, org
const list = useQuery({ ...items.list(tenant, params), enabled: tenant !== null });
```

- **Pages never call `fetch`.** Reads go through the services registry with query options and keys from its factory (`nextjs-data`).
- **Type replies from the API spec.** Generate types from the backend's OpenAPI document (`openapi-typescript` into `src/api/schema.gen.ts`, or the project's generator), check in CI that they're current, and use `components["schemas"]["Row"]` instead of hand-written reply types.
- **No `useEffect` + `fetch` + `useState`.** Polling is `refetchInterval`; a reload after a write is `invalidateQueries` or `setQueryData`.
- An edit form reads its record with `staleTime: Infinity` and seeds once per record id.
- Shared lookups (names for selects) come from one hook per list; never fetch those lists inside a page.
- A scope switch clears the cache and remounts the page once, at the provider level.
- Lists: one row-state component for the loading, empty and error rows (with default texts, not per-page ones), then pagination, search and sortable column heads from the project's composites (`nextjs-ui` Tables and States rules: `ui-row-state-composite`, `ui-table-primitive`).

## Writing data

```tsx
const save = useFeedbackMutation({
  mutationFn: (v: ItemInput) => runAction(() => saveItem({ ...v, scope: tenant })),  // throws ApiError on failure
  success: t("saved"),
  onSuccess: () => queryClient.invalidateQueries({ queryKey: items.key(tenant) }),
});
```

- **Writes are server actions** in `src/services/<domain>/actions.ts` returning a `Result`; the action, `runAction` and the cache update are in `nextjs-data`.
- **A write names its scope** in its input; **PATCH sends only the fields that changed.**
- **Uploads and downloads** use a small client helper (`uploadFile`, `downloadFile`) through a route handler; a server action can't stream a file.
- **Forms:** react-hook-form + zod with the shadcn `Field` components, the schema shared with the action (`nextjs-forms`).
- **Create/edit** lives in the project's form drawer or dialog composite; it stays open on failure, shows the refusal inside it, and disables Save and Cancel while pending.
- **Feedback:** a toast on success and failure through one mutation hook, or the refusal shown inside the open form instead of a toast.
- **Never `alert()` or `confirm()`.** Ask with the project's confirm dialog (`if (!(await confirm({ title, destructive: true }))) return;`).
- **Read-only users:** a central write-permission context (from the same permission the page's access check used) disables write buttons and row actions. Use the project's write-aware button for Add/Save/Import/Delete instead of checking permissions in each page; check a finer permission only where the backend's write route asks for more than the page's read permission.

## Settings pages

A single-record settings page uses one hook (`useSettingsPage(path)`): it reads the record, PATCHes only the changed keys, updates the cache, and returns `values`, `set`, `save`, `saving`, `saveError`, `loadError`. Render rows with the project's setting-row composites (switch, select, input) instead of laying out each page by hand.

## Strings

- `next-intl`. Messages in `src/messages/<locale>.json`, namespaced by route (`<area>.<section>.<page>.title`); strings shared by a section under `<area>.<section>.common`.
- Every key in every locale file. A test checks locale parity, and another that every literal `t("key")` exists.
- `generateMetadata` reads `meta.title`/`meta.description` from the page's namespace.
- An untranslated page that you touch: translate it when that is cheap, and never mix hard-coded and translated strings inside one page.

## Look

- **Primitives:** shadcn in `components/shadcn-ui`, the project's composites in `components/<brand>-ui`. Don't hand-build a table, dialog, drawer or select that a primitive already covers.
- **Colors:** theme tokens only (`bg-card`, `text-muted-foreground`, `bg-primary`, status tokens with their `-foreground` pairs, `chart-N`); a test fails on palette or hex classes. Pages must look right in light and dark mode.
- **Icons:** `lucide-react`. The page head is the project's page title and breadcrumb components (`nextjs-ui` Layout rules).
