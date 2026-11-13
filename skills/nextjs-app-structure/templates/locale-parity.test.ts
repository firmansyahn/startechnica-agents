import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

// `nextjs-app-structure` Strings rules: every key exists in every locale, and every literal key
// the code reads exists. For next-intl message files (src/messages/<locale>.json). Place this file
// in <app-root>/tests/; root then resolves to the app.
//
// What it can't see: keys built at runtime (t(`status.${s}`)), a translator passed to another
// function or component, and namespaces that aren't string literals. Keep those few, or list
// their keys in a constant the test can read.
const root = path.resolve(__dirname, "..");

const MESSAGES_DIR = "src/messages";
const REFERENCE_LOCALE = "en"; // the locale the others are compared with
const CODE_DIRS = ["app", "components", "src"];
const SKIP_DIRS = new Set(["node_modules", ".next", "out", "build", "coverage"]);

type Messages = { [key: string]: string | Messages };

const locales = fs.existsSync(path.join(root, MESSAGES_DIR))
  ? fs.readdirSync(path.join(root, MESSAGES_DIR)).filter((f) => f.endsWith(".json")).map((f) => f.replace(/\.json$/, ""))
  : [];
const messages = (locale: string): Messages => JSON.parse(fs.readFileSync(path.join(root, MESSAGES_DIR, `${locale}.json`), "utf8"));

/** Every leaf key as a dotted path. */
function leafKeys(node: Messages, prefix = ""): string[] {
  return Object.entries(node).flatMap(([k, v]) => (typeof v === "string" ? [`${prefix}${k}`] : leafKeys(v, `${prefix}${k}.`)));
}

/** Whether a dotted path names a message or a group of messages. */
function has(node: Messages, key: string): boolean {
  let cur: string | Messages | undefined = node;
  for (const part of key.split(".")) {
    if (!cur || typeof cur === "string") return false;
    cur = cur[part];
  }
  return cur !== undefined;
}

function sources(dir: string): string[] {
  const abs = path.join(root, dir);
  if (!fs.existsSync(abs)) return [];
  return fs.readdirSync(abs, { withFileTypes: true }).flatMap((entry) => {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) return SKIP_DIRS.has(entry.name) ? [] : sources(rel);
    return /\.tsx?$/.test(entry.name) && !/\.(test|spec)\.tsx?$/.test(entry.name) ? [rel] : [];
  });
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * The literal keys a source reads, with their namespace: `const t = useTranslations("a.b")` or
 * `await getTranslations("a.b")` / `getTranslations({ locale, namespace: "a.b" })`, then
 * `t("key")`, `t.rich("key")`, `t.markup("key")`, `t.raw("key")`. `t.has(...)` is a question, not a read.
 */
function literalKeys(source: string): string[] {
  const keys: string[] = [];
  const translator =
    /const\s+(\w+)\s*=\s*(?:await\s+)?(?:useTranslations|getTranslations)\(\s*(?:"([^"]*)"|'([^']*)'|\{[^}]*?namespace:\s*(?:"([^"]*)"|'([^']*)')[^}]*\}|\{[^}]*\})?\s*\)/g;
  for (const m of source.matchAll(translator)) {
    const name = m[1];
    const ns = m[2] ?? m[3] ?? m[4] ?? m[5] ?? "";
    const call = new RegExp(String.raw`(?<![\w.])${escape(name)}(?:\.(?:rich|markup|raw))?\(\s*(?:"([^"$]+)"|'([^'$]+)')`, "g");
    for (const c of source.matchAll(call)) keys.push(ns ? `${ns}.${c[1] ?? c[2]}` : (c[1] ?? c[2]));
  }
  return keys;
}

describe("translations (`nextjs-app-structure` Strings rules)", () => {
  it("reads keys with their namespace", () => {
    const src = `const t = useTranslations("admin.customers"); const tc = await getTranslations({ locale, namespace: "common" });
      t("title"); t.rich("hint", { b }); tc('save'); t.has("maybe"); t(\`dyn.\${x}\`);`;
    expect(literalKeys(src)).toEqual(["admin.customers.title", "admin.customers.hint", "common.save"]);
  });

  it(`has the reference locale (${REFERENCE_LOCALE}) and at least one message file`, () => {
    expect(locales, `no ${MESSAGES_DIR}/${REFERENCE_LOCALE}.json: set MESSAGES_DIR and REFERENCE_LOCALE at the top of this test`).toContain(REFERENCE_LOCALE);
  });

  it("has every key in every locale", () => {
    const reference = new Set(leafKeys(messages(REFERENCE_LOCALE)));
    const report: string[] = [];
    for (const locale of locales.filter((l) => l !== REFERENCE_LOCALE)) {
      const keys = new Set(leafKeys(messages(locale)));
      for (const k of reference) if (!keys.has(k)) report.push(`${locale}.json is missing ${k}`);
      for (const k of keys) if (!reference.has(k)) report.push(`${locale}.json has ${k}, which ${REFERENCE_LOCALE}.json lacks`);
    }
    expect(report, `Add each key to every locale in the same change:\n${report.join("\n")}`).toEqual([]);
  });

  it("has every literal key the code reads", () => {
    const reference = messages(REFERENCE_LOCALE);
    const missing: string[] = [];
    for (const file of CODE_DIRS.flatMap(sources)) {
      for (const key of literalKeys(fs.readFileSync(path.join(root, file), "utf8"))) {
        if (!has(reference, key)) missing.push(`${file}: ${key}`);
      }
    }
    expect(missing, `Add these to ${MESSAGES_DIR}/${REFERENCE_LOCALE}.json and every other locale:\n${missing.join("\n")}`).toEqual([]);
  });
});
