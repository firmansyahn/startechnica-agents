---
title: lucide-react only
impact: LOW
tags: icons
check: review
---

## `lucide-react` only

**Impact: LOW** (two icon sets and pasted SVGs look inconsistent and ignore `currentColor`)

Import icons from the library in `components.json` (`"iconLibrary": "lucide"` → `lucide-react`). No inline SVG copied from design files, no second icon set. A brand logo or a custom glyph is a component in `components/<brand>-ui/icons/` that uses `currentColor`.

**How to check:** search for inline `<svg>` in pages and for imports from other icon packages.
