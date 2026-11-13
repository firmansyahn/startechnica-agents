---
title: Keep one person's files out of the project ignore file
impact: LOW
tags: excludes, notes
check: review
---

## Keep one person's files out of the project ignore file

**Impact: LOW** (the project file collects everyone's notes and private tools, and still misses the next person's)

The repo's `.gitignore` lists what the repo's tools produce, plus the common OS and editor files (`.DS_Store`, `Thumbs.db`, `*.swp`, `.vscode/`, `.idea/`) so every clone stays clean. Files only you make go elsewhere: in this clone's `.git/info/exclude` (same syntax, never committed), or for every repo in your global excludes file (`~/.config/git/ignore`, or `core.excludesFile`).

**Incorrect:**

```gitignore
# .gitignore
my-notes.md
scratch/
.my-tool-cache/
```

**Correct:**

```gitignore
# .git/info/exclude
my-notes.md
scratch/

# ~/.config/git/ignore
.my-tool-cache/
```

**How to check:** in review, each pattern added to the project file names something the repo's tools produce or a common OS or editor file, not one person's notes or tools.
