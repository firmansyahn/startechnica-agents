# Sections

Rule files are named `<prefix>-<slug>.md`; the file name without `.md` is the rule ID. Cite a rule by its ID.

| # | Section | Prefix | Impact | Covers |
|---|---|---|---|---|
| 1 | Path | `upgrade-` | MEDIUM | Checkpoints per crossed major, keeping the project's stack, codemod leftovers |
| 2 | Breaking changes | `upgrade-` | HIGH | Node, React 18 and 19 removals, async request APIs, middleware and proxy, removed APIs, parallel route defaults, the bundler, caching and image defaults, new defaults left off |
| 3 | Verify | `upgrade-` | HIGH | The baseline and the comparison with it, the rollout through staging and the rollback |
| 4 | Router | `router-` | HIGH | Pages Router to App Router: route by route, one router per path, no Pages Router APIs under `app/`, the client boundary, props that cross it |
| 5 | Migrate | `migrate-` | MEDIUM | Upgrade first, one phase per merge request |

Impact is the default severity of a finding; raise it when the code is on an authentication, payment or data-deletion path, or the upgrade is going to production.
