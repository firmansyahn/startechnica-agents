---
title: Feedback through the one feedback mutation
impact: HIGH
tags: mutations
check: review
---

## Feedback through the one feedback mutation

**Impact: HIGH**

Success and error toasts come from one wrapper (`useFeedbackMutation({ success: t("saved"), ... })`), not toast calls in every page. A form that shows the refusal inside itself opts out of the error toast instead of showing both.
