# Next.js app image, run with `next start`. Build context is the repo root; the app lives in <app>/
# (its folder; for an app at the repo root, drop the "<app>/" prefixes). Copy to <app>/shrine/Dockerfile.production
# (and Dockerfile.default; the CI picks Dockerfile.<tier> and falls back to .default).
# Stages: deps (all) -> builder, prod-deps -> runner.
# NODE_VERSION is passed by the app's CI file (--build-arg).
ARG NODE_VERSION=24

# The two dependency stages start from the Node image, not from a shared stage that copies the
# manifests: kaniko keys a stage built on another stage by that stage's image digest, and a COPY
# layer's digest changes with every checkout (the files' times), so every install missed the
# cache. Here an install is keyed by the manifests' content and reused until they change.

# deps: every dependency, for the build.
FROM node:${NODE_VERSION}-trixie-slim AS deps
WORKDIR /app
# Yarn 4 is the release committed in .yarn/releases and named by yarnPath (nextjs-package-manager):
# plain Node runs it, no Corepack.
COPY <app>/package.json <app>/yarn.lock <app>/.yarnrc.yml ./
COPY <app>/.yarn/releases ./.yarn/releases
RUN node .yarn/releases/yarn-*.cjs install --immutable

# prod-deps: runtime dependencies only.
FROM node:${NODE_VERSION}-trixie-slim AS prod-deps
WORKDIR /app
COPY <app>/package.json <app>/yarn.lock <app>/.yarnrc.yml ./
COPY <app>/.yarn/releases ./.yarn/releases
RUN node .yarn/releases/yarn-*.cjs workspaces focus --production

# builder: compile the app on top of deps, whose node_modules are already in place.
FROM deps AS builder
ENV NEXT_TELEMETRY_DISABLED=1
# No runtime setting (API_BASE_URL, APP_BASE_URL, APP_ENV, ...) is needed here: the app reads
# them per request (proxy.ts, src/configs), so the same image runs in every environment.
COPY <app>/ ./
RUN node .yarn/releases/yarn-*.cjs build
# The app's own build, for a version page: APP_VERSION and GIT_SHA build arguments written to a
# file the server reads (src/libs/build.ts). The pipeline passes both (--build-arg); a build
# without them reports "dev". Declared after the build, so a new commit doesn't invalidate the
# `yarn build` layer.
ARG APP_VERSION=dev
ARG GIT_SHA=dev
RUN node -e 'require("fs").writeFileSync("build.json", JSON.stringify({ version: process.env.APP_VERSION, commit: process.env.GIT_SHA }) + "\n")'

# runner: the production image, as an unprivileged system user.
FROM node:${NODE_VERSION}-trixie-slim AS runner
WORKDIR /app
# NODE_ENV=production only in Dockerfile.production; Dockerfile.default (every other tier) drops
# that line and is otherwise identical. `next start` defaults NODE_ENV to production when unset.
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Non-root runtime user (debian: groupadd/useradd, not alpine's adduser). Use the org's fixed id.
RUN groupadd --system --gid 14918 startechnica \
    && useradd --system --uid 14918 --gid startechnica \
        --home-dir /app --no-create-home startechnica

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/build.json ./build.json
# `next start` loads next.config again at startup, so it ships in the image (copy next.config.ts
# instead if the app uses one: next start loads it with production dependencies only). src/ ships
# too, as in the team's image, for server code that reads files under it at run time.
COPY --from=builder /app/next.config.mjs ./next.config.mjs
COPY --from=builder /app/src ./src
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public

USER startechnica
EXPOSE 3000

# Run the Next binary directly as PID 1, so SIGTERM reaches Next's own graceful shutdown: no
# yarn in the runtime image.
ENTRYPOINT [ "node", "node_modules/next/dist/bin/next", "start" ]
