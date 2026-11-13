---
title: Take identity from the session, never from action arguments
impact: CRITICAL
tags: server-actions, auth, authorization
check: review
---

## Take identity from the session, never from action arguments

**Impact: CRITICAL** (anyone can call the action as anyone)

A server action is a public POST endpoint. Who is calling, their role, their token and their memberships come from the request (session cookie → server-side session), never from a parameter the browser sends. The scope a write targets may be an argument, but the backend (or the action) checks the caller may act in it.

**Incorrect:**

```ts
"use server";
export async function deleteUser(input: { userId: string; actorId: string; role: string }) {
  if (input.role !== "admin") return forbidden();
  await db.user.delete({ where: { id: input.userId } });
}
```

**Correct:**

```ts
"use server";
export async function deleteUser(input: unknown) {
  const { userId } = deleteUserInput.parse(input);
  return apiAction("DELETE", `users/${encodeURIComponent(userId)}`);   // session from the cookie; backend authorizes
}
```

**How to check:** in every `"use server"` file, look for parameters describing the caller (`actorId`, `role`, `isAdmin`, `token`, `accessToken`, `sessionId`) and for authorization decisions made from input fields.
