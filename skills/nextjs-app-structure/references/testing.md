# Testing

## Where tests go

| Kind | Where |
|---|---|
| Unit test of a `.ts` module | Beside it: `<name>.test.ts` (Vitest project `node`, no DOM) |
| Component, hook or page test | Beside it: `<name>.test.tsx`, `page.test.tsx` (Vitest project `dom`, jsdom). Anything that renders or touches `window` is `.tsx`, even with no JSX |
| Test harness | `tests/`: `setup.ts`, `setup-dom.ts`, render helpers (`renderWithQuery`), network fakes; a section's own fixtures in its `_shared/testkit.tsx` |
| Repo-wide rule tests | `tests/*.test.ts`: folder layout (`templates/src-layout.test.ts`), design tokens, i18n key parity, banned patterns |
| End-to-end | `tests/e2e/**/*.spec.ts` or `tests/<area>/*.spec.ts` (Playwright `testMatch: "**/*.spec.ts"`), never matched by Vitest. Playwright setup and rules: `nextjs-e2e` |

Split Vitest by suffix so the DOM cost is paid only where needed:

```ts
test: { projects: [
  { extends: true, test: { name: "node", environment: "node", include: ["**/*.test.ts"] } },
  { extends: true, test: { name: "dom", environment: "jsdom", include: ["**/*.test.tsx"], setupFiles: ["./tests/setup-dom.ts"] } },
] }
```

## Page tests

```tsx
const calls = fakeApi(answer);              // stubs fetch at the network boundary, records {method, path, query, body}
renderWithQuery(<XClient />);               // fresh QueryClient, retry: false
```

- **Fake the network, not the code.** Stub `fetch` at the boundary so the real query options, the real server actions (with their zod checks and path building) and the real transport run. Don't `vi.mock` the transport or an `actions` module: the action then goes untested.
- **Answers must fit the API spec.** If the transport validates replies against the OpenAPI document, the fake's fixtures must pass it too: a create answers 201 with the whole row, a delete answers an empty body, a refusal answers the status with `{ message }` (and `fields` for a 422).
- **Assert on the call**, not on the action: `expect(calls.find((c) => c.method === "POST")).toMatchObject({ path: "items", body: { ... } })`.
- One behaviour per test: the call it makes (path, scope header, body), validation, the read-only user, and a render in a second locale.
- Pages using `next-intl` render through a test wrapper that provides the messages.
- Query and action tests in detail: `nextjs-data` Testing rules.

## Running

- Run the tests the change reaches (`yarn vitest related --run <file>`) while working, and the whole suite before a merge request.
- **See it:** take light and dark screenshots of the page with the API mocked (`yarn shots <path>`, from `nextjs-e2e` assets/shots.mjs) and look at them before calling a visual change done.
