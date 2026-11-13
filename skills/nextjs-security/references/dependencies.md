# Dependencies

All commands through Yarn 4 (`nextjs-package-manager`).

## Audit

```bash
yarn npm audit --all --recursive --environment production --severity high   # what ships
yarn npm audit --all --recursive                                            # everything, for the weekly report
```

- CI runs the production audit on every merge request and fails on `high` and `critical`. A finding you accept goes into `.yarnrc.yml` `npmAuditIgnoreAdvisories` with a comment (advisory, why it doesn't apply, review date), never by turning the job off.
- Read advisories for what matters: a ReDoS in a dev-only tool isn't a runtime risk; a Next.js or React advisory is, even at `moderate`.
- **Next.js and React security releases are applied within days.** Follow their advisories; patch releases (`next@16.x.y`) are low-risk upgrades.

## Updates

- **Renovate** (or Dependabot) opens update merge requests: grouped minor/patch updates on a schedule, majors one by one, security updates immediately, and `lockFileMaintenance` weekly so transitive fixes land.
- Every update merge request runs the full pipeline (type check, unit tests, build, e2e smoke).
- Pin direct dependencies with a caret range and let the lockfile pin the rest; never commit without `yarn.lock`, and install with `--immutable` in CI and Docker.

## Lockfile review

A `yarn.lock` diff is code. In review:
- a new package you didn't add on purpose (pulled in by a minor update): look at what it is;
- a changed `resolution` to a different registry or a tarball/git URL;
- a package name that is a near-miss of a popular one (typosquatting);
- a `checksum` that changed without a version change.

## Install scripts

Most packages don't need `postinstall`. Yarn 4 can turn them off and allow-list the few that do:

```yaml
# .yarnrc.yml
enableScripts: false
```

```json
// package.json
"dependenciesMeta": { "<package-that-needs-its-build>": { "built": true } }
```

Try it on a branch: run the app, the tests and the build; add an allow-list entry only for a package that breaks without its script.

## New dependencies

Before `yarn add`: is it maintained (recent releases, open issues answered), how many transitive packages does it bring, does it need install scripts, is the platform or an existing dependency already enough? Prefer the platform (`fetch`, `URL`, `crypto.randomUUID`, `Intl`) over a package.
