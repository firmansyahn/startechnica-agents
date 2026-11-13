# Sections

Rule files are named `<prefix>-<slug>.md`; the file name without `.md` is the rule ID. Cite a rule by its ID.

| # | Section | Prefix | Impact | Covers |
|---|---|---|---|---|
| 1 | Folders | `struct-` | LOW | Which folder a file goes in: colocation, `src/<kind>/`, twins, primitives, server-only, aliases, monorepo packages |
| 2 | Pages | `page-` | MEDIUM | Thin server `page.tsx`, the client component, central access, form drawers, confirms, read-only users, settings pages, scope |
| 3 | Strings | `i18n-` | MEDIUM | Message files, key namespaces, locale parity, metadata, variables, formatters, backend messages |
| 4 | Testing | `page-test-` | LOW | Where tests go, the Vitest split, what a page test covers, role queries, screenshots |

Impact is the default severity of a finding; raise it when the code is on an authentication, payment or data-deletion path.
