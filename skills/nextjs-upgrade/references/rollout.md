# Rolling out the upgrade

The merge is not the end. An upgrade reaches users through staging, then production, with the previous image ready to go back to (`upgrade-rollout-with-rollback`). The same holds for the router move and for each migrate-mode phase that changes what users see.

## 1. Before the merge

- **Write down the image tag production runs now.** That tag is the rollback.
- **The new image builds and starts:** the runtime stage uses the new Node, the start command is unchanged (team: `next start`, `nextjs-deploy`), and the probes answer.
- **The CI image** uses the same Node as the runtime image (`upgrade-node-everywhere`).
- **Shared caches:** a cache shared across pods (a custom `cacheHandler`, a Redis-backed ISR or data cache) keeps entries the new version may not read. Plan to clear it, or give the new version its own key prefix.

## 2. Staging

Deploy the merged build to staging with production-like settings, then repeat the baseline comparison there (`upgrade-verify-against-baseline`):

- **Routes:** every route answers its baseline status code, redirect and important headers (`Cache-Control`, CSP, `Set-Cookie` flags).
- **Screenshots:** the key pages, light and dark if the app has both.
- **Images:** they load at the expected size and quality (`upgrade-image-defaults`).
- **Sign-in:** the full round trip, including token refresh if the app has one, and sign-out.
- **Caching:** pages that relied on caching show the right freshness, and the backend's request rate is close to before (`upgrade-caching-defaults`).
- **Logs and errors:** no new error class in the logs. Check server errors with digests (`onRequestError`), hydration warnings, and 404s on `_next/` assets.
- **Load:** if the app is busy, a short load test against the baseline's numbers (latency, memory per pod). The Node and React upgrades change both.

## 3. Production

- **A rolling update** (the default on Kubernetes) runs old and new pods side by side for a while:
  - a page from the old build loads the new build in full on its next navigation;
  - its Server Actions fail with "server action not found" until the page reloads.

  The team's apps handle both without a `deploymentId` (`nextjs-deploy` references/replicas.md; `runAction` turns the failure into "reload the page", `nextjs-data`). Apps on their own stack: check that they show a clear message rather than a blank error.
- **Release when traffic is low and people can watch it.** Watch error rates, latency and backend request rates for the first hours, and keep the previous tag at hand for a day.
- **Sessions:** sessions in a shared store (Redis) survive the deploy. A session format that the upgrade changed (a new auth library major) signs everyone out. Say so in the release note if it does.

## 4. Rollback

1. **Redeploy the previous image tag.** It is the fastest path and needs no build. Nothing in a Next upgrade changes the database, so the old image runs as before.
2. If shared caches were written by the new version, clear them, as in step 1.
3. **Revert the merge** on the default branch, so the next deploy doesn't bring the upgrade back by accident. Then fix forward on a branch, with the finding added to the baseline checks.

## 5. After

- Remove the stale shared-cache prefix once the rollback window has passed.
- Close the report: what staging and production showed, and anything left for later (the deprecations still in use, the new features not switched on).
