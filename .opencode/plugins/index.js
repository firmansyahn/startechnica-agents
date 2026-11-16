import { Plugin } from "@opencode/plugin";
import { fileURLToPath } from "node:url";
import { loadSkillCatalog, searchSkills } from "../lib/catalog.js";

const skillsDirectory = fileURLToPath(new URL("../../skills/", import.meta.url));

function formatSkillList(skills) {
  return skills.map((skill) => `- ${skill.id}: ${skill.description}`).join("\n");
}

function formatSkill(skill) {
  const directory = fileURLToPath(new URL(`../../skills/${skill.id}/`, import.meta.url));
  return `Skill directory: ${directory}\nResolve relative references, assets, scripts, and sibling skills from this directory.\n\n${skill.content}`;
}

export default Plugin.define({
  id: "startechnica-agents",
  async setup(ctx) {
    const skills = await loadSkillCatalog(skillsDirectory);

    await ctx.command.transform((editor) => {
      for (const skill of skills) {
        editor.add({
          name: `skill-${skill.id}`,
          description: skill.description,
          execute: async ({ sessionID, prompt, delivery }) => {
            const currentSkills = await loadSkillCatalog(skillsDirectory);
            const currentSkill = currentSkills.find((item) => item.id === skill.id);
            if (!currentSkill) {
              throw new Error(`Skill no longer exists: ${skill.id}`);
            }

            await ctx.session.prompt({
              ...prompt,
              sessionID,
              text: `Apply the ${currentSkill.id} skill to this request. Follow its instructions:\n\n${formatSkill(currentSkill)}\n\n--- User request ---\n${prompt.text}`,
              delivery,
            });
          },
        });
      }
    });

    await ctx.tool.transform((editor) => {
      editor.namespace({
        name: "startechnica",
        description: "Find and load Startechnica agent skills",
      });
      editor.add({
        name: "skill",
        description: "List, search, or load a Startechnica agent skill by its directory name.",
        input: {
          type: "object",
          properties: {
            action: {
              type: "string",
              enum: ["list", "search", "load"],
              description: "List available skills, search their names and instructions, or load one skill.",
            },
            query: {
              type: "string",
              description: "Required for search; terms to find in skill names, descriptions, and instructions.",
            },
            skill: {
              type: "string",
              description: "Required for load; exact skill directory name.",
            },
          },
          required: ["action"],
          additionalProperties: false,
        },
        options: { namespace: "startechnica", codemode: false },
        execute: async ({ action, query, skill }) => {
          const currentSkills = await loadSkillCatalog(skillsDirectory);

          if (action === "list") {
            return { content: formatSkillList(currentSkills) };
          }

          if (action === "search") {
            if (typeof query !== "string" || query.trim() === "") {
              throw new Error("Provide a non-empty query when searching skills.");
            }
            const matches = searchSkills(currentSkills, query);
            return {
              content: matches.length > 0
                ? formatSkillList(matches)
                : `No skills matched "${query}".`,
            };
          }

          if (action === "load") {
            if (typeof skill !== "string" || skill.trim() === "") {
              throw new Error("Provide a skill directory name when loading a skill.");
            }
            const selected = currentSkills.find((item) => item.id === skill);
            if (!selected) {
              throw new Error(`Unknown skill "${skill}". Use the list or search action to find a skill name.`);
            }
            return { content: formatSkill(selected) };
          }

          throw new Error(`Unsupported skill action: ${action}`);
        },
      });
    });
  },
});
