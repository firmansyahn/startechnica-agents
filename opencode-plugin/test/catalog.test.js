import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { loadSkillCatalog, searchSkills } from "../catalog.js";

test("loads the repository skill catalog", async () => {
  const skillsDirectory = fileURLToPath(new URL("../../skills/", import.meta.url));
  const skills = await loadSkillCatalog(skillsDirectory);

  assert.ok(skills.length > 0);
  assert.equal(new Set(skills.map(({ id }) => id)).size, skills.length);
});

test("loads skills in directory order with their frontmatter descriptions", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "startechnica-skills-"));
  try {
    await mkdir(path.join(root, "git-how-to"));
    await mkdir(path.join(root, "go-testing"));
    await writeFile(
      path.join(root, "git-how-to", "SKILL.md"),
      "---\nname: git-how-to\ndescription: 'Route git tasks'\n---\n# Git\n",
    );
    await writeFile(
      path.join(root, "go-testing", "SKILL.md"),
      '---\nname: go-testing\ndescription: "Write Go tests"\n---\n# Tests\n',
    );

    const skills = await loadSkillCatalog(root);

    assert.deepEqual(skills.map(({ id }) => id), ["git-how-to", "go-testing"]);
    assert.equal(skills[0].description, "Route git tasks");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("searches skill names, descriptions, and instructions case-insensitively", () => {
  const skills = [
    { id: "go-testing", description: "Write tests", content: "Use PostgreSQL for database tests." },
    { id: "git-how-to", description: "Route git tasks", content: "Use the commit workflow." },
  ];

  assert.deepEqual(searchSkills(skills, "POSTGRESQL database").map(({ id }) => id), ["go-testing"]);
  assert.deepEqual(searchSkills(skills, "   "), []);
});
