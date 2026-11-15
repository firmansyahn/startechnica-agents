---
title: Mock where the request is made
impact: MEDIUM
tags: data-and-auth
check: scan, review
---

## Mock where the request is made

**Impact: MEDIUM**

`page.route` sees only the browser's requests. The Next server's calls to the backend (server actions, Server Components, the BFF proxy's forwarding, the sign-in callback) need a fake backend the server is pointed at. Don't fake a server action's reply in the browser.

**Incorrect:**

```ts
await page.route("**/app/items", (route) => route.fulfill({ body: "0:{...}" }));   // forging the action's Flight reply
```

**Correct:**

```ts
await fakeBackend.answer(testInfo, "PATCH items/42", { status: 200, body: { data: item({ id: "42", name: "North" }) } });
```

**How to check:** `scripts/scan.sh` lists a server action or Flight reply forged in the browser: a `route.fulfill(` with an RSC row (`"0:{...`) or the `text/x-component` type, and the `Next-Action` or `RSC` header, in the specs and their helpers. Using `page.route` for a call the Next server makes, which never reaches it, stays review.
