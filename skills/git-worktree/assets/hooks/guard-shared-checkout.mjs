#!/usr/bin/env node
// Claude Code PreToolUse hook for the Bash tool: refuses a branch switch (`git switch`,
// `git checkout <branch>`, `git checkout -b`, `glab mr checkout`, `gh pr checkout`) in the main
// checkout while it has uncommitted or untracked files.
//
// Why: several people or agent sessions may work in the main checkout. Switching its branch moves
// HEAD under them: their edits and next commit land on your branch, or their work is carried to the
// wrong one (wt-no-switch-in-shared-checkout). Make a worktree instead. The hook can't tell whose
// changes they are, so it refuses on your own too: commit them, or switch on purpose with
// `SWITCH_SHARED=1 git switch ...`. Linked worktrees (.worktrees/<topic>) are one session's, and
// restoring files (`git checkout -- <path>`, `git checkout <ref> -- <path>`) moves no HEAD: both pass.
// Works on Linux, macOS and Windows (Git Bash paths).
//
// Register in .claude/settings.json:
//   "hooks": { "PreToolUse": [ { "matcher": "Bash", "hooks": [ { "type": "command",
//     "command": "node \"$CLAUDE_PROJECT_DIR/tools/agent-hooks/guard-shared-checkout.mjs\"", "timeout": 20 } ] } ] }
//
// Exit 2 refuses the call and shows stderr to the agent; exit 0 lets it run.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const input = JSON.parse(fs.readFileSync(0, "utf8") || "{}");
const command = String(input.tool_input?.command ?? "");
const cwd = input.cwd || process.cwd();

// Git Bash spells C:\x as /c/x; Node on Windows does not.
const native = (p) => (process.platform === "win32" ? p.replace(/^\/([a-zA-Z])(?=\/|$)/, "$1:") : p);
const unquote = (s) => s.replace(/^(['"])(.*)\1$/, "$2");

// A command counts only where the shell would run it: at the start, or after ; & | ( or a newline,
// after any NAME=value assignments. The same words inside a quoted string (a commit message) are text.
const AT = String.raw`(?:^|[;&|(\n])\s*((?:[A-Za-z_]\w*=\S*\s+)*)`;
const SWITCH = new RegExp(
  `${AT}(?:git\\b((?:\\s+-C\\s+\\S+)?)\\s+(switch|checkout)\\b([^;&|\\n]*)|(glab\\s+mr|gh\\s+pr)\\s+checkout\\b([^;&|\\n]*))`,
  "g",
);

function git(dir, args) {
  try {
    return execFileSync("git", ["-C", native(dir), ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 10_000,
      windowsHide: true,
    }).trim();
  } catch {
    return null;
  }
}

// Does `git checkout <args>` move HEAD? Not when it restores paths.
function checkoutSwitches(dir, args) {
  if (args.includes("--") || args.some((a) => a === "-p" || a === "--patch" || a.startsWith("--pathspec-from-file"))) return false;
  if (args.some((a) => /^-[bB]$|^--orphan$|^--detach$/.test(a))) return true;
  const names = args.filter((a) => !a.startsWith("-"));
  if (names.length === 0) return args.includes("-"); // `git checkout -`: the previous branch
  if (names.length > 1) return false; // `git checkout a b`: paths
  // One name: git takes it as a commit if one resolves, else as a path.
  return git(dir, ["rev-parse", "--verify", "-q", `${names[0]}^{commit}`]) !== null;
}

for (const m of command.matchAll(SWITCH)) {
  const [, assigns, dashC = "", verb, rest = "", forge, forgeRest] = m;
  if (/(?:^|\s)SWITCH_SHARED=1(?:\s|$)/.test(assigns)) continue;
  const argText = forge ? forgeRest : rest;
  const args = argText.trim().split(/\s+/).filter(Boolean).map(unquote);
  if (args.some((a) => a === "-h" || a === "--help")) continue;

  // Where it runs: git -C, else the last cd before it, else the hook's cwd.
  let dir = native(cwd);
  const before = command.slice(0, m.index);
  const cds = [...before.matchAll(/\bcd\s+("[^"]+"|'[^']+'|[^\s;&|]+)/g)];
  if (cds.length) dir = path.resolve(dir, native(unquote(cds.at(-1)[1])));
  const c = dashC.match(/-C\s+(\S+)/)?.[1];
  if (c) dir = path.resolve(dir, native(unquote(c)));

  if (!forge && verb === "checkout" && !checkoutSwitches(dir, args)) continue;

  const gitDir = git(dir, ["rev-parse", "--path-format=absolute", "--git-dir"]);
  const common = git(dir, ["rev-parse", "--path-format=absolute", "--git-common-dir"]);
  if (!gitDir || !common || path.resolve(gitDir) !== path.resolve(common)) continue; // not a repo, or a linked worktree

  const status = git(dir, ["status", "--porcelain"]);
  if (!status) continue; // clean, or git failed

  const files = status.split("\n");
  const shown = files.slice(0, 8).map((l) => `  ${l}`).join("\n");
  process.stderr.write(
    `Refused: this is the main checkout and it has ${files.length} uncommitted or untracked file${files.length > 1 ? "s" : ""}:\n${shown}${files.length > 8 ? "\n  ..." : ""}\n` +
      `Another session may be working here; switching would move its HEAD (wt-no-switch-in-shared-checkout). Work in a worktree instead:\n` +
      `  git worktree add -b <type>/<topic> .worktrees/<topic> <base-ref>\n` +
      `If these changes are all yours and you mean to switch this checkout, commit them, or run it again as SWITCH_SHARED=1 ${m[0].trim().replace(/^[;&|(\s]+/, "")}\n`,
  );
  process.exit(2);
}

process.exit(0);
