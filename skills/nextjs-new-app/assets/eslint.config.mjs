// ESLint flat config for a Next.js 16 App Router app: Next's own rules plus the team rules
// that a linter can check. Copy it to <app-root>/eslint.config.mjs, or merge the blocks marked
// "Rule" into the existing config. Each selector's message names the review rule ID it enforces.
//
// Needs: eslint 9, eslint-config-next, eslint-plugin-testing-library and eslint-plugin-playwright
// (yarn add -D eslint eslint-config-next eslint-plugin-testing-library eslint-plugin-playwright). Next 16 dropped
// `next lint`; run `yarn eslint .` (a "lint" script).
//
// One ESLint rule can be configured once per file: a later block that matches the same file
// replaces the rule's options, it doesn't add to them. So the restricted imports and globals are
// built from lists below and each block passes the full list for its files. The team's syntax
// selectors avoid the problem instead: each file set has its own copy of no-restricted-syntax
// (team/syntax-code, team/syntax-ui, ...), so its list stands alone. Silence one finding with
// `// eslint-disable-next-line team/syntax-ui -- <reason>`.
import { defineConfig, globalIgnores } from "eslint/config";
import { builtinRules } from "eslint/use-at-your-own-risk";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import testingLibrary from "eslint-plugin-testing-library";
import playwright from "eslint-plugin-playwright";

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
// The generated shadcn primitives: the CLI's output, reviewed upstream.
const PRIMITIVES_DIR = ["components/shadcn-ui/**"];
// Routes: pages, layouts and the client components beside them.
const APP = ["app/**/*.{ts,tsx}"];
// Route entry pages (thin server components).
const PAGES = ["app/**/page.tsx"];
// Route files that render their own heading, outside the page-title component: error pages and
// the kit's starter page (app/HomeClient.tsx). Add a landing page here.
const APP_OWN_HEADING = ["app/**/error.tsx", "app/**/not-found.tsx", "app/global-error.tsx", "app/**/forbidden.tsx", "app/**/unauthorized.tsx", "app/HomeClient.tsx"];
// Brand icons and glyphs: components that draw their own <svg> with currentColor.
const ICONS_DIR = ["components/*-ui/icons/**"];
// Unit and component tests (Vitest + Testing Library).
const UNIT_TESTS = ["**/*.test.ts", "**/*.test.tsx"];
// Code that uses queries and must not read process.env: pages, components and the browser code.
const VIEW = [...UI, ...CLIENT];
// The proxy (middleware.ts before Next 16), at the root or in src/.
const PROXY = ["proxy.ts", "middleware.ts", "src/proxy.ts", "src/middleware.ts"];
const NEXT_CONFIG = ["next.config.js", "next.config.mjs", "next.config.cjs", "next.config.ts"];
// Server actions, one module per domain (nextjs-data action-file-per-domain).
const ACTIONS = ["src/services/**/actions.ts"];
// Playwright specs and sign-in setup (nextjs-e2e playwright.config.ts: testDir ./tests, testMatch **/*.spec.ts).
const E2E = ["tests/**/*.spec.ts", "tests/**/*.setup.ts"];
const SPECS = ["**/*.spec.ts", "**/*.spec.tsx"];

// The project's backend transport (nextjs-data, nextjs-bff): the functions whose path argument
// goes to the backend. Rename them here if the project's differ.
const TRANSPORTS = ["apiAction", "read", "readPage"];
const TRANSPORT = `/^(${TRANSPORTS.join("|")})$/`;
// A call on the logger (log from requestLogger(), or the root logger).
const LOG = "CallExpression[callee.object.name=/^(log|logger)$/][callee.property.name=/^(trace|debug|info|warn|error|fatal)$/]";
// Names that hold an id: id, itemId, item_id.
const ID_NAME = "/^(id|[a-z][A-Za-z0-9]*Id|[a-z][a-z0-9_]*_id)$/";

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
// bff-writes-via-apiaction: an action's backend call goes through apiAction.
const APIACTION = "Call the backend through apiAction(method, path, opts), which forwards the session and returns a Result (rule bff-writes-via-apiaction).";

// ui-theme-tokens-only, as editor feedback: a palette, white/black or hex color class in a string.
// The gate (with an allow-list) is tests/theme-tokens.test.ts; this only warns while typing.
// esquery regexes can't contain "/", so opacity suffixes aren't part of the match.
const PALETTE =
  "(^|[\\s:\"'`])(text|bg|border|border-[xytrblse]|ring|ring-offset|outline|divide|from|via|to|shadow|fill|stroke|placeholder|decoration|caret|accent)-((slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[0-9]{2,3}|white|black|\\[#[0-9a-fA-F]{3,8}\\])";
const COLOR_MESSAGE = "Color with semantic tokens (bg-card, text-muted-foreground, bg-primary, text-success...), not palette or hex classes (rule ui-theme-tokens-only).";

// Selector parts for the UI, i18n and folder rules. "\x2F" stands for "/" inside an esquery regex.
// Anything that names a module: import, export ... from, import().
const IMPORT_SOURCE = ":matches(ImportDeclaration, ExportNamedDeclaration, ExportAllDeclaration, ImportExpression)";
// An element named `name` placed in a `parent` element, directly or inside a {...} expression
// (each a quoted name or a /regex/).
const childOf = (parent, name) =>
  `:matches(JSXElement[openingElement.name.name=${parent}] > JSXElement, JSXElement[openingElement.name.name=${parent}] > JSXExpressionContainer JSXElement)[openingElement.name.name=${name}]`;
// A size, height, width or margin class on an icon placed in `parent`, which sizes its icons itself.
const sizedIconIn = (parent) =>
  String.raw`${childOf(parent, "/Icon$/")} > JSXOpeningElement > JSXAttribute[name.name='className'] Literal[value=/(^|\s)-?(size|h|w|m[lrxyse]?)-/]`;
// The attributes a person reads or hears.
const TEXT_PROPS = "JSXAttribute[name.name=/^(aria-label|placeholder|title|alt|label|description)$/]";
// A toast call (sonner): toast("..."), toast.success("..."), not toast.dismiss(id).
const TOAST = "CallExpression:matches([callee.name='toast'], [callee.object.name='toast'][callee.property.name!='dismiss'])";
// A t() call from useTranslations/getTranslations: t, tCommon, tErrors...
const T_CALL = "CallExpression[callee.name=/^t([A-Z][A-Za-z]*)?$/]";
// An icon-only button (size icon, icon-sm...) with only icons inside and no aria-label,
// aria-labelledby, title or spread props.
const UNNAMED_ICON_BUTTON = String.raw`JSXElement:has(> JSXOpeningElement[name.name=/^Button/]:has(> JSXAttribute[name.name='size'][value.value=/^icon/]):not(:has(> :matches(JSXAttribute[name.name=/^(aria-label|aria-labelledby|title)$/], JSXSpreadAttribute)))):not(:has(> :matches(JSXText[value=/\S/], JSXExpressionContainer, JSXElement:not([openingElement.name.name=/Icon$/]))))`;
const OVERLAY_CONTENT = "/^(Dialog|AlertDialog|Sheet|Drawer|Popover|DropdownMenu|ContextMenu|Menubar|HoverCard|Tooltip|Select|Command)Content$/";
const ICON_PARENTS = "/^(DropdownMenuItem|DropdownMenuCheckboxItem|DropdownMenuRadioItem|SelectItem|ContextMenuItem|CommandItem|MenubarItem|Badge|Alert|TabsTrigger|SidebarMenuButton)$/";
const ICON_PACKAGES = String.raw`/^(react-icons|@heroicons|@radix-ui\x2Freact-icons|@tabler\x2Ficons-react|@phosphor-icons\x2Freact|@fortawesome|@mui\x2Ficons-material|@iconify\x2Freact)($|\x2F)/`;
// A class string matching `pattern`, as a plain string or a template literal's text.
const classText = (pattern) => `:matches(Literal[value=/${pattern}/], TemplateElement[value.raw=/${pattern}/])`;
// Entries that a file set below drops from its list (the icons folder, the route files with their own heading).
const INLINE_SVG = {
  selector: "JSXOpeningElement[name.name='svg']",
  message: "Use a lucide-react icon; a brand glyph is a component in components/<brand>-ui/icons/ using currentColor (rule ui-icon-library-lucide).",
};
const PAGE_H1 = {
  selector: "JSXOpeningElement[name.name='h1']",
  message: "Head the page with the page-title component (title, description, action), not a hand-built h1 (rule ui-page-title-component).",
};

// Rule ui-keyboard-operable, ui-visible-labels, i18n-strings-from-messages: jsx-a11y and react rules
// for pages and components (eslint-config-next loads both plugins).
const UI_PLUGIN_RULES = {
  "jsx-a11y/click-events-have-key-events": "error",
  "jsx-a11y/no-static-element-interactions": "error",
  "jsx-a11y/no-noninteractive-element-interactions": "error",
  // A label names its control with htmlFor (nesting can't be checked: a {t(...)} child counts as a control).
  "jsx-a11y/label-has-associated-control": ["error", { labelComponents: ["Label", "FieldLabel"], assert: "htmlFor" }],
  // Text in JSX comes from t(); punctuation between translated parts is fine.
  "react/jsx-no-literals": ["error", { noStrings: false, allowedStrings: ["·", "•", "|", "/", "-", "–", "—", ":", "(", ")", "*", "…", "×", "+", "%", ","] }],
};
const UI_PLUGIN_OFF = Object.fromEntries(Object.keys(UI_PLUGIN_RULES).map((name) => [name, "off"]));

// Team syntax selectors, one list per file set. Each entry is { selector, message }, and the
// message ends with "(rule <rule-id>)". esquery regexes can't contain "/".
// All app code (CODE), as errors.
const CODE_SYNTAX = [
  {
    selector: `CallExpression[callee.name=${TRANSPORT}] > TemplateLiteral > :matches(Identifier, MemberExpression)`,
    message: "Encode each path segment: `items/${segment(id)}`, not `items/${id}` (rule action-encode-path-segments).",
  },
  {
    selector: "TryStatement:not(:has(CallExpression[callee.name='unstable_rethrow'])) > BlockStatement.block CallExpression[callee.name=/^(redirect|permanentRedirect)$/]",
    message: "redirect() throws: call it after the try/catch, or rethrow with unstable_rethrow() in the catch (rule action-redirect-last).",
  },
  {
    selector: "ExpressionStatement[expression.callee.name=/^(redirect|permanentRedirect)$/] ~ *",
    message: "Nothing after redirect() runs: update the cache first and redirect last (rule action-redirect-last).",
  },
  {
    selector: "CallExpression:matches([callee.name='setInterval'], [callee.property.name='setInterval']) CallExpression:matches([callee.name=/^(refetch|fetch)$/], [callee.property.name=/^(refetch|invalidateQueries|refetchQueries)$/])",
    message: "Poll with the query's refetchInterval, not setInterval (rule data-poll-with-refetchinterval).",
  },
  {
    selector: "MemberExpression[object.name='z'][property.name='coerce']",
    message: "Convert in the control's binding; z.coerce makes the schema's input type unknown (rule forms-controls-match-schema-type).",
  },
  {
    selector: "CallExpression[callee.name='useForm']:not([arguments.0.type='Identifier']):not(:has(Property[key.name='defaultValues']))",
    message: "Give useForm defaultValues for every field (rule forms-default-values).",
  },
  {
    selector: "CallExpression[callee.name='useForm']:not([arguments.0.type='Identifier']):not(:has(Property[key.name='mode'][value.value='onTouched']))",
    message: "Validate on touch: useForm({ mode: \"onTouched\" }) (rule forms-validate-on-touch).",
  },
  {
    selector: "CallExpression[callee.property.name=/^(email|url|uuid|guid|cuid|cuid2|ulid|ip|ipv4|ipv6|cidr|datetime|date|time|duration|base64|base64url|jwt|nanoid|emoji)$/] > MemberExpression.callee CallExpression[callee.object.name='z'][callee.property.name='string']",
    message: "zod 4 string formats are top-level: z.email(), z.url(), z.uuid(), z.iso.date() (rule forms-zod-4-api).",
  },
  {
    selector: "CallExpression[callee.type='MemberExpression']:has(Identifier[name='z']) > ObjectExpression > Property[key.name='message']",
    message: "zod 4 takes { error: \"...\" }, not { message } (rule forms-zod-4-api).",
  },
  {
    selector: "CallExpression[callee.property.name='flatten'][arguments.length=0]",
    message: "Flatten zod errors with z.flattenError(err), not err.flatten() (rule forms-zod-4-api).",
  },
  {
    selector: `${LOG} > TemplateLiteral > :matches(Identifier[name=/^(e|err|error)$/], MemberExpression[property.name='message'])`,
    message: "Pass the error as { err } and keep the message constant (rule log-errors-under-err).",
  },
  {
    selector: `${LOG} > ObjectExpression > Property[key.name=/^(error|e|exception)$/]`,
    message: "Log the error under the key err, so pino serialises its type, message and stack (rule log-errors-under-err).",
  },
  {
    selector: `:matches(${LOG} > MemberExpression, ${LOG} > ObjectExpression > Property[key.type='Identifier'] > MemberExpression.value)[property.name='message']`,
    message: "Log the error object as { err }, not err.message alone (rule log-errors-under-err).",
  },
  {
    selector: `:matches(${LOG} CallExpression[callee.object.name='Object'][callee.property.name='fromEntries'], ${LOG} Property[value.type='MemberExpression'][value.property.name='headers'], ${LOG} SpreadElement[argument.property.name='headers'], ${LOG} > MemberExpression[property.name='headers'])`,
    message: "Log the headers you need through an allow-list (safeHeaders(h)), never all of them (rule log-no-whole-headers).",
  },
  {
    selector: `:matches(${LOG} > TemplateLiteral:not([expressions.length=0]), ${LOG} > BinaryExpression[operator='+'])`,
    message: "Keep the log message a constant phrase and put the data in fields: log.info({ \"item.id\": id }, \"item saved\") (rule log-structured-request-id).",
  },
  {
    selector: "Property[key.name=/[a-z][A-Z]/][value.type='MemberExpression'][value.property.name=/^[a-z][a-z0-9]*(_[a-z0-9]+)+$/]",
    message: "Use the API's snake_case names as they are (the generated types), not a camelCase copy (rule contract-snake-case-names).",
  },
  {
    selector: `:matches(${TEXT_PROPS} > Literal, ${TEXT_PROPS} > JSXExpressionContainer > Literal)[value=/[A-Za-z]/], ${TEXT_PROPS} > JSXExpressionContainer > TemplateLiteral > TemplateElement[value.raw=/[A-Za-z]/]`,
    message: "Labels, placeholders, titles and alt text come from t(\"...\"), not a literal string (rule i18n-strings-from-messages).",
  },
  {
    selector: `:matches(${TOAST} > :matches(Literal[value=/[A-Za-z]/], TemplateLiteral), ${TOAST} > ObjectExpression > Property[key.name=/^(description|loading|success|error)$/] > :matches(Literal, TemplateLiteral))`,
    message: "Toast text comes from t(\"...\"), not a literal string (rule i18n-strings-from-messages).",
  },
  {
    selector: `:matches(BinaryExpression[operator='+'], TemplateLiteral) > ${T_CALL}`,
    message: "Put the variables in the message (t(\"deletedCustomers\", { count })), don't glue translations together (rule i18n-variables-not-concatenation).",
  },
  {
    selector: `${IMPORT_SOURCE}[source.value=/^[.][.].[.][.]/]`,
    message: "Import shared code through the @/ aliases; relative imports stay inside the route folder (rule struct-use-aliases).",
  },
  {
    selector: String.raw`${IMPORT_SOURCE}[source.value=/^@[^\x2F]+\x2F[^\x2F]+\x2Fsrc($|\x2F)/]`,
    message: "Import a package by its name and exports (@acme/ui/button), never its src/ folder (rule struct-no-cross-app-imports).",
  },
  {
    selector: `${IMPORT_SOURCE}[source.value=${ICON_PACKAGES}]`,
    message: "Icons come from lucide-react; a brand glyph is a component in components/<brand>-ui/icons/ (rule ui-icon-library-lucide).",
  },
  {
    selector: sizedIconIn("/^Button/"),
    message: "The button sizes and spaces its icon: mark it data-icon=\"inline-start\" or \"inline-end\", no size or margin classes (rule ui-button-icon-data-icon).",
  },
  {
    selector: sizedIconIn(ICON_PARENTS),
    message: "Menu, select, badge, alert, tab and sidebar items size their icons: drop the size and margin classes (rule ui-icon-no-size-in-primitives).",
  },
  {
    selector: "JSXOpeningElement[name.name=/Button/] > JSXAttribute[name.name=/^(isLoading|loading)$/]",
    message: "Buttons have no loading prop: disable with disabled={x.isPending} and show the spinner icon (rule ui-button-pending-state).",
  },
  {
    selector: "JSXElement[openingElement.name.name='Card'] JSXElement[openingElement.name.name='Card']",
    message: "Don't nest a Card in a Card: a card frames one unit (rule ui-cards-group-not-decorate).",
  },
  {
    // next/font class names (`${geistSans.variable} antialiased` on <body>) aren't conditional.
    selector: "JSXAttribute[name.name='className'] > JSXExpressionContainer > :matches(BinaryExpression[operator='+'], TemplateLiteral[expressions.length>0]:not(:has(> MemberExpression[property.name='variable'])))",
    message: "Merge classes with cn(\"...\", condition && \"...\", className), not + or a template string (rule ui-cn-merge-classes).",
  },
  {
    selector: "JSXAttribute[name.name='className'] CallExpression[callee.property.name='join']",
    message: "Merge classes with cn(...), not .join(\" \") (rule ui-cn-merge-classes).",
  },
  {
    selector: String.raw`:matches(JSXAttribute[name.name='className'], CallExpression[callee.name=/^(cn|cva|clsx)$/]) TemplateLiteral > TemplateElement:matches([value.raw=/[a-z0-9]-(\[)?$/], [value.raw=/^(-[a-z0-9]|\])/])`,
    message: "Tailwind only generates complete class names: pick a full class string from a lookup or cva, don't interpolate part of one (rule ui-literal-class-names).",
  },
  {
    selector: classText(String.raw`(^|[\s:])-?space-[xy]-`),
    message: "Space children with flex or grid and gap-*, not space-x-* / space-y-* (rule ui-gap-not-space).",
  },
  {
    // A color, not a width or shadow size (dark:border-0, dark:shadow-none).
    selector: classText(String.raw`(^|[\s:])dark:([a-z-]+:)*(bg|text|border|ring|fill|stroke|divide|outline|from|via|to|shadow)-(?!(none|sm|md|lg|xl|2xl|inner|[0-9]+)(\s|$))`),
    message: "Tokens already change per mode: fix or add the token instead of a dark: color override (rule ui-no-dark-overrides).",
  },
  {
    selector: String.raw`JSXOpeningElement[name.name=${OVERLAY_CONTENT}] > JSXAttribute[name.name='className'] Literal[value=/(^|\s)-?z-/]`,
    message: "Overlays stack through their portals: no z-index on dialog, sheet, popover, menu or tooltip content (rule ui-no-overlay-z-index).",
  },
  {
    selector: "JSXOpeningElement[name.name=/^(div|span|li|td|TableCell)$/] > JSXAttribute[name.name='onClick']",
    message: "A click target is a Button or a Link, so the keyboard reaches it (rule ui-keyboard-operable).",
  },
  {
    selector: "JSXOpeningElement[name.name=/^(TableRow|tr)$/] > JSXAttribute[name.name='onClick']",
    message: "Open the record from a link on the primary cell and put actions in the last column, not onClick on the row (rule ui-table-row-actions).",
  },
  {
    selector: UNNAMED_ICON_BUTTON,
    message: "An icon-only button needs a name: aria-label={t(\"...\")} (rule ui-visible-labels).",
  },
  {
    selector: String.raw`JSXElement[openingElement.name.name='TableHead']:not(:has(> :matches(JSXElement, JSXFragment, JSXExpressionContainer[expression.type!='JSXEmptyExpression'], JSXText[value=/\S/])))`,
    message: "Every column has a header; an actions column gets a visually hidden one (<span className=\"sr-only\">) (rule ui-table-headers-numbers).",
  },
];
// All app code (CODE), as warnings: shapes a person confirms.
const CODE_SYNTAX_WARN = [
  { selector: `Literal[value=/${PALETTE}/]`, message: COLOR_MESSAGE },
  { selector: `TemplateElement[value.raw=/${PALETTE}/]`, message: COLOR_MESSAGE },
  // The transport calls are errors above (action-encode-path-segments); translations and log lines aren't paths.
  {
    selector: `CallExpression:not([callee.name=${TRANSPORT}]):not([callee.name='t']):not([callee.object.name=/^(log|logger)$/]) > TemplateLiteral > :matches(Identifier[name=${ID_NAME}], MemberExpression[property.name=${ID_NAME}])`,
    message: "If this template is a request path, encode the id: `items/${encodeURIComponent(id)}` (rule contract-opaque-encoded-ids).",
  },
  {
    selector: String.raw`:matches(Literal[value=/(^|\s)fixed(\s|$)/][value=/(^|\s)inset-0(\s|$)/], TemplateElement[value.raw=/(^|\s)fixed(\s|$)/][value.raw=/(^|\s)inset-0(\s|$)/])`,
    message: "A full-screen fixed layer is an overlay: use Dialog, Sheet or Drawer, which handle focus and Escape (rule ui-existing-primitive-first).",
  },
];
// Pages and components (UI), as errors.
const UI_SYNTAX = [
  {
    selector: "CallExpression[callee.property.name='setState'][callee.object.name=/^use[A-Z]/]",
    message: "Change store state through a named action the store defines (rule store-named-actions).",
  },
  {
    selector: ":matches(FunctionDeclaration[id.name=/^[A-Z]/], VariableDeclarator[id.name=/^[A-Z]/] > ArrowFunctionExpression) > BlockStatement > ExpressionStatement > CallExpression:matches([callee.property.name='setState'], [callee.object.callee.property.name='getState'])",
    message: "Don't set store state while rendering: seed it through the provider, change it in a handler or effect (rule store-no-set-during-render).",
  },
  {
    selector: "JSXOpeningElement[name.name=/^(Switch|Checkbox|Select|RadioGroup|Slider|Combobox|NumberField)$/] > JSXSpreadAttribute > CallExpression:matches([callee.name='register'], [callee.property.name='register'])",
    message: "Bind callback controls with Controller (checked/onCheckedChange, value/onValueChange), not register (rule forms-controller-for-callback-controls).",
  },
  {
    selector: "JSXOpeningElement:has(JSXAttribute[name.name='type'][value.value='number']):not(:has(JSXAttribute[name.name='onChange'])) > JSXSpreadAttribute[argument.name='field']",
    message: "A number input gives a string: bind value and onChange to produce number | null (rule forms-controls-match-schema-type).",
  },
  {
    selector: "JSXOpeningElement[name.name='Select']:not(:has(JSXAttribute[name.name='items'])):not(:has(JSXSpreadAttribute))",
    message: "Pass items to Select so the trigger shows the label, not the value (rule forms-select-items-labels).",
  },
  {
    selector: "JSXAttribute[name.name='disabled'] Identifier[name='isValid']",
    message: "Keep submit enabled while the form is invalid; disable it only while the mutation is pending (rule forms-submit-enabled-when-invalid).",
  },
  {
    selector: "JSXOpeningElement[name.name='form']:not(:has(JSXAttribute[name.name='noValidate'])):not(:has(JSXSpreadAttribute))",
    message: "Add noValidate to the <form>: zod is the only validator (rule forms-validate-on-touch).",
  },
  {
    selector: ":matches(CallExpression[callee.property.name=/^toLocale(Date|Time)?String$/], NewExpression[callee.object.name='Intl'], CallExpression[callee.object.name='Intl'])",
    message: "Format numbers and dates with useFormatter() or the shared formatter, not toLocaleString() or Intl (rule i18n-use-formatters).",
  },
  {
    selector: "JSXOpeningElement[name.name=/^(select|dialog)$/]",
    message: "Use the Select or Dialog primitive, which handle the keyboard, focus and theming (rule ui-existing-primitive-first).",
  },
  {
    selector: "JSXOpeningElement[name.name=/^(table|thead|tbody|tfoot|tr|th|td)$/]",
    message: "Build tables from the Table primitive (Table, TableHeader, TableRow, TableCell) and the list composites (rule ui-table-primitive).",
  },
  INLINE_SVG,
];
// Routes (APP), as errors.
const APP_SYNTAX = [
  {
    selector: `${IMPORT_SOURCE}[source.value=/shadcn-ui.alert-dialog$/]`,
    message: "Ask with the confirm composite (await confirm({ title, destructive: true })), not a hand-built AlertDialog (rule ui-confirm-composite).",
  },
  PAGE_H1,
];
// Route entry pages (PAGES), as errors.
const PAGE_SYNTAX = [
  {
    selector: "Program > ExpressionStatement[directive='use client']",
    message: "Keep page.tsx a server component: move the state, queries and handlers into its <Name>Client component (rule page-thin-server-page).",
  },
];
// Unit and component tests (UNIT_TESTS), as errors. A last-resort test id carries a disable comment with the reason.
const TEST_SYNTAX = [
  {
    selector: "CallExpression:matches([callee.name=/^(get|query|find)(All)?ByTestId$/], [callee.property.name=/^(get|query|find)(All)?ByTestId$/])",
    message: "Find elements by role and name (getByRole(\"button\", { name: \"Save\" })) or label, not a test id (rule page-test-query-by-role).",
  },
];
// Browser code (CLIENT), as errors.
const CLIENT_SYNTAX = [];
// Pages, components and browser code (VIEW: UI and CLIENT, but not route handlers), as errors.
const VIEW_SYNTAX = [
  {
    selector: "Property[key.name='queryKey'] > ArrayExpression",
    message: "Build query keys with the services registry's factory (items.key(scope)), not an inline array (rule data-query-key-factory).",
  },
  {
    selector: "Property[key.name='queryFn']",
    message: "Spread the query options from the services registry (useQuery(items.list(scope))); don't write queryFn here (rule data-query-options-from-registry).",
  },
  {
    selector: "MemberExpression[object.object.name='process'][object.property.name='env']:not([property.name='NODE_ENV'])",
    message: "Only the config reader and the data layer read process.env (rule sec-env-access-limited).",
  },
  {
    selector: "VariableDeclarator[init.object.name='process'][init.property.name='env']",
    message: "Only the config reader and the data layer read process.env (rule sec-env-access-limited).",
  },
];
// The proxy (PROXY), as errors.
const PROXY_SYNTAX = [
  {
    selector: "VariableDeclarator[id.name='config'] Property[key.name='matcher']:not([value.type=/^(ArrayExpression|Literal)$/])",
    message: "config.matcher must be literal strings Next reads at build time; keep it in step with the prefix list with a test (rule bff-matcher-matches-prefixes).",
  },
  {
    selector: "VariableDeclarator[id.name='config'] Property[key.name='matcher'] > ArrayExpression > :not(Literal, ObjectExpression)",
    message: "config.matcher must be literal strings Next reads at build time; keep it in step with the prefix list with a test (rule bff-matcher-matches-prefixes).",
  },
];
// Playwright specs and config (E2E and playwright.config.*), as errors. The limits are the team's
// (nextjs-e2e playwright.config.ts: maxDiffPixelRatio 0.01; Playwright's default threshold 0.2).
const E2E_SYNTAX = [
  {
    selector: ":matches(Property[key.name='maxDiffPixelRatio'][value.value>0.01], Property[key.name='maxDiffPixels'][value.value>=100], Property[key.name='threshold'][value.value>0.2])",
    message: "Mask the dynamic region (mask: [locator] or stylePath) instead of raising the threshold (rule e2e-mask-dynamic-regions).",
  },
];

// Each file set's own copy of no-restricted-syntax (see the header).
const restrictedSyntax = builtinRules.get("no-restricted-syntax");
const team = {
  rules: {
    "syntax-code": restrictedSyntax,
    "syntax-code-warn": restrictedSyntax,
    "syntax-ui": restrictedSyntax,
    "syntax-client": restrictedSyntax,
    "syntax-view": restrictedSyntax,
    "syntax-proxy": restrictedSyntax,
    "syntax-e2e": restrictedSyntax,
    "syntax-app": restrictedSyntax,
    "syntax-page": restrictedSyntax,
    "syntax-test": restrictedSyntax,
  },
};
const TEAM_SYNTAX_OFF = Object.fromEntries(Object.keys(team.rules).map((name) => [`team/${name}`, "off"]));
// A rule with an empty list does nothing; skip it so the config stays readable in --print-config.
const syntax = (level, list) => (list.length ? [level, ...list] : "off");

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "out/**", "build/**", "coverage/**", "next-env.d.ts", "node_modules/**"]),
  { plugins: { team } },

  // Rule ui-one-primitives-folder, forms-no-alert-confirm, and the team syntax rules for all app code.
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
      "team/syntax-code": syntax("error", CODE_SYNTAX),
      "team/syntax-code-warn": syntax("warn", CODE_SYNTAX_WARN),
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

  // The team syntax rules for pages and components.
  {
    files: UI,
    rules: { "team/syntax-ui": syntax("error", UI_SYNTAX) },
  },
  // Brand icons draw their own <svg> (rule ui-icon-library-lucide).
  {
    files: ICONS_DIR,
    rules: { "team/syntax-ui": syntax("error", UI_SYNTAX.filter((entry) => entry !== INLINE_SVG)) },
  },

  // Rule ui-keyboard-operable, ui-visible-labels, i18n-strings-from-messages (UI_PLUGIN_RULES).
  {
    files: UI,
    rules: UI_PLUGIN_RULES,
  },

  // Rule struct-no-cross-app-imports: no relative import into another package of a monorepo.
  {
    files: CODE,
    rules: { "import/no-relative-packages": "error" },
  },

  // The team syntax rules for routes (ui-confirm-composite, ui-page-title-component) and for
  // route pages (page-thin-server-page). Error and not-found pages render their own heading.
  {
    files: APP,
    rules: { "team/syntax-app": syntax("error", APP_SYNTAX) },
  },
  {
    files: APP_OWN_HEADING,
    rules: { "team/syntax-app": syntax("error", APP_SYNTAX.filter((entry) => entry !== PAGE_H1)) },
  },
  {
    files: PAGES,
    rules: { "team/syntax-page": syntax("error", PAGE_SYNTAX) },
  },

  // The team syntax rules for pages, components and browser code (queries from the registry, no process.env).
  {
    files: VIEW,
    ignores: SERVER_ENTRY,
    rules: { "team/syntax-view": syntax("error", VIEW_SYNTAX) },
  },

  // Rule forms-field-array-keys: rows (useFieldArray rows above all) are keyed by a stable id, never the index.
  {
    files: CODE,
    ignores: [...PRIMITIVES_DIR, ...TESTS],
    rules: { "react/no-array-index-key": "error" },
  },

  // Rule bff-writes-via-apiaction: server actions write through apiAction, never their own fetch or axios.
  {
    files: ACTIONS,
    rules: {
      "no-restricted-imports": ["error", { paths: [{ name: "axios", message: APIACTION }], patterns: [PRIMITIVES] }],
      "no-restricted-globals": ["error", ...DIALOGS, { name: "fetch", message: APIACTION }],
    },
  },

  // Rule struct-server-only: browser code doesn't import the server-only BFF folder.
  {
    files: CLIENT,
    rules: {
      "no-restricted-imports": ["error", { paths: [AXIOS], patterns: [PRIMITIVES, SERVER_API] }],
      "team/syntax-client": syntax("error", CLIENT_SYNTAX),
    },
  },

  // The generated primitives are the CLI's output: their colors, dialogs and markup are reviewed upstream.
  {
    files: PRIMITIVES_DIR,
    rules: { ...TEAM_SYNTAX_OFF, ...UI_PLUGIN_OFF },
  },

  // Tests, scripts and config files may log, fetch and use any color.
  {
    files: TESTS,
    rules: { "no-console": "off", "no-restricted-globals": "off", ...TEAM_SYNTAX_OFF, ...UI_PLUGIN_OFF },
  },

  // Rule page-test-query-by-role (ui-test-by-role), testing-library/no-container and no-node-access:
  // tests find elements by role, name or label. Rule forms-test-like-a-user, testing-library/prefer-user-event:
  // tests type and click with user-event, not fireEvent.
  {
    files: UNIT_TESTS,
    plugins: { "testing-library": testingLibrary },
    rules: {
      "testing-library/no-container": "error",
      "testing-library/no-node-access": "error",
      "testing-library/prefer-user-event": "error",
      "team/syntax-test": syntax("error", TEST_SYNTAX),
    },
  },

  // Rule bff-matcher-matches-prefixes: the proxy's config.matcher is a literal.
  {
    files: PROXY,
    rules: { "team/syntax-proxy": syntax("error", PROXY_SYNTAX) },
  },

  // Rule bff-no-env-in-next-config: next.config runs at build and again at start; read settings per request in proxy.ts.
  {
    files: NEXT_CONFIG,
    rules: {
      "no-restricted-properties": [
        "error",
        { object: "process", property: "env", message: "next.config is evaluated at build and at start: move the setting to proxy.ts or src/configs (rule bff-no-env-in-next-config)." },
      ],
    },
  },

  // Rule e2e-spec-suffix: Playwright specs are .spec.ts and Vitest tests .test.ts(x), never the other way round.
  {
    files: UNIT_TESTS,
    rules: {
      "no-restricted-imports": [
        "error",
        { paths: [{ name: "@playwright/test", allowTypeImports: true, message: "A Playwright spec is named *.spec.ts; Vitest runs *.test.ts(x) (rule e2e-spec-suffix)." }], patterns: [PRIMITIVES] },
      ],
    },
  },
  {
    files: SPECS,
    rules: {
      "no-restricted-imports": [
        "error",
        { paths: [{ name: "vitest", message: "A Vitest test is named *.test.ts(x); Playwright runs *.spec.ts (rule e2e-spec-suffix)." }], patterns: [PRIMITIVES] },
      ],
    },
  },

  // Rule e2e-one-locator-one-element (playwright/no-nth-methods) and e2e-web-first-assertions
  // (playwright/prefer-web-first-assertions, playwright/prefer-to-have-count, playwright/missing-playwright-await).
  {
    files: E2E,
    plugins: { playwright },
    rules: {
      "playwright/no-nth-methods": "error",
      "playwright/prefer-web-first-assertions": "error",
      "playwright/prefer-to-have-count": "error",
      "playwright/missing-playwright-await": "error",
    },
  },

  // Rule e2e-mask-dynamic-regions: screenshot thresholds stay at the team's limits, in specs and the config.
  {
    files: [...E2E, "playwright.config.*"],
    rules: { "team/syntax-e2e": syntax("error", E2E_SYNTAX) },
  },
]);
