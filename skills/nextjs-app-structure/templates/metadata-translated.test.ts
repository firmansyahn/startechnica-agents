import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

// Rule i18n-metadata-translated: a page's title and description come from its translations
// (`generateMetadata` with `getTranslations`), never a literal. Checks every app/**/page.tsx and
// app/**/layout.tsx. Place this file in <app-root>/tests/; root then resolves to the app.
//
// It fails on `export const metadata` that sets a title (other than the root layout's
// `title: { template, default }`) or a description, since a static object can't be translated; on a
// `generateMetadata` in a file that never calls `getTranslations(`; and on a literal string as a
// title or description inside `generateMetadata`. What it can't see: a page with no metadata at all
// (it shows its layout's title), and keys from another page's namespace.
const root = path.resolve(__dirname, "..");

const SKIP_DIRS = new Set(["node_modules", ".next", "out", "build", "coverage"]);
// Files allowed a literal title or description, each with its reason. It only shrinks: an entry that no
// longer has one fails the stale test.
const ALLOWED: Record<string, string> = {
  // "app/(marketing)/layout.tsx": "the product name, the same in every locale",
};

function sources(dir: string): string[] {
  const abs = path.join(root, dir);
  if (!fs.existsSync(abs)) return [];
  return fs.readdirSync(abs, { withFileTypes: true }).flatMap((entry) => {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) return SKIP_DIRS.has(entry.name) ? [] : sources(rel);
    return /^(?:page|layout)\.[jt]sx?$/.test(entry.name) ? [rel] : [];
  });
}

/** The text from the bracket at `open` to its matching close. */
function balanced(source: string, open: number, pair = "{}"): string {
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === pair[0]) depth++;
    else if (source[i] === pair[1] && --depth === 0) return source.slice(open, i + 1);
  }
  return source.slice(open);
}

const LITERAL = /\b(title|description)\s*:\s*(?:"[^"]*"|'[^']*'|`[^`$]*`)/g;
const lineOf = (src: string, index: number) => src.slice(0, index).split("\n").length;

/** What is wrong with a page's or layout's metadata, as "line: problem". */
function problems(src: string): string[] {
  const found: string[] = [];
  const staticMeta = src.match(/export\s+const\s+metadata\b[^=]*=\s*\{/);
  if (staticMeta) {
    const start = staticMeta.index! + staticMeta[0].length - 1;
    const obj = balanced(src, start);
    for (const m of obj.matchAll(/\b(title|description)\s*:\s*(\{)?/g)) {
      const template = m[1] === "title" && m[2] && /\btemplate\s*:/.test(balanced(obj, m.index! + m[0].length - 1));
      if (!template) found.push(`${lineOf(src, start + m.index!)}: export const metadata sets ${m[1]}; use generateMetadata with getTranslations`);
    }
  }
  const dynamic = src.match(/export\s+(?:async\s+function\s+generateMetadata\b|function\s+generateMetadata\b|const\s+generateMetadata\b)/);
  if (dynamic) {
    if (!/\bgetTranslations\s*\(/.test(src)) found.push(`${lineOf(src, dynamic.index!)}: generateMetadata without getTranslations; read meta.title and meta.description`);
    const rest = src.slice(dynamic.index!);
    const open = rest.search(/\)\s*(?::[^{=]*)?(?:=>\s*\(?\s*)?\{/);
    if (open !== -1) {
      const at = dynamic.index! + open + rest.slice(open).indexOf("{");
      const body = balanced(src, at);
      for (const m of body.matchAll(LITERAL)) found.push(`${lineOf(src, at + m.index!)}: literal ${m[1]}; use t("meta.${m[1]}")`);
    }
  }
  return found;
}

describe("metadata comes from translations (rule i18n-metadata-translated)", () => {
  it("finds literal and untranslated metadata, and leaves translated metadata alone", () => {
    expect(problems(`export const metadata: Metadata = { title: "Items", description: "All items" };`)).toEqual([
      "1: export const metadata sets title; use generateMetadata with getTranslations",
      "1: export const metadata sets description; use generateMetadata with getTranslations",
    ]);
    expect(problems(`export const metadata = { title: { template: "%s · Acme", default: "Acme" } };`)).toEqual([]);
    expect(problems(`export async function generateMetadata() {\n  return { title: "Items" };\n}`)).toEqual([
      "1: generateMetadata without getTranslations; read meta.title and meta.description",
      "2: literal title; use t(\"meta.title\")",
    ]);
    expect(
      problems(`export async function generateMetadata({ params }: Props): Promise<Metadata> {
        const t = await getTranslations("admin.items.meta");
        return { title: t("title"), description: t("description"), openGraph: { title: \`\${t("title")} · Acme\` } };
      }`),
    ).toEqual([]);
    expect(problems(`export const generateMetadata = async (): Promise<Metadata> => ({ title: 'x' });`)).toEqual([
      "1: generateMetadata without getTranslations; read meta.title and meta.description",
      "1: literal title; use t(\"meta.title\")",
    ]);
  });

  const files = sources("app");
  const found = files.map((file) => ({ file, list: problems(fs.readFileSync(path.join(root, file), "utf8")) })).filter((f) => f.list.length);

  it("translates every page's and layout's metadata", () => {
    const report = found.filter(({ file }) => !(file in ALLOWED)).flatMap(({ file, list }) => list.map((p) => `${file}:${p}`));
    expect(report, `Read the title and description with getTranslations in generateMetadata:\n${report.join("\n")}`).toEqual([]);
  });

  it("has no stale allow-list entry", () => {
    const stale = Object.keys(ALLOWED).filter((f) => !found.some(({ file }) => file === f));
    expect(stale, "these no longer have literal metadata: remove them from ALLOWED").toEqual([]);
  });
});
