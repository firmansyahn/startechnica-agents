import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithQuery } from "@/tests/render";
import { HomeClient } from "./HomeClient";

// The first page test: proves the dom project, the aliases, the query and intl wrappers all work.
describe("HomeClient", () => {
  it("renders the translated title and actions", () => {
    renderWithQuery(<HomeClient />);
    expect(screen.getByRole("heading", { name: "Welcome" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
  });
});
