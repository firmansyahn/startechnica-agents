import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

// Two projects split by suffix (nextjs-app-structure references/testing.md): `.test.ts` runs in
// node without a DOM, `.test.tsx` in jsdom. Playwright specs (`.spec.ts`) never match.
export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    projects: [
      {
        extends: true,
        test: { name: "node", environment: "node", include: ["**/*.test.ts"], exclude: ["node_modules/**", ".next/**"] },
      },
      {
        extends: true,
        test: {
          name: "dom",
          environment: "jsdom",
          include: ["**/*.test.tsx"],
          exclude: ["node_modules/**", ".next/**"],
          setupFiles: ["./tests/setup-dom.ts"],
        },
      },
    ],
  },
});
