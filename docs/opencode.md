# Install the OpenCode plugin

The [OpenCode plugin](../opencode-plugin/index.js) adds a `/skill-<name>` command for each skill in this repository and a `startechnica_skill` tool for listing, searching and loading instructions. It uses OpenCode's v2 plugin API (`ctx.command.transform` and `ctx.tool.transform`). It does not automatically inject skills into conversations.

The plugin has no npm dependencies. No `npm install` or build step is needed.

## 1. Clone the repository

Reuse an existing clone, or create one in a permanent location. Keep the whole repository: the plugin reads the adjacent `skills/` directory.

**Linux, macOS or Windows Git Bash:**

```bash
git clone https://github.com/firmansyahn/startechnica-agents.git "$HOME/startechnica-agents"
```

**Windows PowerShell:**

```powershell
git clone https://github.com/firmansyahn/startechnica-agents.git "$HOME\startechnica-agents"
```

## 2. Register the local plugin

For one project, edit its `opencode.json` or `opencode.jsonc`. For all projects, edit the global config at `~/.config/opencode/opencode.jsonc` (on Windows, under `$HOME\.config\opencode`).

Add the absolute path to the clone's `opencode-plugin` **directory**, not its `index.js` file. Preserve existing settings and append to any existing `plugins` array.

**Linux or macOS example** — replace `/home/your-user` with the actual home directory:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": ["/home/your-user/startechnica-agents/opencode-plugin"]
}
```

**Windows example** — replace `your-user` with the actual user directory. Backslashes must be escaped in JSON:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": ["C:\\Users\\your-user\\startechnica-agents\\opencode-plugin"]
}
```

Use an expanded absolute path; do not paste `$HOME` or `~` into these examples. Restart OpenCode after saving the config.

## 3. Use the commands and tool

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

Update the clone, then restart OpenCode to refresh the registered commands.

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

- **Plugin does not load:** confirm the OpenCode version supports the v2 plugin API and the `plugins` configuration described in the [OpenCode plugin docs](https://opencode.ai/docs/plugins/). This wrapper does not implement the v1 plugin API.
- **No skill commands appear:** check the absolute directory path, keep the repository layout intact, and restart OpenCode.
- **Skill files cannot be read:** confirm both `opencode-plugin/` and `skills/` are present beside one another in the clone. Copying only the plugin directory is insufficient.
- **Native skill discovery:** registering this plugin does not install skills into OpenCode's native discovery directories. To use that interface too, follow the [native skills installation instructions](../README.md#how-to-use). The plugin's commands and tool read directly from the clone.

See the [OpenCode server plugin API](https://opencode.ai/docs/build/plugins/server/) for the command and tool registration interfaces.
