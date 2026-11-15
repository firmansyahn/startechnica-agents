---
title: Run the related tests while working, the suite before merging
impact: LOW
tags: testing
check: ci, review
---

## Run the related tests while working, the suite before merging

**Impact: LOW**

`yarn vitest related --run <file>` for the files you touch; the whole suite (and the type check) before opening a merge request.

**How to check:** the `nextjs-deploy` pipeline (`assets/ci/nextjs.gitlab-ci.yml`) runs the typecheck, the lint and `yarn test` on every merge request, so the suite gates the merge. Running the related tests while working is a habit: `yarn vitest related --run <file>`.
