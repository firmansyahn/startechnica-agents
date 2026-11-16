import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../", import.meta.url);

async function readJSON(relativePath) {
  return JSON.parse(await readFile(new URL(relativePath, root), "utf8"));
}

test("repository root is an installable OpenCode package with the skill catalog", async () => {
  const manifest = await readJSON("package.json");
  const lock = await readJSON("package-lock.json");

  assert.equal(manifest.name, "startechnica-agents");
  assert.equal(manifest.type, "module");
  assert.equal(manifest.exports["."], "./.opencode/plugins/index.js");
  assert.equal(manifest.dependencies["@opencode/plugin"], "2.3.0");
  assert.equal(lock.packages[""].version, manifest.version);
  assert.deepEqual(lock.packages[""].dependencies, manifest.dependencies);
  for (const file of [".opencode/plugins/index.js", ".opencode/lib/catalog.js", "skills/"]) {
    assert.ok(manifest.files.includes(file), `Package must include ${file}`);
  }

  assert.deepEqual(await readdir(new URL(".opencode/plugins/", root)), ["index.js"]);

  const { default: plugin } = await import(new URL(manifest.exports["."], root));
  assert.equal(plugin.id, "startechnica-agents");
  assert.equal(typeof plugin.setup, "function");
});
