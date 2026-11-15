---
title: In upgrade mode, change only what the new versions force
impact: MEDIUM
tags: upgrade, scope, dependencies
check: review
---

## In upgrade mode, change only what the new versions force

**Impact: MEDIUM** (an upgrade that also swaps libraries is a migration nobody asked for, and its regressions hide among the version changes)

Upgrade mode keeps the project's package manager, router and libraries. A library moves to a newer release of itself when the target needs it. Replacing it (SWR with TanStack Query, Jest with Vitest, npm with Yarn) is migrate mode, or the user's explicit decision. When a library has no release that supports the target, stop and ask the user, with the options. Enzyme is the common case: it has no React 18 adapter, so an app tested with it needs a new test library even in upgrade mode.

**Incorrect:**

```sh
# upgrade mode, project on npm with SWR
yarn set version 4 && yarn add @tanstack/react-query   # new package manager, new data library
```

**Correct:**

```sh
npm install swr@<release supporting react 19>        # same library, a supporting release
# report: "swr 1.x -> 2.x: required for React 19 (peer dependency)"
```

**How to check:** in the diff of `package.json`, every added or removed dependency, and every lockfile created or deleted, is either forced by the target (named in the report) or approved by the user.
