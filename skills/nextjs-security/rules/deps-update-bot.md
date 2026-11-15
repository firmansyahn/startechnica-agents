---
title: A bot opens updates, and lockfile maintenance runs weekly
impact: MEDIUM
tags: dependencies
check: scan, review
---

## A bot opens updates, and lockfile maintenance runs weekly

**Impact: MEDIUM**

Renovate (or Dependabot): grouped minor/patch updates on a schedule, majors one at a time, security updates immediately, weekly lockfile maintenance so transitive fixes land. Every update runs the full pipeline.

**How to check:** `scripts/scan.sh` flags a repo root with no Renovate config (`renovate.json`, `renovate.json5`, `.renovaterc*`, `.github/` or `.gitlab/renovate.json*`, a `renovate` key in `package.json`) and no `.github/dependabot.yml`, and a Renovate config without `lockFileMaintenance` enabled (or the `:maintainLockFilesWeekly` preset). A bot configured centrally (an organisation preset) shows as a false finding. Validate the file with `yarn dlx -p renovate renovate-config-validator`; review the grouping, the schedule and that majors come one at a time.
