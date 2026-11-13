---
title: Backend messages are shown as sent, not translated by key guessing
impact: MEDIUM
tags: strings
check: review
---

## Backend messages are shown as sent, not translated by key guessing

**Impact: MEDIUM**

A refusal's `message` from the backend is shown as is (the backend localises it or sends a stable text); the UI doesn't map English sentences to keys. The UI translates its own fallback ("Failed to save") when the reply has no message.
