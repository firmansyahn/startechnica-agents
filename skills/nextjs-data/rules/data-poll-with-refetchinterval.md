---
title: Poll with refetchInterval, not setInterval
impact: HIGH
tags: queries
check: eslint, review
---

## Poll with refetchInterval, not setInterval

**Impact: HIGH**

**Incorrect:**

```tsx
useEffect(() => { const t = setInterval(() => refetch(), 10_000); return () => clearInterval(t); }, []);
```

**Correct:**

```tsx
useQuery({ ...sessions.live(scope), refetchInterval: 10_000, refetchIntervalInBackground: false });
```

**How to check:** the kit's `eslint.config.mjs` (`nextjs-new-app/assets`) flags a `setInterval` callback that calls `refetch`, `fetch`, `invalidateQueries` or `refetchQueries`. It misses an interval that calls a named function (`setInterval(load, 10_000)`) and `setTimeout` loops; look for those in review.
