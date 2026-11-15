# src/configs

Runtime settings, read from the environment per request (`runtime-config.ts`), never at build time: no `NEXT_PUBLIC_*` settings and nothing environment-dependent in `next.config.mjs`. Import as `@/src/configs/<module>` from server code (`nextjs-deploy`).
