import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import plugin from "../index.js";

test("registers skill commands and supports listing, searching, loading, and execution", async () => {
  const commands = [];
  let skillTool;
  let sentPrompt;
  const context = {
    command: {
      transform: async (register) => register({ add: (command) => commands.push(command) }),
    },
    tool: {
      transform: async (register) => register({
        namespace() {},
        add: (tool) => {
          skillTool = tool;
        },
      }),
    },
    session: {
      prompt: async (prompt) => {
        sentPrompt = prompt;
      },
    },
  };

  await plugin.setup(context);

  assert.ok(commands.length > 0);
  assert.equal(skillTool.name, "skill");
  assert.ok((await skillTool.execute({ action: "list" })).content.includes("go-testing"));
  assert.ok((await skillTool.execute({ action: "search", query: "PostgreSQL database" })).content.includes("go-testing"));
  const loaded = await skillTool.execute({ action: "load", skill: "go-testing" });
  const directory = fileURLToPath(new URL("../../skills/go-testing/", import.meta.url));
  assert.ok(loaded.content.includes("# Go tests"));
  assert.ok(loaded.content.includes(`Skill directory: ${directory}`));

  await commands.find(({ name }) => name === "skill-go-testing").execute({
    sessionID: "test-session",
    prompt: { text: "write tests", attachments: [] },
    delivery: "steer",
  });

  assert.ok(sentPrompt.text.includes("# Go tests"));
  assert.ok(sentPrompt.text.includes(`Skill directory: ${directory}`));
  assert.ok(sentPrompt.text.endsWith("write tests"));
  assert.deepEqual(sentPrompt.attachments, []);
  assert.equal(sentPrompt.sessionID, "test-session");
  assert.equal(sentPrompt.delivery, "steer");
});
