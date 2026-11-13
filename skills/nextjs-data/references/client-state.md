# Client state with Zustand

Zustand (v5; check the installed version's types in `node_modules/zustand/`) holds **client-only state shared by components that are far apart**. It is not a second cache for server data: that stays in TanStack Query ([queries.md](queries.md)).

## Which state goes where

| State | Home |
|---|---|
| Data from the backend (lists, records, the signed-in user) | TanStack Query |
| What the URL should restore: filters, search, page, sort, the open tab | `searchParams` (shareable, survives reload) |
| Values being edited in a form | react-hook-form (`nextjs-forms`) |
| One component's UI (a dialog open, a hover) | `useState` |
| A parent and a few children | props, or a small context |
| Client-only state many distant components read and change: a selection used by a table and a bulk action bar, a multi-step wizard's draft, a sidebar's collapsed state, a per-device preference | **Zustand** |
| Light/dark mode, preset, font | the theme mechanism (`nextjs-ui`), not a store |

Reach for a store only when the table above says so; most pages need none.

## The store: per request in the App Router

A module-level `create()` store is one object per JavaScript module. In the browser that is one per tab, but during server rendering the same module serves every request, so a store written during render on the server leaks one user's state into another's page. Zustand's README warns against module stores with React Server Components for this reason.

The team default is a **store per provider**, created with `createStore` from `zustand/vanilla` and handed down by context:

```tsx
// src/stores/selection.tsx
"use client";
import { createContext, useContext, useState, type ReactNode } from "react";
import { createStore, type StoreApi } from "zustand/vanilla";
import { useStore } from "zustand";

type SelectionState = {
  ids: string[];
  toggle: (id: string) => void;
  setAll: (ids: string[]) => void;
  clear: () => void;
};

const createSelectionStore = (initial: string[] = []) =>
  createStore<SelectionState>()((set) => ({
    ids: initial,
    toggle: (id) => set((s) => ({ ids: s.ids.includes(id) ? s.ids.filter((x) => x !== id) : [...s.ids, id] })),
    setAll: (ids) => set({ ids }),
    clear: () => set({ ids: [] }),
  }));

const SelectionContext = createContext<StoreApi<SelectionState> | null>(null);

export function SelectionProvider({ initial, children }: { initial?: string[]; children: ReactNode }) {
  const [store] = useState(() => createSelectionStore(initial));   // once per mount, never shared between requests
  return <SelectionContext.Provider value={store}>{children}</SelectionContext.Provider>;
}

export function useSelection<T>(selector: (s: SelectionState) => T): T {
  const store = useContext(SelectionContext);
  if (!store) throw new Error("useSelection must be used inside <SelectionProvider>");
  return useStore(store, selector);
}
```

- **Mount the provider where the state's lifetime starts**: around the page for a page's selection (leaving the page drops it), around the section layout for state shared by its pages. Remounting with a new `key` resets it.
- **Initial state from the server** goes in as a prop to the provider, never by calling `setState` during render.
- A module-level `create()` store is acceptable only for browser-only state that is the same for every user at first render (a sidebar's collapsed flag) and is changed only from event handlers or effects. When in doubt, use the provider.

## Selecting

```tsx
const count = useSelection((s) => s.ids.length);                       // one value
const toggle = useSelection((s) => s.toggle);                          // actions are stable
const { ids, clear } = useSelection(useShallow((s) => ({ ids: s.ids, clear: s.clear })));   // several: useShallow
```

- Select the smallest slice the component renders. A component re-renders when its selected value changes (`Object.is`).
- A selector that builds a new object or array on every call needs `useShallow` (from `zustand/react/shallow`); without it, the component re-renders on every store change.
- Derive values in the selector (`s.ids.length`, `s.ids.includes(id)`) instead of storing them.

## Actions

- State changes live in the store as named actions (`toggle`, `clear`, `nextStep`); components call actions, never `setState` with a hand-built object.
- Actions are synchronous state changes. A server write is a mutation (`nextjs-data` SKILL.md); its `onSuccess` calls the store action that should follow (`clear()` after a bulk delete).
- Keep server data out: store ids and choices, and read the records from the query by id.

```tsx
const ids = useSelection((s) => s.ids);
const rows = useQuery(items.list(scope, params)).data?.rows ?? [];
const selected = rows.filter((r) => ids.includes(r.id));               // derived, never copied into the store
```

## Persisting

`persist` (from `zustand/middleware`) saves to `localStorage` by default. Use it only for per-device preferences and drafts that may be lost, never for tokens, personal data or anything the server must know.

```ts
export const usePrefs = create<Prefs>()(
  persist(
    (set) => ({ density: "comfortable", setDensity: (density) => set({ density }) }),
    {
      name: "<app>-prefs",                     // one key per store, prefixed with the app
      version: 1,                              // bump with a migrate when the shape changes
      partialize: (s) => ({ density: s.density }),
      skipHydration: true,                     // the server render has no localStorage
    },
  ),
);

// once, in a client component high in the tree:
useEffect(() => { void usePrefs.persist.rehydrate(); }, []);
```

- `skipHydration: true` plus one `rehydrate()` in an effect keeps the first client render equal to the server's, so React doesn't report a hydration mismatch; the saved value applies right after.
- A preference the server needs at render time (theme, locale) is a cookie, not a persisted store.

## Scope switch and sign-out

Stores holding state tied to a tenant, workspace or user reset when it changes: the provider is remounted by the same `key` the query cache reset uses (`queries.md`), and a module-level store gets a `reset` action (`set(store.getInitialState(), true)`) called from that same provider-level listener and on sign-out.

## Where stores live

- A store used by one route lives beside it (`app/<section>/<page>/selection-store.tsx`).
- A store shared by several routes lives in `src/stores/<name>.tsx`, with its provider and hook in the same file (alias `@/stores/*`).
- One store per concern; don't grow one app-wide store that every page edits.

## Devtools

`devtools` (from `zustand/middleware`) only in development, with a store `name`; it must not ship enabled in production builds.

## Tests

- A provider store is tested by rendering the component inside the provider with an `initial` value; no reset needed.
- A module-level store is reset in `afterEach` with `useX.setState(useX.getInitialState(), true)`.
- Assert on what the user sees after an action (the count in the bulk bar), not on the store's internals.
