# Sections

Rule files are named `<prefix>-<slug>.md`; the file name without `.md` is the rule ID. Cite a rule by its ID.

| # | Section | Prefix | Impact | Covers |
|---|---|---|---|---|
| 1 | Locators | `e2e-` | LOW | Role and name locators, labels, scoping, web-first assertions, user-visible checks |
| 2 | Stability | `e2e-` | LOW | No fixed waits, waiting for content, fixed clocks, URL assertions, final states, independent tests, flaky tests |
| 3 | Data and auth | `e2e-` | MEDIUM | Sign-in per role, test-only sign-in, where to mock, spec-fitting answers, per-test data, worker isolation, no real secrets |
| 4 | Visual | `e2e-` | LOW | Light and dark, theme setup, first paint, frozen motion, masks, baselines from CI, baseline review |
| 5 | Scope and CI | `e2e-` | MEDIUM | What e2e covers, file suffixes, production builds in CI, health-route readiness, accessibility scans, keyboard paths, headers, traces, browser image |

Impact is the default severity of a finding; raise it when the code is on an authentication, payment or data-deletion path.
