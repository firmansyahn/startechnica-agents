#!/usr/bin/env node
// Claude Code PreToolUse hook for the Bash tool: refuses a command that carries a GitLab token
// (a PRIVATE-TOKEN header, a glpat- token, a token in a clone URL) or reaches the GitLab REST API
// with curl or wget instead of glab (mr-glab-for-gitlab).
//
// Why: a token in a command lands in shell history, logs and the session transcript, and a token in
// a clone URL is written to .git/config. `glab api <endpoint>` reaches any endpoint with the
// credentials `glab auth login` stored; `glab repo clone` clones. The token patterns count anywhere
// in the command (a token inside a commit message leaks too); curl and wget count only where the
// shell would run them, so a message that mentions them is text. scripts/scan.sh covers tracked files.
//
// Register in .claude/settings.json:
//   "hooks": { "PreToolUse": [ { "matcher": "Bash", "hooks": [ { "type": "command",
//     "command": "node \"$CLAUDE_PROJECT_DIR/tools/agent-hooks/guard-glab-token.mjs\"", "timeout": 10 } ] } ] }
//
// Exit 2 refuses the call and shows stderr to the agent; exit 0 lets it run.
import fs from "node:fs";

const input = JSON.parse(fs.readFileSync(0, "utf8") || "{}");
const command = String(input.tool_input?.command ?? "");

// A command counts only where the shell would run it: at the start, or after ; & | ( or a newline,
// after any NAME=value assignments.
const AT = String.raw`(?:^|[;&|(\n])\s*(?:[A-Za-z_]\w*=\S*\s+)*`;

const checks = [
  [/PRIVATE-TOKEN\s*:/i, "a PRIVATE-TOKEN header"],
  [/\bglpat-[A-Za-z0-9_.-]{10,}/, "a GitLab personal access token (glpat-...)"],
  // oauth2:<token>@, gitlab-ci-token:<token>@, or any user:<secret>@ in a URL
  [/\bhttps?:\/\/[^\s/@:]+:[^@\s/]+@/, "a token in a clone or API URL"],
  [new RegExp(`${AT}(?:curl|wget)\\b[^;&|\\n]*\\/api\\/v4\\/`), "the GitLab REST API through curl or wget"],
];

const hits = checks.filter(([re]) => re.test(command)).map(([, what]) => what);
if (hits.length) {
  process.stderr.write(
    `Refused: the command carries ${hits.join(" and ")} (mr-glab-for-gitlab). Reach GitLab through glab and its stored credentials: ` +
      `glab api <endpoint> (projects/:id/... resolves to this repo), glab repo clone <group>/<project>, glab mr / glab ci for the rest. ` +
      `Don't ask the user to paste a token; if glab isn't logged in, ask them to run glab auth login. If a real token was in the command, tell the user so it can be revoked.\n`,
  );
  process.exit(2);
}
process.exit(0);
