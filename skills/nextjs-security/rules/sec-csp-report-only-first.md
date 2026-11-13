---
title: New policies go out report-only first
impact: HIGH
tags: headers
check: review
---

## New policies go out report-only first

**Impact: HIGH**

A new or tightened policy ships as `Content-Security-Policy-Report-Only` with a reporting endpoint, the pages are browsed (e2e, screenshots), violations fixed, then the policy is enforced. Enforcing an untested policy blanks pages in production.
