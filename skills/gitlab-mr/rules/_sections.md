# Sections

Rule files are named `<prefix>-<slug>.md`; the file name without `.md` is the rule ID. Cite a rule by its ID.

| # | Section | Prefix | Impact | Covers |
|---|---|---|---|---|
| 1 | Merge requests | `mr-` | HIGH | Merging on a green pipeline, stacked MRs, what an MR may contain, how GitLab is reached |

Impact is the default severity of a finding; raise it by one level when the MR targets the production branch.
