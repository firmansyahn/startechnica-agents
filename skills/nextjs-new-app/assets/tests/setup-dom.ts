import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import { takeFixtureErrors } from "./render";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();   // fakeApi stubs fetch per test
  const invalid = takeFixtureErrors();   // fixtures the project's reply check refused (rule data-test-fixtures-fit-spec)
  if (invalid.length) throw new Error(`A test fixture breaks the API spec:\n${invalid.join("\n")}`);
});
