---
title: Lockfile diffs are reviewed like code
impact: MEDIUM
tags: dependencies
check: review
---

## Lockfile diffs are reviewed like code

**Impact: MEDIUM**

Look for packages nobody added on purpose, resolutions pointing at another registry or a git/tarball URL, near-miss names, and checksums that changed without a version change.
