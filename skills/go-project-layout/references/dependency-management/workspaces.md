# Go Workspaces (go.work)

> **Team:** a `go.work` or `replace` never points at another checkout (a sibling repo or another worktree); [go-project-layout](../../SKILL.md) decision 3 wins over this file.

## go.work vs go.mod

| Scenario                                       | Use       |
| ---------------------------------------------- | --------- |
| Single module project                          | `go.mod`  |
| Developing multiple related local modules      | `go.work` |
| Monorepo with separate Go modules              | `go.work` |
| Testing local changes across module boundaries | `go.work` |
| Published library consumed by others           | `go.mod`  |

## Workspace Commands

```bash
go work init                    # Initialize workspace
go work use ./services/auth     # Add module to workspace
go work use -rm ./old-module    # Remove module from workspace
go work sync                    # Sync workspace with module changes
```

## Key Points

- Workspaces eliminate the need for `replace` directives during local development — the workspace automatically resolves local modules
- **Do not commit `go.work.sum`** to version control (add to `.gitignore`)
- `go.work` is for development only — it does not affect how consumers of your published modules resolve dependencies
- For workspace directory structure examples, see the [go-project-layout](../../SKILL.md) skill
