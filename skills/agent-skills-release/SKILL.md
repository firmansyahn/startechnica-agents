---
name: agent-skills-release
description: "Use when publishing a new version of this library of agent skills: choosing the bump (minor for a new skill or rule, patch for fixes and wording), setting the version in every plugin manifest through the version script, merging the pull request with the lint green, tagging the merge commit, creating the GitHub release with gh, how downstream projects sync their copy to the new tag, and staging a team skill for the Skillshare registry (skills.omp.sh) without the frontmatter field its packer rejects."
user-invocable: true
license: MIT
compatibility: Designed for Claude Code, Codex, OpenCode, oh-my-pi or similar harness, and for this repository.
metadata:
  author: firmansyahn
  version: "0.2.1"
---

# Releasing the skills

**Principle:** This repository is the original: a release is versioned in every manifest, tagged and published from here, and projects only ever sync a tagged copy.

This repository is the original of the skills: projects keep a copy synced from a release and never edit it. A release is a version in every plugin manifest, a tag on the merge commit, and a GitHub release; downstream projects then sync their copy to the tag.

Before releasing, the change must already be merged with the lint green: see [agent-skills-authoring](../agent-skills-authoring/SKILL.md) for the skills lint and what it checks.

## 1. Choose the bump

| Change in the pull request | Bump |
|---|---|
| A new skill, a new rule, a new section | minor |
| Fixes, wording, examples, references | patch |
| A skill removed, a rule ID retired, a manifest field renamed | major |

The version lives in all five plugin manifests (`.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `.codex-plugin/plugin.json`, `.cursor-plugin/plugin.json`, `gemini-extension.json`); the bump script updates every occurrence in all of them. Editing one manifest by hand fails the version drift check in CI.

## 2. Set the version in the pull request

In the pull request that carries the change, set the new version everywhere with the bump script, from the repository root:

```sh
node scripts/bump-version.mjs <major.minor.patch>
```

Then check nothing drifted:

```sh
node scripts/bump-version.mjs --check
```

Also bump the `metadata.version` in the frontmatter of each skill the pull request touches (minor for a new rule or section, patch for fixes), and give a new skill `"0.1.0"`.

## 3. Merge, tag, publish

1. Merge once the lint passes.
2. Tag the merge commit and publish the release:

```sh
gh release create v<version> --target main --title v<version> --notes "<what changed>"
```

List in the notes what changed since the previous tag: new skills, new rules (with their IDs), and fixes.

## 4. Downstream copies

In each project that keeps a copy, sync it to the new tag with that project's sync tool and commit it there, for example:

```sh
node tools/sync-agent-skills.mjs v<version>
```

A downstream copy is never edited by hand; a local difference goes into a skill here and comes back with the next release.

## 5. Skillshare (skills.omp.sh)

The omp agent installs skills from the Skillshare registry. omp's packer rejects the `user-invocable` frontmatter field the team's skills carry for Claude Code, so a skill is staged without that field first — the repository copy is never touched:

```sh
bash <this skill>/scripts/pack-for-skillshare.sh <skill-name> --keep
omp skill publish <staging-dir> --dry-run   # validate; then remove the staging directory
```

Publishing needs a Skillshare token (`omp skill token`), and the published name is `@<scope>/<skill-name>@<version>`; the version comes from the skill's `metadata.version`. Publish only team skills (`go-*`, `nextjs-*`, `git-*`, `gitlab-*`, `oauth-*`, `agent-skills-*`), never vendored ones: their licence and `UPSTREAM.md` name their source, and they are published by their own authors.

## Checklist

- [ ] The change is merged with the lint green
- [ ] The bump kind matches the change (minor for a new skill or rule, patch for fixes)
- [ ] `node scripts/bump-version.mjs --check` passes in the pull request
- [ ] Every touched skill's `metadata.version` is bumped; a new skill starts at `0.1.0`
- [ ] The merge commit is tagged `v<version>` and the GitHub release is published with notes
- [ ] Downstream projects are told to sync to the new tag
- [ ] Skillshare: only team skills, staged without `user-invocable`, dry-run validated before publishing
