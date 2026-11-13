#!/usr/bin/env node
// Claude Code PreToolUse hook for the Bash tool: refuses `glab mr merge` unless the command names
// the MR and that MR's head pipeline is `success`.
//
// Why: `glab mr merge` defaults to auto-merge, which waits only when GitLab sees a pipeline
// running for the MR. Otherwise it merges at once, and it has merged MRs whose pipeline was still
// running (and then failed).
//
// An MR whose diff touches no file any job watches (docs, tools, agent files) gets no pipeline at
// all; merging one needs `MERGE_WITHOUT_PIPELINE=1 glab mr merge <iid> --yes`, written on purpose.
// A running, failed or canceled pipeline never passes.
//
// Register in .claude/settings.json:
//   "hooks": { "PreToolUse": [ { "matcher": "Bash", "hooks": [ { "type": "command",
//     "command": "node \"$CLAUDE_PROJECT_DIR/tools/agent-hooks/guard-mr-merge.mjs\"", "timeout": 40 } ] } ] }
//
// Exit 2 refuses the call and shows stderr to the agent; exit 0 lets it run.
import { execFileSync } from "node:child_process";
import fs from "node:fs";

const input = JSON.parse(fs.readFileSync(0, "utf8") || "{}");
const command = String(input.tool_input?.command ?? "");
const cwd = input.cwd || process.cwd();

// Git Bash spells C:\x as /c/x; Node on Windows does not.
const native = (p) => (process.platform === "win32" ? p.replace(/^\/([a-zA-Z])(?=\/|$)/, "$1:") : p);

function refuse(message) {
  process.stderr.write(`${message}\n`);
  process.exit(2);
}

// A command counts only where the shell would run it: at the start, or after ; & | ( or a newline,
// after any NAME=value assignments. The same words inside a quoted string (a commit message) are text.
const AT = String.raw`(?:^|[;&|(\n])\s*(?:[A-Za-z_]\w*=\S*\s+)*`;

const merge = command.match(new RegExp(`${AT}glab\\s+mr\\s+merge\\b([^;&|\\n]*)`));
if (!merge) process.exit(0);

const args = merge[1];
// Reading the help merges nothing.
if (/(?:^|\s)(?:-h|--help)(?=\s|$)/.test(args)) process.exit(0);

const iid = args.match(/(?:^|\s)!?(\d+)(?=\s|$)/)?.[1];
if (!iid) refuse("Refused: name the merge request (`glab mr merge <iid>`), so its pipeline can be checked first.");

let mr;
try {
  const out = execFileSync("glab", ["api", `projects/:id/merge_requests/${iid}`], {
    cwd: native(cwd),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 30_000,
    windowsHide: true,
  });
  mr = JSON.parse(out);
} catch (err) {
  refuse(`Refused: could not read MR !${iid} (${String(err.message).split("\n")[0]}). Check its pipeline by hand before merging.`);
}

const pipeline = mr.head_pipeline;
const status = pipeline?.status ?? "none";
const noPipelineOk = /(?:^|[;&|(\n])\s*MERGE_WITHOUT_PIPELINE=1\s+glab\s+mr\s+merge\b/.test(command);

if (status === "none") {
  if (noPipelineOk) process.exit(0);
  refuse(
    `Refused: MR !${iid} has no pipeline. If one is still being created, wait. If CI starts none for this change ` +
      `(only docs, tools or agent files), tell the user and run: MERGE_WITHOUT_PIPELINE=1 glab mr merge ${iid} --yes`,
  );
}
if (status !== "success") {
  refuse(
    `Refused: MR !${iid}'s head pipeline is "${status}", not "success". glab merges at once even while a pipeline runs; ` +
      `wait for it and merge when it passes. A runner system failure is infrastructure, not the change: retry the job.`,
  );
}
if (pipeline.sha && mr.sha && pipeline.sha !== mr.sha) {
  refuse(`Refused: MR !${iid}'s passing pipeline is for ${pipeline.sha.slice(0, 8)}, but the MR is at ${mr.sha.slice(0, 8)}. Wait for the new pipeline.`);
}

process.exit(0);
