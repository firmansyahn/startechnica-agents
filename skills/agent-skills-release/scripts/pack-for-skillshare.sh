#!/usr/bin/env bash
# pack-for-skillshare.sh: stage a team skill for the Skillshare registry (skills.omp.sh).
# omp's packer rejects the "user-invocable" frontmatter field, which the team's skills carry
# for Claude Code; this script copies the skill to a staging directory without that field,
# leaving the repository copy untouched, and prints the omp command to run.
#
# Usage: bash <this skill>/scripts/pack-for-skillshare.sh <skill-name> [--keep]
#   <skill-name>  folder under skills/ (e.g. git-commit)
#   --keep        keep the staging directory after the dry run (default: removed)
#
# The staging copy goes to a temporary directory; publish it with:
#   omp skill publish <staging-dir> --dry-run     # validate only
#   omp skill publish <staging-dir>               # actually publish (needs a Skillshare token)
# POSIX tools only (Linux, macOS, Git Bash on Windows). Read-only towards the repository.

set -u
KEEP=0
NAME=""
for a in "$@"; do case "$a" in --keep) KEEP=1 ;; *) NAME="$a" ;; esac; done
[ -n "$NAME" ] || { echo "usage: bash $0 <skill-name> [--keep]" >&2; exit 2; }

# Locate the skills root: this script lives in <skills-root>/agent-skills-release/scripts/
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SRC="$ROOT/$NAME"
[ -f "$SRC/SKILL.md" ] || { echo "no skills/$NAME/SKILL.md" >&2; exit 2; }

STAGE="$(mktemp -d)"
trap '[ "$KEEP" = 1 ] || rm -rf "$STAGE"' EXIT
cp -R "$SRC/." "$STAGE/"

# Strip the field omp's packer rejects; keep everything else byte for byte.
sed -i '/^user-invocable:/d' "$STAGE/SKILL.md"
grep -q '^user-invocable:' "$STAGE/SKILL.md" && { echo "failed to strip user-invocable" >&2; exit 1; }

echo "staged: $STAGE"
echo "validate:  omp skill publish $STAGE --dry-run"
echo "publish:   omp skill publish $STAGE"
[ "$KEEP" = 1 ] && echo "(--keep: staging directory is kept; remove it yourself afterwards)"
exit 0
