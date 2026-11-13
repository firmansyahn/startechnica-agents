---
title: Links go places, buttons do things
impact: MEDIUM
tags: accessibility, links, buttons
check: review
---

## Links go places, buttons do things

**Impact: MEDIUM** (navigation buttons break middle-click and open-in-new-tab; links that act break forms)

Navigation uses `Link` (and `render={<Link />}` with `nativeButton={false}` when styled as a button); actions use `button`. A "button" that navigates breaks middle-click and open-in-new-tab; a link that submits breaks forms.

**How to check:** look for buttons calling `router.push` for plain navigation and links with `onClick` handlers that write.
