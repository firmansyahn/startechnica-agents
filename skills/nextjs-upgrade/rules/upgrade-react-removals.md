---
title: Remove the React APIs that React 18 and 19 dropped
impact: HIGH
tags: upgrade, react-18, react-19
check: scan (candidates)
---

## Remove the React APIs that React 18 and 19 dropped

**Impact: HIGH** (removed APIs crash at run time or silently stop working; the type changes fail the typecheck across the app)

An app coming from Next 12 crosses React 17 → 18 → 19.

- **React 18 types:** `React.FC` no longer adds `children`; declare it.
- **React 19 removals:**
  - `defaultProps` on function components (use parameter defaults) and `propTypes` checks (use TypeScript);
  - string refs, legacy context (`contextTypes`, `getChildContext`), `findDOMNode`;
  - `ReactDOM.render`, `hydrate` and `unmountComponentAtNode`;
  - `act` from `react-dom/test-utils` (import it from `react`).
- **React 19 types:** `useRef()` needs an argument, and `JSX` is `React.JSX`.

The upgrade command runs the React 19 codemods when it upgrades React; this rule covers what they leave.

**Incorrect:**

```tsx
function Badge({ label, tone }: Props) { return <span className={tone}>{label}</span>; }
Badge.defaultProps = { tone: "neutral" };
const Card: React.FC<{ title: string }> = ({ title, children }) => <section>{title}{children}</section>;
const input = useRef();
```

**Correct:**

```tsx
function Badge({ label, tone = "neutral" }: Props) { return <span className={tone}>{label}</span>; }
function Card({ title, children }: { title: string; children: React.ReactNode }) { return <section>{title}{children}</section>; }
const input = useRef<HTMLInputElement>(null);
```

**How to check:** `scripts/scan.sh` flags `.defaultProps =`, `.propTypes =`, string `ref="..."`, legacy context, `findDOMNode`, `ReactDOM.render`/`hydrate`/`unmountComponentAtNode`, `react-dom/test-utils`, `useRef()` with no argument and the global `JSX.` namespace. `defaultProps` on a class component still works: confirm each hit. `tsc --noEmit` with `@types/react` 19 finds the rest.
