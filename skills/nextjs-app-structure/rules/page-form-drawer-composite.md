---
title: Create and edit happen in the form drawer or dialog composite
impact: MEDIUM
tags: pages
check: review
---

## Create and edit happen in the form drawer or dialog composite

**Impact: MEDIUM**

The project's form drawer/dialog keeps the form open on failure, shows the refusal inside it, disables Save and Cancel while pending, and resets on open. A hand-built `Dialog` + form per page re-implements (and forgets) those.
