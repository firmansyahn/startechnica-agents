---
title: Metadata comes from translations
impact: MEDIUM
tags: strings
check: test, review
---

## Metadata comes from translations

**Impact: MEDIUM**

`generateMetadata` reads `meta.title` and `meta.description` from the page's namespace, so the document title is translated and matches the page title.

**How to check:** `templates/metadata-translated.test.ts` fails on `export const metadata` that sets a title (other than the root layout's `title: { template, default }`) or a description, on `generateMetadata` in a file that never calls `getTranslations(`, and on a literal string title or description inside `generateMetadata`, in every `app/**/page.tsx` and `layout.tsx`. A page with no metadata at all, and keys read from another page's namespace, stay review.
