---
name: nextjs-data
description: "Use when reading or writing server data in a Next.js App Router app: TanStack Query v5 for reads (provider, query options and key factories in a services registry, useQuery/useSuspenseQuery, pagination, polling, dependent queries, prefetching from a Server Component) and Server Actions for writes (the action file's shape, zod validation, identity and authorization inside the action, the Result it returns, useMutation with runAction, invalidation or setQueryData, optimistic updates, updateTag/revalidatePath/refresh, redirect, uploads, deployment skew, allowedOrigins, bodySizeLimit, the encryption key); edit forms that refetches must not overwrite, clearing the cache on a tenant switch, testing queries and actions; and client-only shared state with Zustand v5 (store vs query cache, URL or form, per-request stores in the App Router, selectors and useShallow, persist with skipHydration, resetting on scope switch, tests). Replaces useEffect fetches and SWR."
user-invocable: true
license: MIT
compatibility: Designed for Claude Code, Codex, OpenCode, oh-my-pi or similar harness, and for Next.js apps.
metadata:
  author: firmansyahn
  version: "0.2.1"
---

# Next.js data: TanStack Query reads, Server Action writes, Zustand client state

**Principle:** Server data has one path: reads through TanStack Query, writes through Server Actions that return a Result, and authorization on the server, never only in the UI.

One path for server data in a client-rendered page:

```
read   component ─ useQuery(items.list(scope)) ─► services registry ─► transport ─► backend (through the BFF proxy)
write  component ─ useMutation(runAction(saveItem)) ─► "use server" action ─ zod ─► backend ─► Result
                       └─ onSuccess: setQueryData / invalidateQueries ─► the reads above refresh
```

- **Reads** go through TanStack Query with query options from the services registry (`src/services/<domain>/index.ts`). **No `useEffect` + `fetch` + `useState`**, not even through a `load()` the effect calls, no SWR, no `fetch` in pages or components.
- **Writes** are Server Actions (`src/services/<domain>/actions.ts`) that parse `unknown` input with zod, take identity from the session and return a `Result`. Never read through an action: the client dispatches actions one at a time, so reads through them serialise the page.
- **The cache is updated after every write**, by the mutation (`setQueryData` with the returned row, `invalidateQueries` for lists), or by the action (`updateTag`/`revalidatePath`/`refresh`) when the page reads with Server Components.
- **Client-only state shared by distant components** (a selection used by a table and a bulk bar, a wizard's draft, a per-device preference) goes in a Zustand store, created per provider. Server data never goes in a store; URL state stays in `searchParams` and form state in react-hook-form.

Related: `nextjs-bff` (the transport and how actions reach the backend with the user's token), `nextjs-forms` (the form that calls the mutation), `nextjs-logging` (what the action helper logs), `nextjs-app-structure` (where the files go and how a page uses all this), `go-nextjs-api-contract` (the reply envelope, status codes, list parameters and PATCH semantics the registry and actions rely on). Check the installed Next version's docs in `node_modules/next/dist/docs/` (`01-app/02-guides/server-actions.md`, `data-security.md`, `client-side-data-fetching/tanstack-query.md`) before using an API you're unsure of.

## Read the reference for the task

| Task | Reference |
|---|---|
| The provider, the services registry and keys, `useQuery` options, lookups, edit forms, scope switch, server prefetch, query tests | [references/queries.md](references/queries.md) |
| An action file, the action recipe, Next cache revalidation, form actions, uploads, size and deployment settings, action tests | [references/server-actions.md](references/server-actions.md) |
| Which state goes where, a Zustand store with its provider, selectors, actions, persist, reset, store tests | [references/client-state.md](references/client-state.md) |

## Rules

One file per rule in `rules/`; the file name is the rule ID. Cite a rule by its ID. Sections and prefixes: [rules/_sections.md](rules/_sections.md).

### Queries

| ID | Rule | Impact | Check |
|---|---|---|---|
| [data-no-effect-fetch](rules/data-no-effect-fetch.md) | Read server data with useQuery, never useEffect + fetch | HIGH | test: kit (scan candidates) |
| [data-no-fetch-in-components](rules/data-no-fetch-in-components.md) | Go through the services registry, not fetch, in pages and components | HIGH | eslint: kit; scan |
| [data-query-options-from-registry](rules/data-query-options-from-registry.md) | Query options come from the services registry | HIGH | eslint |
| [data-query-key-factory](rules/data-query-key-factory.md) | Build query keys from the registry's factory | MEDIUM | eslint, review |
| [data-wait-with-enabled](rules/data-wait-with-enabled.md) | Wait for inputs with enabled, not with an early return | HIGH | eslint: `react-hooks/rules-of-hooks` (eslint-config-next) |
| [data-keep-previous-page](rules/data-keep-previous-page.md) | Keep the previous page while the next one loads | HIGH | review |
| [data-poll-with-refetchinterval](rules/data-poll-with-refetchinterval.md) | Poll with refetchInterval, not setInterval | HIGH | eslint, review |
| [data-shared-lookup-hook](rules/data-shared-lookup-hook.md) | Lookup lists are one shared query and a hook | HIGH | review |
| [data-edit-form-read-once](rules/data-edit-form-read-once.md) | Edit forms read once and are never overwritten by a refetch | HIGH | review |
| [data-scope-switch-clears-cache](rules/data-scope-switch-clears-cache.md) | Clear the cache once, at the provider, on a scope switch | HIGH | scan, review (what the listener does) |
| [data-separate-queries](rules/data-separate-queries.md) | Independent reads are separate queries | HIGH | review |

### Mutations

| ID | Rule | Impact | Check |
|---|---|---|---|
| [data-mutation-via-runaction](rules/data-mutation-via-runaction.md) | mutationFn calls one action through runAction | HIGH | test |
| [data-update-cache-after-write](rules/data-update-cache-after-write.md) | Update the cache after every write | HIGH | review |
| [data-cache-in-hook-ui-at-call](rules/data-cache-in-hook-ui-at-call.md) | Cache work in the hook, UI work at the call | HIGH | review |
| [data-one-feedback-mutation](rules/data-one-feedback-mutation.md) | Feedback through the one feedback mutation | HIGH | review |
| [data-ispending-for-buttons](rules/data-ispending-for-buttons.md) | isPending disables the control; no separate saving state | HIGH | review |
| [data-write-names-scope](rules/data-write-names-scope.md) | The write names its scope | HIGH | review |
| [data-optimistic-with-rollback](rules/data-optimistic-with-rollback.md) | Optimistic updates only where they pay, with a rollback | HIGH | test (the shape), review (where an optimistic update pays) |
| [data-no-writes-in-effects](rules/data-no-writes-in-effects.md) | No writes in effects or on render | HIGH | test, review (writes during render) |

### Server actions

| ID | Rule | Impact | Check |
|---|---|---|---|
| [action-use-server-exports](rules/action-use-server-exports.md) | Export only async functions from "use server" files | HIGH | test: kit; scan |
| [action-file-per-domain](rules/action-file-per-domain.md) | Actions live in the domain's actions file, never inline in components | HIGH | test: kit (`use-server-exports.test.ts`), scan, review (file name) |
| [sec-action-validate-unknown](rules/sec-action-validate-unknown.md) | Parse action input from unknown with the shared schema | CRITICAL | test, review (the shared schema) |
| [sec-action-identity-from-session](rules/sec-action-identity-from-session.md) | Take identity from the session, never from action arguments | CRITICAL | scan (candidates), review |
| [action-authorize-on-server](rules/action-authorize-on-server.md) | Authorization is on the server, not in the UI | HIGH | review |
| [action-reference-plus-change](rules/action-reference-plus-change.md) | Send a reference and the change, never a whole record | HIGH | review |
| [action-encode-path-segments](rules/action-encode-path-segments.md) | Path segments are encoded and checked | HIGH | eslint, review |
| [action-return-result](rules/action-return-result.md) | Return a Result from actions instead of throwing user-facing errors | HIGH | review |
| [action-trim-return-value](rules/action-trim-return-value.md) | Return only what the UI renders | HIGH | review |
| [action-redirect-last](rules/action-redirect-last.md) | Call redirect() last, outside try/catch | MEDIUM | eslint |
| [action-writes-only](rules/action-writes-only.md) | Use server actions for writes only, one at a time | MEDIUM | test, scan, review (sequential loops of actions) |

### Client state

| ID | Rule | Impact | Check |
|---|---|---|---|
| [data-no-server-state-in-store](rules/data-no-server-state-in-store.md) | Keep server data in TanStack Query, never copied into a client store | HIGH | review |
| [store-url-and-form-state-elsewhere](rules/store-url-and-form-state-elsewhere.md) | URL state goes in searchParams, form state in react-hook-form | MEDIUM | review |
| [store-per-provider](rules/store-per-provider.md) | A store is created per provider, not per module, when it can hold per-user state | MEDIUM | review |
| [store-no-set-during-render](rules/store-no-set-during-render.md) | Never set store state during render | MEDIUM | eslint, review |
| [store-narrow-selectors](rules/store-narrow-selectors.md) | Select the smallest slice; useShallow for objects and arrays | MEDIUM | test |
| [store-named-actions](rules/store-named-actions.md) | Changes go through named actions in the store | MEDIUM | eslint, review |
| [store-persist-preferences-only](rules/store-persist-preferences-only.md) | Persist only per-device preferences, and hydrate after mount | MEDIUM | test, review (whether a value is a preference) |
| [store-reset-on-scope-switch](rules/store-reset-on-scope-switch.md) | Scope-bound stores reset with the query cache | MEDIUM | review |
| [store-one-per-concern](rules/store-one-per-concern.md) | One store per concern | MEDIUM | review |

### Testing

| ID | Rule | Impact | Check |
|---|---|---|---|
| [data-test-fake-fetch](rules/data-test-fake-fetch.md) | Fake the network at fetch, not the code | MEDIUM | scan |
| [data-test-fresh-query-client](rules/data-test-fresh-query-client.md) | A fresh QueryClient per test, with retry off | MEDIUM | scan, review (the helper's options) |
| [data-test-fixtures-fit-spec](rules/data-test-fixtures-fit-spec.md) | Fixtures fit the API spec | MEDIUM | test, review |
| [data-test-assert-on-call](rules/data-test-assert-on-call.md) | Assert on the call made | MEDIUM | review |
| [data-test-four-action-cases](rules/data-test-four-action-cases.md) | Every action has four tests | MEDIUM | review |
| [data-test-list-states-once](rules/data-test-list-states-once.md) | Lists test their loading, empty and error rows once | MEDIUM | review |
| [data-test-findby-not-timers](rules/data-test-findby-not-timers.md) | Wait for data with findBy, not with timers | MEDIUM | review |

## The write path

```ts
// src/services/<domain>/actions.ts
"use server";
import { saveItemInput } from "./input";            // zod schema in a non-"use server" file, shared with the form
import { apiAction } from "@/src/api/action";      // server-only: session from the cookie, backend call, Result

export async function saveItem(input: unknown): Promise<Result<Item>> {
  const parsed = saveItemInput.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);           // 422-shaped Result with field errors
  const { id, changes, scope } = parsed.data;
  return apiAction<Item>("PATCH", `items/${encodeURIComponent(id)}`, { body: changes, scope });
}
```

```tsx
const queryClient = useQueryClient();
const save = useFeedbackMutation({
  mutationFn: (v: ItemInput) => runAction(() => saveItem({ ...v, scope })),   // throws ApiError on a failed Result
  success: t("saved"),
  onSuccess: (row) => {
    queryClient.setQueryData(items.get(scope, row.id).queryKey, row);       // the row the write answered with
    return queryClient.invalidateQueries({ queryKey: items.key(scope) });   // lists
  },
});
save.mutate(values, { onSuccess: () => close() });                         // UI work at the call
```

- **`runAction`** (client, `src/services/client.ts`) unwraps the `Result`, throws an `ApiError` (status, message, field errors) into `onError`, sends the browser to sign in on a signed-out failure, and turns Next's "server action not found" error (a deploy changed the action ids) into a "reload the page" message.
- **Hook-level callbacks** (in `useMutation`) do cache work; **call-level callbacks** (`mutate(v, { onSuccess })`) do UI work and run only while the component is mounted.
- **One wrapper for feedback** (`useFeedbackMutation`: a success and an error toast) instead of toast code in every page; a form that shows the refusal itself opts out of the error toast. The success toast fires before the page's own `onSuccess`, so a slow refetch never delays it.
- **After the write** with Server Component reads:

| The page reads with | After the write |
|---|---|
| TanStack Query | Nothing in the action; the mutation's `onSuccess` as above |
| Server Components with tagged/cached fetches | `updateTag(tag)` in the action: immediate expiry, and the response carries the re-rendered route |
| Server Components, one route affected | `revalidatePath(path)` |
| Server Components, state outside the cache changed | `refresh()` (re-render without invalidating the cache) |
| Background freshness is enough | `revalidateTag(tag, profile)` (stale-while-revalidate; no re-render in the response) |

## Rules that hold everywhere

1. **Reads through `useQuery` on the registry's query options**; keys `[domain, resource, ...params, scope]` from one factory; no `useEffect` fetch, no SWR, no `fetch` in components.
2. **Writes through Server Actions**, one at a time, never for reads, uploads or downloads (route handlers for files).
3. **Every `"use server"` export is an async function**; schemas, types and constants live in a sibling file.
4. **Action input is `unknown`, parsed with the zod schema the form shares**; ids are encoded and checked; the client sends a reference plus the change, never a whole record.
5. **Identity from the session, never from an argument; authorization on the server**; scope passed explicitly in the input and checked by the backend.
6. **Actions return a `Result`** (field errors on a 422) and throw only for programming errors; the return value is trimmed to what the UI renders.
7. **Every write updates the cache**: the narrowest `invalidateQueries`, or `setQueryData` with the answered row, or the Next revalidation above. `redirect()` last, outside `try`/`catch`.
8. **Edit forms are protected from refetches** (`staleTime: Infinity`, seeded once per record id); a scope switch clears the cache once, at the provider; sign-out calls `queryClient.clear()`.
9. **Tests fake the network at `fetch`**, so the real query options, actions and transport run; a fresh `QueryClient` per test with `retry: false`.
10. **Zustand only for shared client-only state**: never server data (keep ids, read records from the query); a store per provider (`createStore` + context) whenever it can hold per-user state, never written during render; narrow selectors (`useShallow` for objects); changes through named actions; `persist` only for per-device preferences, with `skipHydration`.

## Reviewing

1. **Scope.** The diff (`git diff <base>...HEAD`), a merge request's files or the whole app, read for what this skill covers: queries, mutations, server actions and stores.
2. **Scan.** `bash <this skill>/scripts/scan.sh <app-root>` lists candidates for the rules whose check includes `scan` (set `SCOPE_SWITCH` to the project's scope-switch subscription if it isn't `onTenantSwitch` or `onScopeChange`). On a diff, keep only findings in changed lines or files. Every line is a candidate: open the rule and confirm it before reporting. The rules whose check is `test` are enforced by the source-text tests in `assets/tests/` (`action-calls`, `no-effect-fetch`, `optimistic-updates`, `stores`, `use-server-exports`), copied into the app's `tests/`; where the app has them, a failing run names the file, line and rule.
3. **Read** the changed code against the Rules above. Open each rule you cite and match its "Incorrect" shape, not just its title.
4. **Report** each finding in the format of `agent-skills-authoring` ("Scan scripts and findings"): impact, rule ID, file and line, what to change citing the rule's "Correct" shape; ordered by impact. Raise the impact one level on an authentication, payment or deletion path.
5. **Say what's not covered:** rules whose check is `test` or `eslint` but the project has no such test or lint rule. `kit` in the Check column means a ready-to-copy check exists (`nextjs-new-app`, references/enforcement-kit.md).

## Checklist

- [ ] One `QueryClient` per browser (new per server render), provider around chrome and pages
- [ ] Query options and keys from the services registry; no `useEffect` fetch, no SWR, no `fetch` in components
- [ ] `"use server"` file exports only async functions; input `unknown` parsed with the shared schema; ids encoded
- [ ] Identity from the session; authorization server-side; scope in the input
- [ ] Actions return a `Result`, trimmed; `runAction` in `mutationFn`; `isPending` disables submit
- [ ] Cache updated after every write; `redirect` last; edit forms protected; scope switch clears once
- [ ] Not used for reads, uploads or parallel batches; `allowedOrigins` set where a proxy changes the host
- [ ] Tests: queries with a fresh client; actions for invalid input, signed out, refusal and success
- [ ] Stores (if any): client-only state, created per provider, narrow selectors, reset on scope switch and sign-out
