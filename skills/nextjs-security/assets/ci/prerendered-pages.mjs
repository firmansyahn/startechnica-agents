#!/usr/bin/env node
// prerendered-pages.mjs — rule sec-nonce-pages-dynamic: under a nonce CSP, fail when `next build`
// prerendered a page. A static page was rendered without a request, so it has no nonce and the CSP
// blocks its scripts. Run it after `next build` (security.gitlab-ci.yml); copy to <app-root>/scripts/ci/.
//
//   node scripts/ci/prerendered-pages.mjs [app-root]
//
// It does nothing when the proxy sets no nonce. It reads .next/prerender-manifest.json: every key of
// `routes` whose routeType is "page" (Next 16), or that has an RSC dataRoute (older majors), is a
// prerendered page. Re-check the manifest's shape after a Next major upgrade.
import fs from "node:fs";
import path from "node:path";

// Framework pages that are static by design: they render without their scripts.
const FRAMEWORK = new Set(["/_not-found", "/_global-error"]);
// ADJUST: pages that stay static on purpose, with the reason (SRI instead of a nonce, a public page
// with no script of its own). Every entry must still be prerendered: a stale one fails.
const ALLOWED = {
  // "/legal/terms": "public text page, no client script; served under the SRI policy",
};

const root = path.resolve(process.argv[2] ?? ".");
const proxy = ["proxy.ts", "proxy.js", "middleware.ts", "middleware.js", "src/proxy.ts", "src/proxy.js", "src/middleware.ts", "src/middleware.js"]
  .map((f) => path.join(root, f))
  .find((f) => fs.existsSync(f) && /nonce-|x-nonce/.test(fs.readFileSync(f, "utf8")));
if (!proxy) {
  console.log("the proxy sets no nonce: nothing to check");
  process.exit(0);
}

const manifestFile = path.join(root, ".next", "prerender-manifest.json");
if (!fs.existsSync(manifestFile)) {
  console.error(`${path.relative(root, manifestFile)} is missing: run next build first`);
  process.exit(2);
}
const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
const isPage = (r) => (r.routeType ? r.routeType === "page" : typeof r.dataRoute === "string");
const pages = Object.entries(manifest.routes ?? {})
  .filter(([route, r]) => isPage(r) && !FRAMEWORK.has(route))
  .map(([route, r]) => ({ route, src: r.srcRoute && r.srcRoute !== route ? ` (from ${r.srcRoute})` : "" }));

const found = pages.filter((p) => !(p.route in ALLOWED));
const stale = Object.keys(ALLOWED).filter((route) => !pages.some((p) => p.route === route));
if (stale.length) console.error(`no longer prerendered, remove from ALLOWED: ${stale.join(", ")}`);
if (found.length) {
  console.error(`${path.relative(root, proxy)} sets a nonce, but next build prerendered ${found.length} page(s); their scripts get no nonce:`);
  for (const p of found) console.error(`- ${p.route}${p.src}`);
  console.error("Make each dynamic (await connection() from next/server, or a request API), or list it in ALLOWED with the reason (SRI instead of nonces).");
}
if (found.length || stale.length) process.exit(1);
console.log(`no prerendered page under the nonce policy (${pages.length} allowed)`);
