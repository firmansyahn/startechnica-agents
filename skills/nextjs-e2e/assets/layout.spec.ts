// Copy to <app-root>/tests/e2e/layout.spec.ts. Rules ui-mobile-first and ui-table-scroll-container (nextjs-ui):
// at phone width no page scrolls sideways, and the page doesn't hide that by clipping its own overflow; a wide
// table, code block or diagram scrolls inside its own overflow-x-auto container. A failure names the elements
// that stick out past the viewport. It misses pages not in PAGES, states the page reaches only after an
// interaction (an open dialog, a long value typed in), and whether grids collapse to one column (review).
import { test, expect, type Page } from "@playwright/test";

// ADJUST: the pages to check: the main page of each area, and every page with a wide table.
const PAGES = ["/app", "/app/items"];
const WIDTH = 400;

test.use({ viewport: { width: WIDTH, height: 800 } });

/** How wide the page is, whether html or body clips its sideways overflow, and the outermost elements past the right edge. */
function measure(page: Page) {
  return page.evaluate(() => {
    const html = document.documentElement;
    const clips = (el: Element) => /^(auto|scroll|hidden|clip)$/.test(getComputedStyle(el).overflowX);
    const right = html.clientWidth + 1;
    const tag = (el: Element) =>
      `<${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}${typeof el.className === "string" && el.className ? ` class="${el.className.slice(0, 80)}"` : ""}>`;
    const describe = (el: Element) =>
      `${tag(el)} ${Math.round(el.getBoundingClientRect().width)}px wide, "${(el.textContent ?? "").trim().slice(0, 40)}"` +
      (el.parentElement && el.parentElement !== document.body ? `, in ${tag(el.parentElement)}` : "");
    const outside: string[] = [];
    for (const el of Array.from(document.body.querySelectorAll("*"))) {
      if (el.getBoundingClientRect().right <= right) continue;
      let contained = false;
      for (let a: Element | null = el; a && a !== document.body; a = a.parentElement) {
        if (getComputedStyle(a).position === "fixed" || (a !== el && clips(a))) contained = true;
      }
      const parent = el.parentElement;
      if (contained || (parent && parent !== document.body && parent.getBoundingClientRect().right > right)) continue;
      outside.push(describe(el));
    }
    return {
      scrollWidth: html.scrollWidth,
      clientWidth: html.clientWidth,
      clipped: [html, document.body].filter((el) => /^(hidden|clip)$/.test(getComputedStyle(el).overflowX)).map((el) => el.tagName.toLowerCase()),
      outside,
    };
  });
}

for (const path of PAGES) {
  test(`${path} doesn't scroll sideways at ${WIDTH}px`, { tag: "@mobile" }, async ({ page }) => {
    await page.goto(path);
    // ADJUST: what the page shows once its data has loaded.
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const m = await measure(page);
    const culprits = `Past the right edge (wrap a table, code or diagram in an overflow-x-auto container; make the rest fit with unprefixed phone classes):\n${m.outside.join("\n")}`;
    expect(m.clipped, `overflow-x hidden on ${m.clipped.join(", ")} hides content instead of fitting it. ${culprits}`).toEqual([]);
    expect(m.scrollWidth, `the page is ${m.scrollWidth}px wide in a ${m.clientWidth}px viewport. ${culprits}`).toBeLessThanOrEqual(m.clientWidth);
  });
}
