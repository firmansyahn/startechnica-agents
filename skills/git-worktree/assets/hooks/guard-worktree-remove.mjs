#!/usr/bin/env node
// Claude Code PreToolUse hook for the Bash tool: refuses `git worktree remove <path>` while a
// dependency folder inside that worktree (node_modules or a Go vendor/, up to three levels down) is
// a link: a symlink, or on Windows a junction, usually to another checkout's copy.
//
// Why: a worktree must have its own dependencies. On Windows, removing the worktree follows a
// junction and deletes what it points at; it has emptied a main checkout's node_modules more than
// once. On Linux and macOS git removes only the link, but the link still breaks the rule, and the
// next `rm -rf <link>/` empties the target. Remove the link alone first, check it is gone, then
// remove the worktree in a separate command. Works on Linux, macOS and Windows (Git Bash paths).
//
// Register in .claude/settings.json:
//   "hooks": { "PreToolUse": [ { "matcher": "Bash", "hooks": [ { "type": "command",
//     "command": "node \"$CLAUDE_PROJECT_DIR/tools/agent-hooks/guard-worktree-remove.mjs\"", "timeout": 20 } ] } ] }
//
// Exit 2 refuses the call and shows stderr to the agent; exit 0 lets it run.
import fs from "node:fs";
import path from "node:path";

const input = JSON.parse(fs.readFileSync(0, "utf8") || "{}");
const command = String(input.tool_input?.command ?? "");
const cwd = input.cwd || process.cwd();
const windows = process.platform === "win32";

// Git Bash spells C:\x as /c/x; Node on Windows does not.
const native = (p) => (windows ? p.replace(/^\/([a-zA-Z])(?=\/|$)/, "$1:") : p);
const unquote = (s) => s.replace(/^(['"])(.*)\1$/, "$2");

// A command counts only where the shell would run it: at the start, or after ; & | ( or a newline,
// after any NAME=value assignments.
const AT = String.raw`(?:^|[;&|(\n])\s*(?:[A-Za-z_]\w*=\S*\s+)*`;

const DEPENDENCY_DIRS = new Set(["node_modules", "vendor"]);

// Every dependency folder under dir that is a link, up to `depth` levels down, without descending
// into dependency folders or .git.
function dependencyLinks(dir, depth = 3) {
  const found = [];
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return found;
  }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (DEPENDENCY_DIRS.has(e.name)) {
      try {
        if (fs.lstatSync(p).isSymbolicLink()) found.push(p);
      } catch {}
      continue;
    }
    if (e.name === ".git" || !e.isDirectory() || depth === 0) continue;
    found.push(...dependencyLinks(p, depth - 1));
  }
  return found;
}

const howToUnlink = windows
  ? `MSYS2_ARG_CONV_EXCL='*' cmd /c "rmdir <path from cygpath -w>" (Git Bash), or node -e "require('fs').unlinkSync('<path>')"`
  : `rm <path> (no trailing slash, no -r), or node -e "require('fs').unlinkSync('<path>')"`;

for (const m of command.matchAll(new RegExp(`${AT}git\\b((?:\\s+-C\\s+\\S+)?)\\s+worktree\\s+remove\\b([^;&|\\n]*)`, "g"))) {
  const dashC = m[1].match(/-C\s+(\S+)/)?.[1];
  const target = m[2].trim().split(/\s+/).filter((a) => a && !a.startsWith("-")).map(unquote)[0];
  if (!target) continue;
  // The command may cd first; try every directory it names as a base, and the hook's cwd.
  const bases = [cwd, ...[...command.matchAll(/\bcd\s+("[^"]+"|'[^']+'|[^\s;&|]+)/g)].map((c) => unquote(c[1]))];
  if (dashC) bases.unshift(unquote(dashC));
  for (const base of bases) {
    const dir = path.resolve(native(cwd), native(base), native(target));
    if (!fs.existsSync(dir)) continue;
    const links = dependencyLinks(dir);
    if (links.length) {
      process.stderr.write(
        `Refused: ${links.join(", ")} ${links.length > 1 ? "are links" : "is a link"} to dependencies outside this worktree. ` +
          `A worktree has its own dependencies; ${windows ? "removing the worktree would delete what a junction points at" : "the next rm -rf <link>/ would empty the target"}.\n` +
          `Remove each link alone first (${howToUnlink}), check it is gone, then remove the worktree in a separate command.\n`,
      );
      process.exit(2);
    }
    break;
  }
}

process.exit(0);
