# src/api

Server-only BFF code: the backend transport (`apiAction`, the reads proxy), session and token handling. Every module imports `server-only`; `result.ts` (`Result`, `ApiError`, `errorText`) is the one client-safe module. Import it as `@/src/api/<module>` from server code; browser code imports types only (`nextjs-bff`, rule `struct-server-only`).
