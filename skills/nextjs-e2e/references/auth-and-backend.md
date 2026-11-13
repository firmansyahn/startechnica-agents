# Signing in, the backend, and test data

## Where requests come from

```
browser ──► Next server ──► backend API
  │            │
  │            ├─ Server Components rendering a page
  │            ├─ server actions (writes)
  │            ├─ the BFF reads proxy (/<area>/api/...)  ── forwards to the backend
  │            └─ the sign-in callback (token exchange)
  │
  └─ page.route() sees ONLY these: requests the browser makes
     (page loads, /<area>/api/... reads, the action POST to the page URL, static files)
```

`page.route` can intercept a browser's call to `/<area>/api/items`, but then the BFF proxy never runs. It can't see the Next server's own calls to the backend at all, so a server action or a Server Component read can't be mocked from the browser. (Faking an action's reply at the browser means forging React's Flight format: don't.)

## Choose the backend for a suite

| Backend | How | Good for |
|---|---|---|
| **Fake backend server** | A small HTTP server (Node `http` or a mock server generated from the OpenAPI document) started as the first `webServer`, with Next's backend URL pointed at it. Specs set its answers per test through a control endpoint, keyed by a per-test id header | The default for a BFF app: the real proxy, actions, session refresh and reply validation run; answers fit the spec |
| **Browser routes** (`page.route`) | Intercept the reads proxy paths in the browser | Pages with no server-side reads or writes, error states, slow-network states (`route.fulfill` after a delay), and the screenshot script |
| **Real backend** | The backend in a container (or a shared test environment) with a disposable database, seeded per run | Smoke tests of the deployed stack, contract checks; a few journeys, not the whole suite |

Whatever answers must fit the API's OpenAPI document; the BFF validates replies, so an invalid fixture fails as a 502 instead of testing the page.

```ts
// A browser route for a read, answered from a typed fixture
await page.route("**/app/api/items?**", (route) =>
  route.fulfill({ json: { status: 200, data: [item({ name: "North" })], total: 1 } }),
);
```

## Sign in once per role

A setup project signs in, saves cookies and storage, and every spec starts signed in:

```ts
// tests/e2e/auth.setup.ts
import { test as setup, expect } from "@playwright/test";

setup("sign in as admin", async ({ page }) => {
  await page.goto("/app");                                   // redirected to the authorization server
  await page.getByLabel("Email").fill(process.env.E2E_ADMIN_EMAIL!);
  await page.getByLabel("Password").fill(process.env.E2E_ADMIN_PASSWORD!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.context().storageState({ path: "tests/e2e/.auth/admin.json" });
});
```

- With a BFF the saved state is the opaque session cookie; the tokens stay in the server's store, so the store must outlive the setup project (the same Redis for the whole run, or the in-memory store of the one server process).
- **One state file per role** (`admin.json`, `readonly.json`); a spec picks its role with `test.use({ storageState: ... })`.
- **Test-only sign-in** when the real flow needs an external identity provider: a route that exists only when a test flag is set at build or start (`E2E_AUTH=1`) and mints a session for a named test user. It must be impossible to enable in production: refuse to start with the flag when `NODE_ENV=production` and the public URL isn't a test host, and cover that refusal with a unit test.
- Credentials for test users come from CI variables; `.auth/` is gitignored.
- Specs that test sign-in itself (wrong password, lockout, `next` redirects) use `test.use({ storageState: { cookies: [], origins: [] } })`.

## Test data

- **Each test creates what it needs**, through the API or the fake backend, with a unique name (`` `Customer ${testInfo.testId}` `` or a short random suffix), and finds it by that name.
- **Never depend on another test's data or on order**; `fullyParallel` must pass.
- **Per-worker isolation** when tests share a real backend: a tenant/workspace per worker (`testInfo.parallelIndex`), created in a worker-scoped fixture.
- **Clean up** in the fixture's teardown when the backend is shared; a disposable database per run is simpler.
- **Time and randomness:** fix the clock where dates show (`await page.clock.setFixedTime(new Date("2026-01-15T10:00:00Z"))`), fix seeds in fixtures.

## Fixtures

```ts
// tests/e2e/fixtures.ts
import { test as base, expect } from "@playwright/test";

export const test = base.extend<{ items: ItemsApi }>({
  items: async ({ request }, use) => {
    const created: string[] = [];
    await use({
      create: async (name) => { const r = await request.post("/test-api/items", { data: { name } }); const row = await r.json(); created.push(row.id); return row; },
    });
    for (const id of created) await request.delete(`/test-api/items/${id}`);
  },
});
export { expect };
```
