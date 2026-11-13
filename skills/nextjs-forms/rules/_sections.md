# Sections

Rule files are named `<prefix>-<slug>.md`; the file name without `.md` is the rule ID. Cite a rule by its ID.

| # | Section | Prefix | Impact | Covers |
|---|---|---|---|---|
| 1 | Fields | `forms-` | MEDIUM | Controls, labels, default values, `Field`/`FieldError`, Base UI controls |
| 2 | Validation | `forms-` | MEDIUM | The shared zod schema, zod 4 API, server 422 errors onto fields |
| 3 | Edit forms and dialogs | `forms-` | MEDIUM | Seeding once, dirty-only PATCH, reset after save, drawers and dialogs, pending state, confirms |
| 4 | Testing | `forms-test-` | LOW | Form tests: validation, server errors, dirty-only bodies, labels |

Impact is the default severity of a finding; raise it when the code is on an authentication, payment or data-deletion path.
