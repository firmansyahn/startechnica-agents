---
title: Pass client components DTOs, never records
impact: HIGH
tags: data-exposure, dto, server-components
check: review
---

## Pass client components DTOs, never records

**Impact: HIGH** (password hashes, emails and internal flags ship in the page payload, rendered or not)

Every prop of a `"use client"` component, and every value a server action returns, is serialised to the browser. Build the object the UI needs field by field in the data layer (a DTO), instead of passing database rows or full backend replies through.

**Incorrect:**

```tsx
const user = await db.user.findUnique({ where: { id } });
return <ProfileCard user={user} />;          // every column ships
```

**Correct:**

```tsx
const profile = await getProfileDTO(id);     // { id, name, avatarUrl }
return <ProfileCard profile={profile} />;
```

**How to check:** in review, follow each prop from a server component into a client component, and each action's return value, to its source: a raw row, ORM model or untrimmed reply is a finding. Next's taint APIs (`experimental.taint`) can back this up but are not the boundary.
