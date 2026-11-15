---
title: lucide-react only
impact: LOW
tags: icons
check: eslint, review
---

## `lucide-react` only

**Impact: LOW** (two icon sets and pasted SVGs look inconsistent and ignore `currentColor`)

Import icons from the library in `components.json` (`"iconLibrary": "lucide"` → `lucide-react`). No inline SVG copied from design files, no second icon set. A brand logo or a custom glyph is a component in `components/<brand>-ui/icons/` that uses `currentColor`.

**How to check:** The kit's `eslint.config.mjs` (nextjs-new-app) reports imports from other icon packages (react-icons, Heroicons, Radix icons, Tabler, Phosphor, Font Awesome, MUI icons, Iconify) in `app/`, `components/` and `src/`, and inline `<svg>` in `app/` and `components/` outside `components/<brand>-ui/icons/` and the shadcn primitives. Whether a brand glyph uses `currentColor` stays review.
