---
title: Take identity from the session, never from action arguments
impact: CRITICAL
tags: server-actions, auth, authorization
check: scan (candidates), review
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

**How to check:** `scripts/scan.sh` lists fields that describe the caller (`actorId`, `actorRole`, `role`, `isAdmin`, any `...Token`, `sessionId`, `permissions`) in "use server" files, the schemas they import and `src/services/*/input.ts`; a role that is data being written (an invite's role) is a false positive. Review the rest: authorization decisions made from input fields.
