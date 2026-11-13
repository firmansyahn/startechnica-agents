---
title: Fake the network at fetch, not the code
impact: MEDIUM
tags: testing
check: review
---

## Fake the network at fetch, not the code

**Impact: MEDIUM**

Stub `fetch` at the boundary so the real query options, the real actions (with their zod checks and path building) and the real transport run. `vi.mock` of the registry, the transport or an `actions` module leaves exactly the code most likely to break untested.

**Incorrect:**

```tsx
vi.mock("@/services/items/actions", () => ({ saveItem: vi.fn().mockResolvedValue({ ok: true, data: row }) }));
```

**Correct:**

```tsx
const calls = fakeApi({ "POST items": { status: 201, body: row } });   // stubs fetch, records each call
renderWithQuery(<ItemsClient />);
```
