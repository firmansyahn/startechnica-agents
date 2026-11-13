# Data and secrets on the server

Verified against Next 16's `data-security.md`, `environment-variables.md` and `next-config-js/taint.md`.

## The model: a Data Access Layer that returns DTOs

Whatever a Server Component or server action reads goes through one `server-only` layer that checks the caller and returns only what the UI needs.

| App shape | The Data Access Layer is |
|---|---|
| BFF in front of a backend API (`nextjs-bff`) | `src/api/` plus the services registry: the backend authorizes, the BFF validates replies against OpenAPI and the action/proxy returns the reply's DTO |
| Next talks to a database directly | `src/data/` (or `src/libs/data/`): `import "server-only"`, reads the session (`cache()`d per request), checks ownership in the query, maps rows to DTOs |

```ts
// src/data/projects.ts
import "server-only";
import { cache } from "react";

export const getProjectDTO = cache(async (id: string) => {
  const user = await currentUser();                         // from the session cookie
  const row = await db.project.findFirst({ where: { id, members: { some: { userId: user.id } } } });
  if (!row) return null;
  return { id: row.id, name: row.name, updatedAt: row.updatedAt.toISOString() };   // the DTO: no owner email, no billing ids
});
```

- **DTOs are explicit.** Build the returned object field by field (or `pick` from the generated API type); never spread a row or a backend reply into props.
- **Pages and components don't import the database client or read `process.env`.** Only the Data Access Layer and the config reader do; a lint rule can enforce it (`no-restricted-imports` for the DB package outside `src/data/`).
- **Props to client components are public.** Anything passed to a `"use client"` component is serialised into the HTML/RSC payload, even if the component never renders it.
- **Server actions use the same layer** for mutations (the action stays thin: parse, call the layer, return the `Result`).

## `server-only`

Every module that holds secrets, reads `process.env`, talks to the database or the token store starts with `import "server-only"`. A client import then fails the build instead of shipping the code. Next handles the import itself; install the package only if a lint rule flags it as missing (`yarn add server-only`).

## Taint (defence in depth)

With `experimental.taint: true` in `next.config`, React's `experimental_taintObjectReference(message, object)` and `experimental_taintUniqueValue(message, lifetimeObject, value)` make React throw if that object or value reaches a client component. The flag also taints the `process.env` object itself.

- Taint whole records the DAL reads (`taintObjectReference`) and secrets you hold as values (`taintUniqueValue` for an API key).
- It tracks references only: a copy (`{ ...user }`) or a derived value is untainted. It's a seatbelt for mistakes, not the boundary; DTOs are the boundary.
- It enables React's experimental channel for `app/`; weigh that before turning it on, and pin the Next version.

## Environment variables

- **`NEXT_PUBLIC_*` is inlined into the browser bundle at `next build`** and frozen there. It is public and it ignores the runtime environment, so it breaks "one image for every environment". Use it only for non-secret build constants; send runtime public config from the server (a Server Component prop or a small config endpoint).
- **`next.config` `env: { ... }` is inlined the same way**, without the prefix warning. Don't use it for anything secret; prefer not to use it at all.
- **Read server variables per request** in one config module (`src/api/config.ts`, `nextjs-bff`), never at module load, and never in `next.config` (it runs at build and at start with different environments).
- **Dynamic lookups aren't inlined** (`process.env[name]`): fine on the server, `undefined` in the browser.
- **Files:** `.env*` are gitignored except `.env.example` (names and dummy values only). Real values come from the secret store as environment variables or mounted files; never baked into the image.

## Secrets

- One place reads each secret; it is never logged (`nextjs-logging` redaction), never returned, never put in a URL, never in an error message.
- Rotate on a schedule and on any suspected leak; code reads the current value per request so rotation needs no rebuild.
- `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`, when set, is a secret: from the secret store, never in the repo or a log (`nextjs-deploy` references/replicas.md says when it is needed).

## Error output

- Production builds replace thrown messages in Server Components and actions with a digest; route handlers don't: catch, log with the request id, and answer a generic message with the status.
- Never answer a stack trace, SQL, a backend URL or a token in any reply. `error.tsx` shows the digest, not `error.message`, in production.
