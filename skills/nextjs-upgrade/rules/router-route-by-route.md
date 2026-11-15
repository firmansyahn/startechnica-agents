---
title: Move Pages Router routes to app/ one section at a time
impact: MEDIUM
tags: router, app-router, pages-router
check: review
---

## Move Pages Router routes to app/ one section at a time

**Impact: MEDIUM** (moving every route in one change breaks links, data loading and tests together, with no working state to compare against)

The router move starts after the version upgrade is merged. The root layout and providers come first, with no route moved. Then one route or one section moves per commit, simplest first, each with its page test and a comparison with that route's baseline. `pages/api` moves last, and `_app`/`_document` are deleted once `scripts/routes.sh` shows no `pages` route ([references/pages-to-app.md](../references/pages-to-app.md)). This holds in both modes: upgrade mode with the project's libraries, migrate mode with the team's.

**Incorrect:**

```sh
git mv pages app   # every route at once, getServerSideProps and next/router everywhere
```

**Correct:**

```sh
# commit 1: app/layout.tsx + app/providers.tsx, no route moved
# commit 2: pages/customers/index.tsx -> app/customers/page.tsx + CustomersPage.tsx (+ page test)
# commit 3: pages/customers/[id].tsx  -> app/customers/[id]/page.tsx + CustomerPage.tsx
# last:     pages/api/*, then pages/_app, _document, the i18n block
```

**How to check:** each commit of the move touches one route or section, deletes the `pages/` file it replaces, and updates or adds that route's test. Compare `scripts/routes.sh` output before and after.
