---
title: Files are uploaded first, then referenced
impact: MEDIUM
tags: edit-forms
check: review
---

## Files are uploaded first, then referenced

**Impact: MEDIUM**

A file goes through the upload helper to a route handler (server actions cap at 1 MB and can't stream); the form then submits the returned id or URL. The schema checks type and size in the browser, and the server checks again.
