---
title: Check next/image against the Next 16 defaults
impact: MEDIUM
tags: upgrade, next-16, images
check: scan (candidates)
---

## Check next/image against the Next 16 defaults

**Impact: MEDIUM** (images fail to load, or quietly lose quality, with no build error)

Next 16 changed the `next/image` defaults:

- `qualities` allows only `[75]`, so another `quality` falls back unless listed;
- a local `src` with a query string needs `images.localPatterns[].search`;
- optimising images from local IPs is blocked (`dangerouslyAllowLocalIP`, for private networks only);
- redirects stop after 3;
- `minimumCacheTTL` is 4 hours;
- 16 is gone from `imageSizes`.

List every quality the code passes, add the patterns the app needs, and check the images in a screenshot pass.

**Incorrect:**

```tsx
<Image src="/avatars/default.png?v=2" alt="" width={64} height={64} quality={90} />
// next.config: images: {}
```

**Correct:**

```tsx
<Image src="/avatars/default.png?v=2" alt="" width={64} height={64} quality={90} />
// next.config: images: { qualities: [75, 90], localPatterns: [{ pathname: "/avatars/**", search: "?v=2" }] }
```

**How to check:** `scripts/scan.sh` flags a `quality` other than 75 when `next.config` has no `qualities`, a local `src` with a query string, and image hosts on local or private addresses in `next.config`. Then compare image requests (status, size) with the baseline.
