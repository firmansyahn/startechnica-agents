// ESLint flat config for a Next.js 16 App Router app: Next's own rules plus the team rules
// that a linter can check. Copy it to <app-root>/eslint.config.mjs, or merge the blocks marked
// "Rule" into the existing config. Each block names the review rule ID it enforces.
//
// Needs: eslint 9 and eslint-config-next (yarn add -D eslint eslint-config-next). Next 16 dropped
// `next lint`; run `yarn eslint .` (a "lint" script).
//
// One ESLint rule can be configured once per file: a later block that matches the same file
// replaces the rule's options, it doesn't add to them. So the restricted imports and globals are
// built from lists below and each block passes the full list for its files.
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Where the app's own code lives, relative to <app-root>.
const CODE = ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}", "src/**/*.{ts,tsx}"];
// Where React components and pages live (no network calls of their own).
const UI = ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}"];
// Code that runs in the browser, by convention: client pages, components, hooks and providers.
// A "use client" directive can't be matched by a glob; tests/server-only.test.ts checks those files.
const CLIENT = ["app/**/*Client.tsx", "components/**/*.{ts,tsx}", "src/hooks/**/*.{ts,tsx}", "src/providers/**/*.{ts,tsx}"];
// Server entry points and other places that may call fetch or log to the console.
const SERVER_ENTRY = ["app/**/route.ts", "app/**/route.tsx"];
const TESTS = ["**/*.test.ts", "**/*.test.tsx", "**/*.spec.ts", "tests/**", "scripts/**", "*.config.*"];

// ui-one-primitives-folder: shadcn primitives come from components/shadcn-ui only.
const PRIMITIVES = {
  group: ["@/components/ui", "@/components/ui/*"],
  message: "Import shadcn primitives from @/components/shadcn-ui/* (rule ui-one-primitives-folder).",
};
// data-no-fetch-in-components: no HTTP clients in pages and components.
const AXIOS = { name: "axios", message: "Read with useQuery on the services registry, write with a server action (rule data-no-fetch-in-components)." };
// struct-server-only: browser code imports types only from the server-only BFF folder, except the
// shared Result module (Result, ApiError, errorText), which the browser's runAction uses.
const SERVER_API = {
  // gitignore-style: a negation can't re-include a file whose folder is excluded, so list files ("/*"), not the folder.
  group: ["@/src/api/*", "**/src/api/*", "!@/src/api/result", "!**/src/api/result"],
  allowTypeImports: true,
  message: "src/api is server-only: import its types with `import type`, call it through a server action or the reads proxy (rule struct-server-only).",
};

// forms-no-alert-confirm: the project's confirm dialog and toasts, never the browser's dialogs.
const DIALOGS = ["alert", "confirm", "prompt"].map((name) => ({
  name,
  message: `Use the confirm dialog or a toast, not ${name}() (rule forms-no-alert-confirm).`,
}));
// data-no-fetch-in-components: pages and components read through TanStack Query, not fetch.
const FETCH = { name: "fetch", message: "Read with useQuery on the services registry; files use the upload/download helpers (rule data-no-fetch-in-components)." };

// ui-theme-tokens-only, as editor feedback: a palette, white/black or hex color class in a string.
// The gate (with an allow-list) is tests/theme-tokens.test.ts; this only warns while typing.
// esquery regexes can't contain "/", so opacity suffixes aren't part of the match.
const PALETTE =
  "(^|[\\s:\"'`])(text|bg|border|border-[xytrblse]|ring|ring-offset|outline|divide|from|via|to|shadow|fill|stroke|placeholder|decoration|caret|accent)-((slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[0-9]{2,3}|white|black|\\[#[0-9a-fA-F]{3,8}\\])";
const COLOR_MESSAGE = "Color with semantic tokens (bg-card, text-muted-foreground, bg-primary, text-success...), not palette or hex classes (rule ui-theme-tokens-only).";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "out/**", "build/**", "coverage/**", "next-env.d.ts", "node_modules/**"]),

  // Rule ui-one-primitives-folder, forms-no-alert-confirm: all app code.
  {
    files: CODE,
    rules: {
      "no-restricted-imports": ["error", { patterns: [PRIMITIVES] }],
      "no-restricted-globals": ["error", ...DIALOGS],
      "no-restricted-properties": [
        "error",
        ...["window", "globalThis", "self"].flatMap((object) =>
          ["alert", "confirm", "prompt"].map((property) => ({
            object,
            property,
            message: `Use the confirm dialog or a toast, not ${object}.${property}() (rule forms-no-alert-confirm).`,
          })),
        ),
      ],
      "no-restricted-syntax": [
        "warn",
        { selector: `Literal[value=/${PALETTE}/]`, message: COLOR_MESSAGE },
        { selector: `TemplateElement[value.raw=/${PALETTE}/]`, message: COLOR_MESSAGE },
      ],
    },
  },

  // Rule log-no-console: log through the logger (src/libs/logger or the project's equivalent).
  {
    files: CODE,
    rules: { "no-console": "error" },
  },

  // Rule data-no-fetch-in-components: pages and components don't call fetch or axios.
  {
    files: UI,
    ignores: SERVER_ENTRY,
    rules: {
      "no-restricted-imports": ["error", { paths: [AXIOS], patterns: [PRIMITIVES] }],
      "no-restricted-globals": ["error", ...DIALOGS, FETCH],
    },
  },

  // Rule struct-server-only: browser code doesn't import the server-only BFF folder.
  {
    files: CLIENT,
    rules: {
      "no-restricted-imports": ["error", { paths: [AXIOS], patterns: [PRIMITIVES, SERVER_API] }],
    },
  },

  // The generated primitives are the CLI's output: their colors and dialogs are reviewed upstream.
  {
    files: ["components/shadcn-ui/**"],
    rules: { "no-restricted-syntax": "off" },
  },

  // Tests, scripts and config files may log, fetch and use any color.
  {
    files: TESTS,
    rules: { "no-console": "off", "no-restricted-globals": "off", "no-restricted-syntax": "off" },
  },
]);
