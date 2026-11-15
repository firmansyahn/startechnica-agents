#!/usr/bin/env node
// Claude Code PreToolUse hook for the Bash tool: refuses `git worktree remove <path>` while a
// dependency folder inside that worktree (node_modules or a Go vendor/, up to three levels down) is
// a link: a symlink, or on Windows a junction, usually to another checkout's copy
// (wt-unlink-before-remove). Then refuses it while a process runs from the worktree
// (wt-stop-processes-before-remove).
//
// Why: a worktree must have its own dependencies. On Windows, removing the worktree follows a
// junction and deletes what it points at; it has emptied a main checkout's node_modules more than
// once. On Linux and macOS git removes only the link, but the link still breaks the rule, and the
// next `rm -rf <link>/` empties the target. Remove the link alone first, check it is gone, then
// remove the worktree in a separate command. Works on Linux, macOS and Windows (Git Bash paths).
//
// Processes: a dev server, watcher or leftover test database running from the worktree makes the
// removal fail halfway on Windows, and keeps running from a deleted folder on Linux and macOS. The
// hook looks for the worktree's path in every process's command line (all platforms), and for
// processes whose working directory is inside it (Linux: /proc; macOS: lsof, when installed). It
// misses a process started with a relative path that only cd'd in, on Windows. When the processes
// it names aren't running from the worktree, `REMOVE_WITH_PROCESSES=1 git worktree remove ...`
// lets it through.
//
// Register in .claude/settings.json:
//   "hooks": { "PreToolUse": [ { "matcher": "Bash", "hooks": [ { "type": "command",
//     "command": "node \"$CLAUDE_PROJECT_DIR/tools/agent-hooks/guard-worktree-remove.mjs\"", "timeout": 20 } ] } ] }
//
// Exit 2 refuses the call and shows stderr to the agent; exit 0 lets it run.
import { execFileSync } from "node:child_process";
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

const run = (file, args) => {
  try {
    return execFileSync(file, args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 15_000, maxBuffer: 64 << 20, windowsHide: true });
  } catch {
    return "";
  }
};

// Every process (other than this hook and its parent) whose command line names dir, or whose working
// directory is inside it, as "pid name-or-args".
function processesIn(dir, typed) {
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const forms = new Set([dir, dir.replace(/\\/g, "/")]);
  if (windows) forms.add(dir.replace(/\\/g, "/").replace(/^([A-Za-z]):/, (_, d) => `/${d.toLowerCase()}`));
  // The path as typed, when it says more than a bare name: `next dev` started as .worktrees/x/web/...
  if (/[\\/]/.test(typed)) forms.add(typed.replace(/[\\/]+$/, ""));
  const named = new RegExp(`(?:^|[\\s"'=])(?:${[...forms].map(esc).join("|")})(?=[\\\\/\\s"']|$)`, windows ? "i" : "");
  const inside = (p) => p === dir || p.startsWith(dir + path.sep);
  const skip = new Set([process.pid, process.ppid]);
  const found = new Map();

  if (windows) {
    const ps = 'Get-CimInstance Win32_Process | ForEach-Object { "$($_.ProcessId)`t$($_.CommandLine)" }';
    for (const line of run("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", ps]).split(/\r?\n/)) {
      const [pid, cmd = ""] = line.split("\t");
      if (pid && !skip.has(Number(pid)) && named.test(cmd)) found.set(pid, cmd);
    }
  } else {
    for (const line of run("ps", ["-axo", "pid=,args="]).split("\n")) {
      const m = line.match(/^\s*(\d+)\s+(.*)$/);
      if (m && !skip.has(Number(m[1])) && named.test(m[2])) found.set(m[1], m[2]);
    }
    if (process.platform === "linux") {
      for (const pid of fs.readdirSync("/proc").filter((p) => /^\d+$/.test(p) && !skip.has(Number(p)))) {
        try {
          if (inside(fs.readlinkSync(`/proc/${pid}/cwd`)) && !found.has(pid))
            found.set(pid, fs.readFileSync(`/proc/${pid}/cmdline`, "utf8").replace(/\0/g, " ").trim() || "(cwd inside)");
        } catch {}
      }
    } else {
      let pid = "";
      for (const line of run("lsof", ["-a", "-d", "cwd", "-Fpn"]).split("\n")) {
        if (line.startsWith("p")) pid = line.slice(1);
        else if (line.startsWith("n") && pid && !skip.has(Number(pid)) && inside(line.slice(1)) && !found.has(pid)) found.set(pid, "(cwd inside)");
      }
    }
  }
  return [...found].map(([pid, cmd]) => `${pid} ${cmd.length > 120 ? cmd.slice(0, 117) + "..." : cmd}`);
}

const howToStop = windows
  ? "taskkill //PID <pid> //T //F (Git Bash; taskkill /PID <pid> /T /F in cmd or PowerShell)"
  : "kill <pid> (kill -9 <pid> if it ignores it)";

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
    const override = /(?:^|\s)REMOVE_WITH_PROCESSES=1\s/.test(m[0]);
    const procs = override ? [] : processesIn(dir, target);
    if (procs.length) {
      process.stderr.write(
        `Refused: ${procs.length} process${procs.length > 1 ? "es are" : " is"} running from ${dir}:\n${procs.map((p) => `  ${p}`).join("\n")}\n` +
          `${windows ? "The removal would fail halfway and leave a half-deleted folder" : "They would keep running from a deleted folder, holding ports and test databases"} (wt-stop-processes-before-remove).\n` +
          `Stop your own (${howToStop}); leave other sessions' alone unless the user says so. Then remove the worktree. ` +
          `If these aren't running from it, run the removal as REMOVE_WITH_PROCESSES=1 git worktree remove ...\n`,
      );
      process.exit(2);
    }
    break;
  }
}

process.exit(0);
