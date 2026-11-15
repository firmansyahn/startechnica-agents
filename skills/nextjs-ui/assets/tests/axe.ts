import axe from "axe-core";
import { expect } from "vitest";

// The accessibility check page tests call after the page has loaded: `await expectAccessible();`.
// It runs axe on the whole rendered document (page-level rules such as page-has-heading-one skip a
// single element) and fails with each violation's rule, element and fix. Copy it into <app-root>/tests/
// beside the render helper; it needs the `axe-core` dev dependency and the jsdom (`.test.tsx`) project.
//
// Rules, by the nextjs-ui rule they enforce. heading-order and page-has-heading-one are axe
// best-practice rules, which audits filtered to WCAG tags leave out, so they are named here.
// - ui-heading-hierarchy: page-has-heading-one, heading-order, empty-heading
// - ui-visible-labels: label, button-name, link-name, select-name
// What jsdom can't run: color-contrast and anything that needs layout; those belong to the Playwright
// audit (`nextjs-e2e`). A page test sees only what it renders: a heading in a layout the test leaves
// out isn't seen.
const RULES = ["page-has-heading-one", "heading-order", "empty-heading", "label", "button-name", "link-name", "select-name"];

/** Fails on any axe violation of RULES in the current document, and on a rule axe couldn't run. */
export async function expectAccessible(rules: string[] = RULES): Promise<void> {
  // jsdom has no layout, so it lacks elementFromPoint; axe asks it whether a modal is open (it errors
  // and skips page-has-heading-one without it). Answer "nothing there" for the run.
  const doc = document as unknown as Record<string, unknown>;
  const stubbed = ["elementFromPoint", "elementsFromPoint"].filter((k) => typeof doc[k] !== "function");
  for (const k of stubbed) doc[k] = k === "elementFromPoint" ? () => null : () => [];
  try {
    const { violations, incomplete } = await axe.run(document, { runOnly: { type: "rule", values: rules } });
    const report = [
      ...violations.flatMap((v) =>
        v.nodes.map((n) => `${v.id}: ${n.target.join(" ")}: ${n.failureSummary?.replace(/\s+/g, " ").trim() ?? v.help} (${v.helpUrl})`),
      ),
      ...incomplete
        .filter((r) => r.nodes.some((n) => n.none.concat(n.any, n.all).some((c) => c.id === "error-occurred")))
        .map((r) => `${r.id}: axe couldn't run this rule in this environment; check it in the Playwright audit`),
    ];
    expect(report, `Accessibility violations (nextjs-ui ui-heading-hierarchy, ui-visible-labels):\n${report.join("\n")}`).toEqual([]);
  } finally {
    for (const k of stubbed) delete doc[k];
  }
}
