import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

function frontmatterField(frontmatter, field, filePath) {
  const line = frontmatter.split(/\r?\n/).find((entry) => entry.startsWith(`${field}:`));
  if (!line) {
    throw new Error(`Missing ${field} in skill frontmatter: ${filePath}`);
  }

  const value = line.slice(field.length + 1).trim();
  if (value.startsWith('"') && value.endsWith('"')) {
    return JSON.parse(value);
  }
  if (value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1).replaceAll("''", "'");
  }
  return value;
}

export async function loadSkillCatalog(skillsDirectory) {
  const entries = await readdir(skillsDirectory, { withFileTypes: true });
  const skills = [];

  for (const entry of entries.filter((item) => item.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.name)) {
      throw new Error(`Invalid skill directory name: ${entry.name}`);
    }

    const filePath = path.join(skillsDirectory, entry.name, "SKILL.md");
    const content = await readFile(filePath, "utf8");
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
    if (!match) {
      throw new Error(`Missing YAML frontmatter in skill: ${filePath}`);
    }

    const name = frontmatterField(match[1], "name", filePath);
    if (name !== entry.name) {
      throw new Error(`Skill name "${name}" does not match directory "${entry.name}": ${filePath}`);
    }

    skills.push({
      id: entry.name,
      description: frontmatterField(match[1], "description", filePath),
      content,
    });
  }

  return skills;
}

export function searchSkills(skills, query) {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];

  return skills.filter((skill) => {
    const searchable = `${skill.id}\n${skill.description}\n${skill.content}`.toLowerCase();
    return terms.every((term) => searchable.includes(term));
  });
}
