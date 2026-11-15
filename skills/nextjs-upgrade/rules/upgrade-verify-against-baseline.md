---
title: Compare the running app with a baseline taken before the upgrade
impact: HIGH
tags: upgrade, verification, testing
check: review
---

## Compare the running app with a baseline taken before the upgrade

**Impact: HIGH** (a green build hides runtime breakage: caching, images, redirects, proxy, sign-in)

Before changing anything, record the old version's behaviour:

- the build's routes table;
- test results, including failures that already exist;
- screenshots of the key pages;
- the status codes of the API routes.

At the end, run a frozen install, typecheck, lint, tests and build, start the app with `next start`, and compare each item. A difference is either explained by a guide (and named in the report) or fixed.

**Incorrect:**

```sh
yarn build   # passes -> "upgrade done"
```

**Correct:**

```sh
yarn install --immutable && yarn typecheck && yarn lint && yarn test && yarn build
yarn start &   # same routes and status codes as the baseline; screenshots compared; sign-in round trip;
               # images load; pages that relied on caching show fresh data; the image starts on the new Node
```

**How to check:** the report names the baseline, each check run at the end, and every difference with its cause.
