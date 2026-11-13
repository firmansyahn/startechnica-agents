# Fast tests that still block the merge

Unattended development (an agent merging on its own, a merge guard, `gitlab-babysit-mr`) is only safe when a green pipeline means every test passed. So test suites run **automatically and block the MR** (`ci-tests-block-merge`). When they are slow, make them fast; don't make them manual, optional or "affected packages only". Measure first, then pull the levers below in order: the first ones cost nothing and risk nothing.

## 1. Measure where the time goes

Job durations over the last few hundred jobs:

```sh
for page in 1 2 3; do glab api "projects/:id/jobs?per_page=100&page=$page&scope[]=success&scope[]=failed"; done \
  | jq -r '.[] | "\(.name)\t\(.status)\t\(.duration // 0 | floor)"' \
  | awk -F'\t' '{n[$1]++; s[$1]+=$3; if($3>m[$1])m[$1]=$3; if($2=="failed")f[$1]++} END{for(k in n) printf "%-22s runs=%d failed=%d avg=%ds max=%ds\n",k,n[k],f[k],s[k]/n[k],m[k]}' | sort
```

Inside one job, the trace's section markers split cache, script and upload (timestamps are at the start of each line):

```sh
glab api projects/:id/jobs/<id>/trace | grep -aE 'section_(start|end):[0-9]+:(restore_cache|step_script|archive_cache)'
```

Per package or per test file:

```sh
glab api projects/:id/jobs/<id>/trace | grep -aE '\sok\s' | sed -E 's/^.*\sok\s+//' | sort -k2 -rn | head   # Go: package and seconds
```

Vitest prints a duration per file with `--reporter=verbose`; the slowest files are the shard-balancing input.

Also count failures: a suite that fails often on real bugs is worth blocking on; one that fails on flakes needs fixing before it can block.

## 2. Levers, cheapest first

| Lever | What to change | Typical gain | Risk |
|---|---|---|---|
| **Write the cache once** | Test jobs `cache: policy: pull`; one job on the integration branch writes it (`pull-push`, via a rule-level variable) (`ci-cache-write-once`) | The upload: minutes per job for a Go build cache | None |
| **No second compile** | Run `go vet` (and other static checks over the same packages) inside the test job, on the packages that job tests, instead of a separate vet job | One job and its compile | None |
| **Split the suite across jobs** | Go: `parallel: matrix:` with a shard variable, packages grouped so each job takes about as long as the slowest single package; a catch-all shard (`go list ./... \| grep -vE '<the named ones>'`) takes new packages by itself. Once the slowest packages have their own shards, the catch-all (dozens of packages, each compiled and tested) is often the new slowest job: sum its packages' `ok` times and move the top ones into another named shard until it is about half. Node: `parallel: N` with `vitest run --shard="$CI_NODE_INDEX/$CI_NODE_TOTAL"` (Jest: `--shard`) | Wall time down to the slowest shard | Needs that many runners free at once; otherwise the shards queue |
| **Parallel tests inside a package** | `t.Parallel()` in Go tests that own everything they touch: their own database from a template (`dbtest.Open`), no package globals, no `t.Setenv` (`go-testing` rule `test-race-and-parallel`). One package per MR, slowest first | The slowest package stops being the floor | Hidden shared state shows up as flakes; fix it, don't skip the test |
| **Faster services** | A throwaway test database: `fsync=off`, `full_page_writes=off`, enough `max_connections` | Small | None for throwaway data |

Not levers: making the suite manual or `allow_failure`, running only "affected" packages as the only gate (a wiring package that imports everything is exactly what it skips), or retrying until green.

A suite that was manual will show failures once it runs on every MR, often tests that pass on a quiet laptop and fail on a loaded runner: an assertion on something an effect or a goroutine does later, checked without waiting for it. That is a test bug. Fix the test (wait for the condition: Testing Library's `waitFor`, Go's `require.Eventually` or a channel), in its own commit, rather than retrying the job.

## 3. Keep the full picture

- **Run the full suites again on the integration branch after each merge**, automatically: they catch what two MRs break together.
- **A nightly scheduled pipeline** runs the suites with no change (a schedule counts every `rules:changes` as changed). Give every build, release and stop job a first rule `if: '$CI_PIPELINE_SOURCE == "schedule"'` → `when: never`, or the nightly run redeploys.
- **Image builds `needs:` the tests**, with `optional: true` where a pipeline can lack the test job.
- **Re-measure after each change** on the MR's own pipeline, and say the before/after numbers in the MR.

## Shapes that worked

```yaml
.api:
  variables:
    CACHE_POLICY: pull          # every job reads
  cache:
    key: { files: [api/go.sum] }
    paths: [.cache/go-mod, .cache/go-build]
    policy: $CACHE_POLICY

api:test:
  extends: .api
  parallel:
    matrix:
      - TEST_SHARD: [app, db, mid, rest]
  rules:
    # The shard that compiles every package writes the cache, on the integration branch only.
    - if: '$CI_COMMIT_BRANCH =~ $APP_REF_DEV && $TEST_SHARD == "app"'
      changes: *api-changes
      variables: { CACHE_POLICY: pull-push }
    - changes: *api-changes
  script:
    - |
      case "$TEST_SHARD" in
        app)  pkgs="./internal/app" ;;
        db)   pkgs="./internal/database ./internal/auth" ;;
        # The next-slowest packages, about half the catch-all's summed test time.
        mid)  pkgs="./internal/billing ./internal/search ./internal/notify ./internal/reports" ;;
        rest) pkgs="$(go list ./... | grep -vE '/internal/(app|database|auth|billing|search|notify|reports)$' | tr '\n' ' ')" ;;
      esac
      go vet $pkgs
      go test $pkgs

web:test:
  extends: .web-check
  parallel: 2
  rules:
    - changes: *web-changes
  script:
    - yarn test --shard="$CI_NODE_INDEX/$CI_NODE_TOTAL"
```

The Go assets in this skill ([../assets/go.gitlab-ci.yml](../assets/go.gitlab-ci.yml)) and the Next.js one in `nextjs-deploy` follow these shapes.
