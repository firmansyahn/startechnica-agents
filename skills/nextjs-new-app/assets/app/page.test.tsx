import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithQuery } from "@/tests/render";
import { expectAccessible } from "@/tests/axe";
import { HomeClient } from "./HomeClient";

// The first page test: proves the dom project, the aliases, the query and intl wrappers all work.
// Every page.tsx has one beside it (`nextjs-app-structure` page-test-every-page); a second locale
// gets its own render once src/messages/ has one (page-test-second-locale).
describe("home page", () => {
  it("renders the translated title and actions", async () => {
    renderWithQuery(<HomeClient />);
    expect(screen.getByRole("heading", { name: "Welcome" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
    await expectAccessible();
  });
});
