# Queries: TanStack Query v5 in Next.js

Client-side server state goes through TanStack Query: `useQuery` for reads, `useMutation` for writes (the write path is in [SKILL.md](../SKILL.md)). The Next docs page `01-app/02-guides/client-side-data-fetching/tanstack-query.md` in `node_modules/next/dist/docs/` covers the installed version's SSR details.

## Provider

```tsx
"use client";
let browserClient: QueryClient | undefined;

function makeClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 5_000, refetchOnWindowFocus: false, retry: 1 },
    },
  });
}

function getQueryClient() {
  if (typeof window === "undefined") return makeClient();   // one per server render
  return (browserClient ??= makeClient());                   // one per browser
}

export function QueryProvider({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={getQueryClient()}>{children}</QueryClientProvider>;
}
```

- Mount it in the nearest layout shared by the pages that use it, **around the app chrome too**, so the navbar and the pages share one cache (the signed-in user's profile is read once).
- Set `staleTime` above 0 so mounting several components that read the same key makes one request. Pick `retry` deliberately: retrying a 4xx is pointless; a `retry` function can skip `ApiError`s below 500.

## Query options and keys live in the services registry

```ts
// src/services/<domain>/index.ts
export const items = {
  key: (scope?: string | null) => serviceKey("items", "list", [], scope),
  list: (scope: string | null, params: ListParams) =>
    queryOptions({
      queryKey: [...items.key(scope), params],
      queryFn: () => readPage<Item>("items", { scope, query: params }),
    }),
  get: (scope: string | null, id: string) =>
    queryOptions({ queryKey: [...items.key(scope), "by-id", id], queryFn: () => read<Item>(`items/${id}`, { scope }) }),
};
```

- **Keys are `[domain, resource, ...params]`**, mirroring the API path, with the scope (tenant/workspace) when a call names one. `invalidateQueries({ queryKey: [domain, resource] })` then reaches every variant.
- Build keys through one helper (`serviceKey`) and export the factory; never type a key array inline in a component.
- `queryOptions()` keeps key and function together and typed, and the same object works for `useQuery`, `useSuspenseQuery`, `prefetchQuery`, `ensureQueryData` and `getQueryData`.
- `queryFn` throws an `ApiError` on failure (status, message, field errors), so `error` is typed and readable.
- The transport (`src/services/client.ts`) adds the scope header, sends the browser to sign in on a 401, and goes through the BFF proxy (`nextjs-bff`). Reply types come from the generated API types, not hand-written ones.

## Reading

| Need | Use |
|---|---|
| Wait for an input | `enabled: scope !== null && id !== ""` |
| Pagination / search without flashing empty | `placeholderData: keepPreviousData` |
| Polling | `refetchInterval: 10_000` (and `refetchIntervalInBackground: false`) |
| Derived shape | `select: (rows) => rows.map(...)` (memoise with `useCallback` if expensive) |
| Several independent queries | separate `useQuery` calls or `useQueries`; not one `queryFn` doing `Promise.all` of unrelated reads |
| Loading states | `isPending` (no data yet), `isFetching` (background refetch), `isError` + `error` |
| Suspense | `useSuspenseQuery` inside a `<Suspense>` boundary; independent queries in sibling components |

- **Lookup lists** (names for selects) are one query per list in the registry plus a small hook (`useCategoryNames()`), reused everywhere.
- **Edit forms** read the record with `staleTime: Infinity, refetchOnWindowFocus: false` and seed form state once per record id, so a background refetch never overwrites what the user is typing (`nextjs-forms`).
- **Scope switch** (tenant, workspace, account): one provider-level listener calls `queryClient.removeQueries()` and remounts the subtree (a `key` that changes). Pages don't add their own.
- **Sign-out:** `queryClient.clear()`.

## Mutations in detail

- Invalidate the narrowest key that covers what changed; return the promise from `onSuccess` when the UI should wait for the refetch.
- **Optimistic updates** only where latency is visible and failure is rare (toggles, reordering): `onMutate` cancels in-flight queries for the key, snapshots and sets the cache; `onError` restores the snapshot; `onSettled` invalidates.
- Disable the submit control with `isPending`; don't keep a separate `saving` state.
- `mutationFn` calls one action. Batch work goes into one action (or one backend call), not `Promise.all` over several actions.

## Server-provided initial data

When the first paint needs the data, prefetch in a Server Component and hand the cache over:

```tsx
const queryClient = new QueryClient();
void queryClient.prefetchQuery({ ...items.get(scope, id), queryFn: () => getItemOnServer(id) });
return <HydrationBoundary state={dehydrate(queryClient)}><ItemClient id={id} /></HydrationBoundary>;
```

Override `queryFn` on the server: the browser's `queryFn` calls a relative URL that doesn't resolve there. Skip this for admin consoles behind sign-in, where client-side loading is fine.

## Tests

- Render through a helper that creates a fresh `QueryClient` per test with `retry: false` and `gcTime: Infinity` (`renderWithQuery(<X />)`), so tests never share cache or wait on retries.
- Stub the network at `fetch`, not the query functions.
- Assert with `findBy...`/`waitFor` for loaded states; test the error row and the empty row once per list component.
- Keep a repo test that fails on a new `useEffect` that fetches, so the rule holds.
