# Server Actions

Server Actions are **for writes**. Reads go through Server Components or TanStack Query ([queries.md](queries.md)), never through an action. The recipe and the client side are in [SKILL.md](../SKILL.md); this page has the detail.

## Where actions live

- One file per backend domain: `src/services/<domain>/actions.ts` with `"use server"` as its first line. An action used by one page only may live beside it as `app/<section>/<page>/actions.ts`.
- **Every export of a `"use server"` file must be an async function.** Types, zod schemas and constants go in a sibling file (`input.ts`, `schema.ts`); re-exporting a schema from the actions file breaks the build.
- No inline `"use server"` functions inside components: they capture closure variables that Next must encrypt and ship to the browser. Keep actions top-level in their own file.
- Server-only helpers the actions call (session, backend client) start with `import "server-only"`.

## The recipe, step by step

1. **Take `unknown`, parse with zod.** Arguments arrive from an HTTP POST anyone can send; TypeScript types are not a check. Share the schema with the form.
2. **Identity comes from the request, never from an argument.** Read the session from the cookie (`cookies()`/`headers()`); an action that receives a user id, role or token as a parameter is a privilege escalation waiting to happen.
3. **Authorize inside the action.** Rendering the button only for allowed users is not a security boundary. With a BFF, the backend enforces it on the forwarded call; with direct DB access, the Data Access Layer checks ownership (`where: { id, ownerId: session.userId }`).
4. **Send a reference plus the change.** The client names *which* record (an id) and *what* changes; the server re-reads anything else. Never accept a whole record and write it back. PATCH sends only the fields that changed.
5. **Scope is explicit.** A multi-tenant/workspace app passes the chosen scope as an input field, because the action can't see client state; the backend checks the user may act in it.
6. **Return a `Result`, don't throw.** A production build replaces thrown error messages with a generic digest, so the user would never see "name already taken". Return `{ ok: true, data }` or `{ ok: false, error: { status, message, fields? } }`. Throw only for programming errors.
7. **Constrain the return value.** It is serialised to the browser: return what the UI renders (the saved row from the API), never raw DB records, tokens or internal ids the UI doesn't need.
8. **Path segments are encoded** (`encodeURIComponent`) and the action refuses one that decodes to `/`, `..` or a control character, so an id can't redirect the call to another endpoint.

`redirect()` throws a control-flow exception: call it last, outside `try`/`catch`, and never before something that must still run.

## Calling actions

- **From TanStack Query** (interactive apps): `useMutation({ mutationFn: (v) => runAction(() => saveItem(v)) })`, as in [SKILL.md](../SKILL.md).
- **From a form** (progressive enhancement, simple pages): `<form action={formAction}>` with `useActionState(action, initial)`; the action then takes `(prevState, formData: FormData)` and still parses with zod.
- **Not in parallel.** `Promise.all` over several actions still runs them one after another. Do batch work inside one action (or one backend call).
- **Not for reads, not in `useEffect`.**

## Files, size and settings

- **Uploads and downloads don't go through actions.** Actions are capped at 1 MB by default and can't stream; use a route handler (`app/<area>/api/.../route.ts`) and a small client helper (`uploadFile`, `downloadFile`). Raise `serverActions.bodySizeLimit` only for a known, bounded payload.
- **Behind a reverse proxy or another host name**, Next's CSRF check (Origin vs Host/X-Forwarded-Host) refuses the call: list the public origins in `serverActions.allowedOrigins` (under `experimental` on the versions that keep it there; check the docs).
- **Several replicas or self-hosting:** replicas of one image share the key the build generated (it is in the build's server-actions manifest), so `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` is optional; set it (base64, at `next build`) only to keep the key across builds. Prefer rolling deploys: action ids change per build, which `runAction` turns into a "reload the page" message. Details: `nextjs-deploy` references/replicas.md.

## Tests

- Call the action directly in a Vitest `node` test with the network stubbed at the boundary (`fetch`) and the request's cookie/headers mocked (`next/headers`). Assert on the call it made (method, path, body, scope header) and on the `Result` for: invalid input (no call made, field errors), signed out, backend refusal (status and message passed through), success.
- Page tests let the real action run and answer its network call, instead of `vi.mock`-ing the actions module (`nextjs-app-structure`).
