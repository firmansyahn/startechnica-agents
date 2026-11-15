---
title: Leave no removed or deprecated API behind
impact: HIGH
tags: upgrade, removals, deprecations
check: scan (candidates)
---

## Leave no removed or deprecated API behind

**Impact: HIGH** (a removed API fails the build or the request; a deprecated one becomes the next upgrade's breakage)

Every crossed major removes something ([references/version-path.md](../references/version-path.md)):

- 13: `next.config` `target`
- 14: `next export`, `@next/font`, `ImageResponse` from `next/server`
- 15: `experimental-edge`, `NextRequest` `geo` and `ip`, the old experimental config names, `useFormState`
- 16: `next lint`, `serverRuntimeConfig` and `publicRuntimeConfig`, AMP, `experimental.dynamicIO`/`useCache`, Sass `~` imports, single-argument `revalidateTag`

The deprecated `next/legacy/image` and `images.domains` go too. Replace each one with the guide's replacement.

**Incorrect:**

```ts
// package.json
"lint": "next lint"
// next.config.js
publicRuntimeConfig: { apiUrl: "/api" },
images: { domains: ["cdn.example.com"] },
```

**Correct:**

```ts
// package.json
"lint": "eslint ."
// settings read at runtime instead of publicRuntimeConfig (nextjs-deploy)
images: { remotePatterns: [{ protocol: "https", hostname: "cdn.example.com" }] },
```

**How to check:** `scripts/scan.sh` flags each removed or deprecated name in `package.json` scripts, `next.config.*`, code and styles. Some hits are false positives (a variable named `target`): confirm against the guide.
