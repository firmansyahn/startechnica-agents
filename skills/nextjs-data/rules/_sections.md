# Sections

Rule files are named `<prefix>-<slug>.md`; the file name without `.md` is the rule ID. Cite a rule by its ID.

| # | Section | Prefix | Impact | Covers |
|---|---|---|---|---|
| 1 | Queries | `data-` | HIGH | `useQuery`, query options and keys from the services registry, `enabled`, paging, polling, lookups, edit-form reads, scope switch |
| 2 | Mutations | `data-` | HIGH | `useMutation`, `runAction`, cache updates after writes, feedback, optimistic updates |
| 3 | Server actions | `action-` | HIGH | `"use server"` files: exports, input, identity, authorization, scope, `Result`, return value, `redirect` |
| 4 | Client state | `store-` | MEDIUM | Zustand stores: what belongs in a store, per-provider stores, selectors, actions, persist, reset |
| 5 | Testing | `data-test-` | MEDIUM | Faking the network, fresh query clients, fixtures, asserting on calls, action tests |

Impact is the default severity of a finding; raise it when the code is on an authentication, payment or data-deletion path.
