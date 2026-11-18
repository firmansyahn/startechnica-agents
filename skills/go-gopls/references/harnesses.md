# gopls in each harness

Team-written (not upstream). How the three ways to reach gopls (see [SKILL.md](../SKILL.md#three-ways-to-reach-gopls)) are wired in Claude Code, OpenCode and oh-my-pi. Wiring is the user's choice ([team decision 2](../SKILL.md#team-decisions)): show the snippet and ask before writing it. The settings below are from each harness's documentation as of 2026-11; if a harness rejects the shape, check its current docs.

| | gopls MCP server (`gopls mcp`) | Built-in language-server integration | CLI |
|---|---|---|---|
| Claude Code | `claude mcp add gopls -- gopls mcp` | the native `LSP` tool and its plugin ([mcp.md](mcp.md#the-native-lsp-tool)) | yes |
| OpenCode | a local entry under `mcp.servers` | built-in `gopls` server, off until `"lsp": true` | yes |
| oh-my-pi | a stdio entry in `.omp/mcp.json` | built-in `gopls` server, on by default | yes |

In OpenCode and oh-my-pi the built-in integration is the one that **pushes diagnostics after an edit**, like Claude Code's `LSP` tool; the MCP server adds the by-name tools (`go_search`, `go_file_context`, `go_package_api`, `go_vulncheck`), which neither harness's built-in integration documents. Wire both when the user agrees: the built-in one for diagnostics and navigation, the MCP server for discovery. The preference order in SKILL.md still holds for a query you can make through either.

## OpenCode

- **Built-in server.** `gopls` is one of the built-in servers for `.go` files. OpenCode does not install it: `go` must be on `PATH`, and `gopls` must be installed ([SKILL.md](../SKILL.md), "Dependencies"). LSP is disabled by default; `"lsp": true` turns on every built-in server. The agent gets the server's diagnostics.
- **Customise or disable it** under the `lsp` key (`disabled`, `command`, `extensions`, `env`, `initialization`):

  ```jsonc
  {
    "$schema": "https://opencode.ai/config.json",
    "lsp": {
      "gopls": { "disabled": true }
    }
  }
  ```

- **MCP server.** In `opencode.json` (or `opencode.jsonc`), a local server is `type: "local"` with `command` as one array, the executable first:

  ```jsonc
  {
    "$schema": "https://opencode.ai/config.json",
    "mcp": {
      "servers": {
        "gopls": {
          "type": "local",
          "command": ["gopls", "mcp"]
        }
      }
    }
  }
  ```

  There is no `enabled` flag; `"disabled": true` keeps the entry without connecting it, and `environment` (not `env`) adds variables.
- No agent-invoked language-server tool (definition, references) is documented, so navigation goes through the MCP tools or the CLI.

## oh-my-pi

- **Built-in server.** `gopls` is a built-in server and needs no configuration file when it is discoverable: `go.mod` must sit directly in the folder `omp` was started from (parents are not searched), and `gopls` must be on `PATH` or in a project-local bin folder (the project-local one wins). Restart `omp` from the module root after installing it.
- **What the agent can do** with it: find definitions and implementations, inspect types, list references, report diagnostics, apply server fixes such as a missing import, and semantic rename (with an optional preview).
- **Diagnostics after edits** are on by default (`lsp.diagnosticsOnWrite`); `lsp.diagnosticsOnEdit` (off by default) also returns them after incremental edits; `lsp.enabled`, `lsp.lazy` and `lsp.formatOnWrite` are the other switches. `omp --no-lsp` turns it all off for one session.
- **gopls settings** are overridden in the project's `.omp/lsp.json`, merged by server name, so only the keys named change:

  ```json
  {
    "servers": {
      "gopls": {
        "settings": { "gopls": { "staticcheck": true } }
      }
    }
  }
  ```

  The gopls settings themselves are in [settings.md](settings.md).
- **MCP server.** The project file is `.omp/mcp.json` (a user-level `mcp.json` also works); `type` defaults to stdio:

  ```json
  {
    "mcpServers": {
      "gopls": {
        "command": "gopls",
        "args": ["mcp"]
      }
    }
  }
  ```

  After editing it, run `/mcp reload` in the session; `/mcp add` is the guided alternative. Servers from other files (a root `.mcp.json`, another tool's config) are discovered but may not appear in `/mcp list`, so put this one in `.omp/mcp.json`.
