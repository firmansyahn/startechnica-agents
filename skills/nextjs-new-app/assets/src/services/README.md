# src/services

The data layer per domain: `src/services/<domain>/index.ts` holds the query options and keys, `actions.ts` the server actions that return a `Result`, `input.ts` the shared zod schemas; `client.ts` is the browser read transport. Components import the registry as `@/services/<domain>`, never `fetch` (`nextjs-data`).
