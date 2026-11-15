// Copy to <app-root>/tests/e2e/security-headers.spec.ts and adjust the marked settings.
// The headers and CSP spec of nextjs-security, run by Playwright (nextjs-e2e) against the app.
// Rules: sec-security-headers, sec-csp-nonce, sec-unsafe-eval-dev-only, sec-deny-framing,
// sec-exact-third-party-origins, sec-theme-script-csp; nextjs-e2e's e2e-check-headers-csp.
// Run it on the production build (CI: `yarn build && yarn start`): `next dev` adds 'unsafe-eval',
// so that one assertion runs only when PROD is set.
// Misses: pages not listed below, policies set per path that differ from the ones listed, whether a
// third-party origin is needed at all or trusted with 'strict-dynamic', and a report-only policy.
import { test, expect, type Page } from "@playwright/test";

// ADJUST: a page, a route handler and a static asset: the headers go on every response.
const PAGE = "/";
const RESPONSES = ["/", "/livez", "/favicon.ico"];
// ADJUST: each theme the app has, set the way the app stores it before the page loads (nextjs-ui),
// and what <html> shows once the before-paint theme script ran (its class, data-theme or
// color-scheme). A theme script the CSP blocks leaves the default and logs a violation.
interface Theme {
  name: string;
  storage?: Record<string, string>;
  cookies?: Record<string, string>;
  colorScheme?: "light" | "dark";
  html: RegExp;
}
const THEMES: Theme[] = [
  { name: "light", storage: { theme: "light" }, colorScheme: "light", html: /\blight\b/ },
  { name: "dark", storage: { theme: "dark" }, colorScheme: "dark", html: /\bdark\b/ },
];
// ADJUST: pages meant to be embedded, with the exact origins allowed to frame each (sec-deny-framing).
// Every other page answers frame-ancestors 'none' and X-Frame-Options: DENY.
const EMBEDDABLE: Record<string, string[]> = {
  // "/embed/status": ["https://status.example.com"],
};
// Directives whose sources must be exact origins (sec-exact-third-party-origins), and the scheme
// sources each may still list (data: and blob: images are the app's own).
const EXACT_DIRECTIVES = ["default-src", "script-src", "connect-src", "img-src", "frame-src", "media-src", "font-src", "worker-src"];
const SCHEMES_ALLOWED: Record<string, string[]> = { "img-src": ["data:", "blob:"], "media-src": ["blob:"], "font-src": ["data:"], "worker-src": ["blob:"] };
// ADJUST: HSTS is asserted only where the app sets it (not when the ingress does, sec-security-headers).
const HSTS = false;
const PROD = !!process.env.CI || process.env.E2E_PROD === "1";

type Policy = Map<string, string[]>;

/** The policy's directives and their sources; the first of a repeated directive wins, as in browsers. */
function parseCsp(header: string | undefined): Policy {
  const policy: Policy = new Map();
  for (const part of (header ?? "").split(";")) {
    const [name, ...sources] = part.trim().split(/\s+/).filter(Boolean);
    if (name && !policy.has(name.toLowerCase())) policy.set(name.toLowerCase(), sources);
  }
  return policy;
}

/** Why a source is broader than one exact origin, or null when it is exact (or a keyword). */
function broad(source: string, directive: string): string | null {
  if (/^'.*'$/.test(source)) return null;
  if (source === "*") return "any origin";
  if (/^[a-z][a-z0-9+.-]*:$/i.test(source)) return (SCHEMES_ALLOWED[directive] ?? []).includes(source.toLowerCase()) ? null : "a whole scheme";
  if (/(^|\/\/)\*/.test(source)) return "a wildcard host";
  return null;
}

async function headersOf(page: Page, path: string) {
  const res = await page.request.get(path);
  expect(res.status(), `${path} answered ${res.status()}`).toBeLessThan(500);
  return res.headers();
}

test.describe("security headers and CSP", () => {
  test("parses a policy and spots broad sources", () => {
    const p = parseCsp("default-src 'self'; img-src 'self' data: https:; connect-src https://*.example.com; script-src 'self'; script-src *");
    expect(p.get("img-src")).toEqual(["'self'", "data:", "https:"]);
    expect(p.get("script-src")).toEqual(["'self'"]);
    expect(broad("data:", "img-src")).toBeNull();
    expect(broad("https:", "img-src")).toBe("a whole scheme");
    expect(broad("https://*.example.com", "connect-src")).toBe("a wildcard host");
    expect(broad("*", "frame-src")).toBe("any origin");
    expect(broad("https://errors.example.com", "connect-src")).toBeNull();
  });

  test("sends the security headers on a page, a route handler and a static asset (sec-security-headers)", async ({ page }) => {
    for (const path of RESPONSES) {
      const h = await headersOf(page, path);
      expect(h["x-content-type-options"], `${path}: X-Content-Type-Options`).toBe("nosniff");
      expect(h["referrer-policy"], `${path}: Referrer-Policy`).toBe("strict-origin-when-cross-origin");
      expect(h["permissions-policy"], `${path}: Permissions-Policy`).toBeTruthy();
      expect(h["cross-origin-opener-policy"], `${path}: Cross-Origin-Opener-Policy`).toBeTruthy();
      expect(h["x-powered-by"], `${path}: set poweredByHeader: false`).toBeUndefined();
      if (HSTS) expect(h["strict-transport-security"], `${path}: Strict-Transport-Security`).toMatch(/max-age=\d+/);
    }
  });

  test("denies framing except on the pages meant to be embedded (sec-deny-framing)", async ({ page }) => {
    const h = await headersOf(page, PAGE);
    expect(parseCsp(h["content-security-policy"]).get("frame-ancestors"), `${PAGE}: the CSP needs frame-ancestors 'none'`).toEqual(["'none'"]);
    expect(h["x-frame-options"], `${PAGE}: X-Frame-Options: DENY for browsers without frame-ancestors`).toBe("DENY");
    for (const [path, origins] of Object.entries(EMBEDDABLE)) {
      const e = await headersOf(page, path);
      const ancestors = parseCsp(e["content-security-policy"]).get("frame-ancestors") ?? [];
      expect([...ancestors].sort(), `${path}: frame-ancestors lists exactly the embedding origins`).toEqual([...origins].sort());
      expect(e["x-frame-options"], `${path}: X-Frame-Options DENY would block the embedding sites`).toBeUndefined();
    }
  });

  test("allows scripts by a fresh nonce, without 'unsafe-inline' or 'unsafe-eval' (sec-csp-nonce, sec-unsafe-eval-dev-only)", async ({ page }) => {
    const first = parseCsp((await headersOf(page, PAGE))["content-security-policy"]).get("script-src");
    const second = parseCsp((await headersOf(page, PAGE))["content-security-policy"]).get("script-src");
    expect(first, `${PAGE}: no Content-Security-Policy with script-src`).toBeDefined();
    const nonce = (s?: string[]) => s?.find((x) => /^'nonce-/.test(x));
    expect(nonce(first) ?? first!.find((x) => /^'sha(256|384|512)-/.test(x)), "script-src needs a nonce or a hash").toBeDefined();
    if (nonce(first)) expect(nonce(second), "the nonce must be new on every request").not.toBe(nonce(first));
    expect(first, "never 'unsafe-inline' in script-src").not.toContain("'unsafe-inline'");
    if (PROD) expect(first, "'unsafe-eval' only in development").not.toContain("'unsafe-eval'");
  });

  test("names exact third-party origins, no schemes or wildcards (sec-exact-third-party-origins)", async ({ page }) => {
    const policy = parseCsp((await headersOf(page, PAGE))["content-security-policy"]);
    const report: string[] = [];
    for (const directive of EXACT_DIRECTIVES)
      for (const source of policy.get(directive) ?? []) {
        const why = broad(source, directive);
        if (why) report.push(`${directive} ${source}: ${why}`);
      }
    expect(report, `Write each origin out (https://errors.example.com), one per host the app calls:\n${report.join("\n")}`).toEqual([]);
  });

  for (const theme of THEMES) {
    test(`loads with the ${theme.name} theme and no CSP violation (sec-theme-script-csp, e2e-check-headers-csp)`, async ({ page, baseURL }) => {
      const violations: string[] = [];
      page.on("console", (m) => {
        if (/Content Security Policy/i.test(m.text())) violations.push(m.text());
      });
      await page.addInitScript(() => {
        const w = window as unknown as { __csp: string[] };
        w.__csp = [];
        document.addEventListener("securitypolicyviolation", (e) => w.__csp.push(`${e.violatedDirective} blocked ${e.blockedURI || "inline"}`));
      });
      if (theme.storage) await page.addInitScript((s) => Object.entries(s).forEach(([k, v]) => localStorage.setItem(k, v)), theme.storage);
      if (theme.cookies) await page.context().addCookies(Object.entries(theme.cookies).map(([name, value]) => ({ name, value, url: baseURL! })));
      if (theme.colorScheme) await page.emulateMedia({ colorScheme: theme.colorScheme });
      await page.goto(PAGE);
      await page.waitForLoadState("load");
      const html = await page.evaluate(() => {
        const el = document.documentElement;
        return `${el.className} ${el.dataset.theme ?? ""} ${el.style.colorScheme}`;
      });
      violations.push(...(await page.evaluate(() => (window as unknown as { __csp: string[] }).__csp)));
      expect(violations, "pass the theme script the nonce (<ThemeProvider nonce={nonce}>) or list its hash; never relax the CSP for it").toEqual([]);
      expect(html, `the ${theme.name} theme script didn't apply before paint`).toMatch(theme.html);
    });
  }
});
