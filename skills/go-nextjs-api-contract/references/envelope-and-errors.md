# Envelope, status codes and errors

## The envelope

Every JSON reply, success or failure, has the same top level:

```json
{ "status": "success", "message": "", "data": { "id": "0190f3c2-...", "name": "North" } }
{ "status": "success", "message": "", "data": [ { "id": "..." } ], "total": 132 }
{ "status": "failed", "message": "Check the highlighted fields", "errors": { "name": ["Already taken"], "rules.2.value": ["Must be 1 to 65535"] } }
```

| Field | Present | Holds |
|---|---|---|
| `status` | always | `"success"` or `"failed"`; agrees with the HTTP status (2xx ↔ `success`) |
| `message` | always | Empty or a short confirmation on success; on failure a human sentence safe to show the user |
| `data` | success | The row, the page of rows, or absent for a 204-like reply |
| `total` | list replies | The number of rows matching the filters, ignoring `offset`/`limit` |
| `errors` | 422 only | Field path → reasons |

- **One Go helper writes it** (`httpx.OK(w, data)`, `httpx.Page(w, rows, total)`, `httpx.Fail(w, status, message, errors)`) in the Platform HTTP package; handlers never marshal the envelope themselves.
- **No-content replies:** a delete answers `204` with no body, or `200` with the envelope and no `data`; pick one per project and declare it in the document. A create answers `201` with the whole row in `data` (and a `Location` header on public APIs).
- **Non-JSON replies** (file downloads, CSV exports, the OpenAPI document itself, health probes) are outside the envelope and declared with their media type.

## The frontend's mapping

```ts
// src/api/result.ts (nextjs-bff)
export type FieldErrors = Record<string, string[]>;
export interface Failure { status: number; message: string; fields?: FieldErrors }
export type Result<T> = { ok: true; data: T; total?: number } | { ok: false; error: Failure };

export function fromEnvelope<T>(status: number, body: unknown): Result<T> {
  const env = (body ?? {}) as { status?: string; message?: string; data?: T; total?: number; errors?: FieldErrors };
  if (status >= 200 && status < 300 && env.status !== "failed") return { ok: true, data: env.data as T, total: env.total };
  const failure: Failure = { status, message: env.message || fallbackMessage(status) };
  if (env.errors && typeof env.errors === "object") failure.fields = env.errors;
  return { ok: false, error: failure };
}
```

- `ApiError` (thrown by `runAction` and by query functions) carries `status`, `message` and `fields` into `onError`; [nextjs-forms](../../nextjs-forms/SKILL.md) puts `fields` on the form.
- A reply that isn't JSON or isn't the envelope (a proxy's HTML error page) becomes a `Failure` with the HTTP status and a generic message, never a crash on `JSON.parse`.
- Backend unreachable or timed out → the BFF answers 503 with the envelope ([nextjs-bff](../../nextjs-bff/SKILL.md)).

## Status codes

| Status | Meaning | `message` | Frontend does |
|---|---|---|---|
| 200 | Read or update succeeded | empty | renders `data` |
| 201 | Created | empty or "Created" | `setQueryData` with `data`, invalidates lists |
| 204 | Deleted, nothing to say | (no body) | invalidates |
| 400 | The request is malformed: unparseable JSON, a wrong type, an unknown query parameter, a bad path segment | what was wrong | form-level notice (a bug, usually) |
| 401 | No valid credentials | "Sign in again" | guard 401 → refresh once and retry, then sign in ([nextjs-bff](../../nextjs-bff/SKILL.md)) |
| 403 | Signed in, not allowed (permission, scope, plan) | which permission is missing, in words | form-level notice; never a sign-in loop |
| 404 | The record doesn't exist **in the caller's scope** | "Item not found" | the not-found state |
| 409 | Conflict with current state: duplicate unique value, stale version, still in use | what conflicts | form-level notice, or a field error when one field is the cause (then use 422) |
| 422 | Well-formed but invalid values | a summary | `errors` on the fields |
| 429 | Rate limited | "Too many requests" | toast; retry after `Retry-After` |
| 500 | A bug | generic ("Something went wrong") plus the request id | toast with the request id |
| 502/503/504 | A dependency is down or slow | generic | toast; queries may retry |

- **400 vs 422:** 400 when the request can't be read as the documented shape at all; 422 when it can, and the values break a rule. A frontend that validates with the shared zod schema sees 422 only for rules it couldn't check (uniqueness, cross-record rules).
- **404 for other tenants' records**, not 403: a 403 confirms the id exists.
- **Duplicate unique value:** 422 on the field (`errors.name: ["Already taken"]`) when the user can fix it in the form; 409 when it isn't one field's fault.

## Field error paths

The key of `errors` is the field's **JSON path in the request body**, dotted, with array indexes as numbers:

| Request body | Path |
|---|---|
| `{ "name": "" }` | `name` |
| `{ "address": { "city": "" } }` | `address.city` |
| `{ "rules": [{}, {}, { "value": 0 }] }` | `rules.2.value` |
| An error not tied to one field | `""` |

These are react-hook-form's field names when the form's shape mirrors the body ([nextjs-forms](../../nextjs-forms/SKILL.md)), so the error lands on its control without a mapping table. When the form's shape differs from the body (a form that edits `start` and `end` while the body sends `window.start`), the action maps the paths back before returning the `Result`.

On the Go side, validation returns the same paths:

```go
type FieldErrors map[string][]string

func (p ItemInput) Validate() FieldErrors {
	errs := FieldErrors{}
	if strings.TrimSpace(p.Name) == "" {
		errs.add("name", "Required")
	}
	for i, r := range p.Rules {
		if r.Value < 1 || r.Value > 65535 {
			errs.add(fmt.Sprintf("rules.%d.value", i), "Must be 1 to 65535")
		}
	}
	return errs
}
```

Messages are short, user-facing and in the request's language (or stable English the frontend shows as is); never a Go error string, a SQL error or a field's Go name.

## WWW-Authenticate

- The auth guard's 401 (missing, expired, revoked token) answers `WWW-Authenticate: Bearer error="invalid_token"` (RFC 6750; `resource_metadata` too when the API publishes protected-resource metadata, RFC 9728).
- A handler's own 401 (wrong current password on a password change, a wrong one-time code) answers **without** it.
- The BFF refreshes and retries only on the first, so a wrong current password never triggers a token refresh, and a real expiry never shows "wrong password".

## Rate limits

429 with `Retry-After` (seconds). Public APIs also send `RateLimit-Limit`/`RateLimit-Remaining`/`RateLimit-Reset` (or the newer `RateLimit` and `RateLimit-Policy` fields) on every reply; document them in the operation's responses.

## Request ids and 5xx

- Every request carries `X-Request-Id`: the BFF forwards the incoming one or makes a UUID; the backend uses it (or makes one) and echoes it on the reply. Both sides log it ([nextjs-logging](../../nextjs-logging/SKILL.md), [go-code-style](../../go-code-style/SKILL.md)).
- A 5xx never leaks internals: no stack trace, SQL, file path or upstream URL in `message`. The full error is logged once with the request id; the user sees the generic message and the id to quote.
