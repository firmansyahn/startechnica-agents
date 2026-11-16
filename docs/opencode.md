# Install the OpenCode plugin

The [OpenCode plugin](../.opencode/plugins/index.js) adds a `/skill-<name>` command for each skill in this repository and a `startechnica_skill` tool for listing, searching and loading instructions. It uses the official OpenCode v2 plugin API (`@opencode/plugin`, `Plugin.define`, `ctx.command.transform` and `ctx.tool.transform`). OpenCode v1 does not support this plugin; native skill discovery remains available separately. It does not automatically inject skills into conversations.

The plugin declares the compatible `@opencode/plugin` API in its package metadata. OpenCode provides that API when loading the local plugin; no manual dependency installation or build step is needed.

## Install from Git

OpenCode installs Git plugin targets as npm packages, so the repository root must contain a `package.json`. This repository's [root package](../package.json) exports the OpenCode entrypoint and includes the skills it reads.

With OpenCode v2.3.0 or a compatible release:

```bash
opencode plugin add 'git+https://github.com/firmansyahn/startechnica-agents.git'
```

Alternatively, append the Git target to your config's `plugins` array:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": ["git+https://github.com/firmansyahn/startechnica-agents.git"]
}
```

Use a branch, tag or commit containing the root package manifest. Older revisions without it cannot be installed as Git npm packages. Remove the failing old target from every applicable config instead of adding a second entry beside it, then restart OpenCode. For a local checkout, use the directory installation below instead.

## Local installation

### 1. Clone the repository

Reuse an existing clone, or create one in a permanent location. Keep the whole repository: the plugin reads the root [skills directory](../skills/).

**Linux, macOS or Windows Git Bash:**

```bash
git clone https://github.com/firmansyahn/startechnica-agents.git "$HOME/startechnica-agents"
```

**Windows PowerShell:**

```powershell
git clone https://github.com/firmansyahn/startechnica-agents.git "$HOME\startechnica-agents"
```

### 2. Register the local plugin

For one project, edit its `opencode.json` or `opencode.jsonc`. For all projects, edit the global config at `~/.config/opencode/opencode.jsonc` (on Windows, under `$HOME\.config\opencode`).

Add the absolute path to the clone's **root directory**, which contains [package.json](../package.json), not its entrypoint file. Preserve existing settings and append to any existing `plugins` array. The root package exports [.opencode/plugins/index.js](../.opencode/plugins/index.js); there is no separate nested package to install.

**Linux or macOS example** — replace `/home/your-user` with the actual home directory:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": ["/home/your-user/startechnica-agents"]
}
```

**Windows example** — replace `your-user` with the actual user directory. Backslashes must be escaped in JSON:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": ["C:\\Users\\your-user\\startechnica-agents"]
}
```

Use an expanded absolute path; do not paste `$HOME` or `~` into these examples. Restart OpenCode after saving the config.

## Use the commands and tool

Run a skill command with a request in OpenCode:

```text
/skill-go-testing Add table-driven tests for the order handler.
/skill-nextjs-how-to Plan the account settings page.
```

Command names follow the skill directory names under [skills/](../skills/). The plugin sends the selected skill's instructions and the request to the current session.

The agent can also call `startechnica_skill` with these inputs:

| Action | Example input | Result |
|---|---|---|
| List | `{"action":"list"}` | Skill names and descriptions |
| Search | `{"action":"search","query":"PostgreSQL database"}` | Skills containing every search term, ignoring case |
| Load | `{"action":"load","skill":"go-testing"}` | The selected skill's full `SKILL.md` content |

For example, ask OpenCode to use `startechnica_skill` to find database testing guidance. The JSON above shows tool arguments, not terminal commands.

## Update or remove

For a Git package installation, run `opencode plugin update` and restart OpenCode. Pinned commit targets remain pinned; change the target explicitly to upgrade them. Remove a Git installation with `opencode plugin remove 'git+https://github.com/firmansyahn/startechnica-agents.git'` (use the exact configured target).

For a local installation, update the clone, then restart OpenCode to refresh the registered commands.

**Linux, macOS or Windows Git Bash:**

```bash
git -C "$HOME/startechnica-agents" pull --ff-only
```

**Windows PowerShell:**

```powershell
git -C "$HOME\startechnica-agents" pull --ff-only
```

To remove the plugin, remove its directory from the config's `plugins` array and restart OpenCode. This does not delete the clone or any separately installed skills.

## Troubleshooting

- **`NpmInstallFailedError` / `Could not read package.json` for a Git target:** the selected repository revision has no root npm manifest. A `.claude-plugin/plugin.json` is not an npm manifest. Use a revision containing the [root package](../package.json), or replace the Git target with the absolute local clone directory. The earlier API-only fix did not address repository-root package installation.
- **Plugin does not load:** use OpenCode v2.3.0 or a release compatible with `@opencode/plugin` 2.3.0, and confirm the `plugins` configuration described in the [OpenCode plugin docs](https://opencode.ai/docs/plugins/). This wrapper does not implement the v1 plugin API.
- **No skill commands appear:** check the absolute directory path, keep the repository layout intact, and restart OpenCode.
- **Skill files cannot be read:** keep the [root manifest](../package.json), [entrypoint](../.opencode/plugins/index.js), [catalog helper](../.opencode/lib/catalog.js) and [skills](../skills/) in their original relative locations. Copying only the plugin directory is insufficient.
- **Native skill discovery:** registering this plugin does not install skills into OpenCode's native discovery directories. To use that interface too, follow the [native skills installation instructions](../README.md#how-to-use). The plugin's commands and tool read directly from the clone.

See the [OpenCode server plugin API](https://opencode.ai/docs/build/plugins/server/) for the command and tool registration interfaces.
