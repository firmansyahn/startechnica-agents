---
title: Metadata comes from translations
impact: MEDIUM
tags: strings
check: review
---

## Metadata comes from translations

**Impact: MEDIUM**

`generateMetadata` reads `meta.title` and `meta.description` from the page's namespace, so the document title is translated and matches the page title.
