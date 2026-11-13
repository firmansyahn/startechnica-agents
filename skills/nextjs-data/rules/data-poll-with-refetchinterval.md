---
title: Poll with refetchInterval, not setInterval
impact: HIGH
tags: queries
check: review
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
