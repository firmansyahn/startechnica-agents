# Switching and persistence

## The three mechanisms

| | A. Device only | B. Mode per device, preset/font per user | C. Everything on the user's account |
|---|---|---|---|
| Mode (`.dark`) | next-themes (localStorage, its own no-flash script) | next-themes | server stamps `dark` from a cookie; constant script resolves `system` |
| Preset, font | fixed or env default | `data-theme`/`data-font` from the session, stamped by the root layout | `data-theme`/`data-font` from the cookie |
| Saved in | localStorage | localStorage (mode) + session (preset, font, and mode as a cross-device seed) | the backend profile; the backend writes the paint-hint cookie |
| Works signed out | yes | yes (mode); preset/font use defaults | defaults + device mode |
| Starting code | next-themes docs | `../assets/ThemeProvider.tsx`, `../assets/set-appearance.action.ts` (plan-derived: validate on first use) | `../assets/appearance.ts` (proven shape) |

The mechanisms differ in **who owns `.dark`**: next-themes (A, B) or the server plus one constant script (C). Never both.

## Where the choice comes from (first match wins)

1. The signed-in user's saved preference (session or backend profile).
2. The appearance cookie (C: `<app>_appearance=v1.<mode>.<preset>.<font>`, written by the server whenever the preference is saved or read; can be `HttpOnly`).
3. The device's choice (localStorage via next-themes in A/B).
4. The tenant's default (brand preset, default mode), in multi-tenant apps.
5. The deployment default from runtime config, validated:

```ts
function oneOf<T extends string>(value: string | undefined, allowed: readonly T[], fallback: T): T {
  const v = (value ?? "").trim().toLowerCase() as T;
  return allowed.includes(v) ? v : fallback;
}
themePresetDefault: oneOf(process.env.THEME_PRESET_DEFAULT, PRESETS, "default"),
themeFontDefault:   oneOf(process.env.THEME_FONT_DEFAULT, FONTS, "inter"),
themeModeDefault:   oneOf(process.env.THEME_MODE_DEFAULT, MODES, "light"),
```

Read per request (one image serves every deployment). `PRESETS`/`FONTS`/`MODES` are the single source of truth shared with the CSS blocks and every validator; a parity test keeps them in step.

## Painting without a flash

| Case | What paints it |
|---|---|
| Explicit light or dark (C) | Server: the layout reads the cookie and adds `dark` to `<html>` |
| System (C) | The constant inline script, before first paint, from `prefers-color-scheme`, and its `matchMedia` listener afterwards |
| Mode (A, B) | next-themes' own injected script |
| Preset and font (B, C) | Server: `data-theme` / `data-font` stamped by the root layout |

- The C script is first in `<head>`, a constant string (CSP-hashable), wrapped in `try/catch`. How it passes a nonce or hash CSP: `nextjs-security` references/csp-and-headers.md.
- `suppressHydrationWarning` on `<html>`; a mode control shows its resolved value only after mount.
- Check it in a real browser: reload each mode and preset and confirm `<html>` carries the right class and attributes at first paint (Playwright screenshots taken immediately after navigation, or an init script that records the attributes on `DOMContentLoaded`).

## The picker

```tsx
const save = useMutation({
  mutationFn: (next: Appearance) => runAction(() => savePreferences(next)),
  onMutate: (next) => { const prev = current(); applyAppearance(next); return prev; },
  onError: (_e, _next, prev) => prev && applyAppearance(prev),
  onSuccess: (saved) => queryClient.setQueryData(PROFILE_KEY, (p) => ({ ...p, appearance: saved })),
});
```

- Apply at once, save through a server action, revert on failure.
- The server action validates each field against the allow-lists and **merges** partial updates (changing the font doesn't reset the preset).
- In C, the server sets the cookie in the same request that saves; in B, the next server render reads the session.
- One root provider exposes mode and appearance to the app (B: next-themes wrapped inside it); don't mount a second provider lower to re-read the session.
- Radio groups per axis, each preset named (not only a swatch); `system` shows which mode it resolved to.

## Signed-out pages, tenants

- Sign-in and public pages use the tenant or deployment default plus the device's mode; they never read another user's preference. The first authenticated response sets the user's own.
- A tenant switch keeps the user's mode and font; the preset may follow the tenant's brand if the product says so. Apply it where the tenant switch is handled (cache clear and remount), not in each page.

## Tests

- `resolveAppearance` / validators: each axis falls back on its own; unknown version, extra parts, empty and non-string values give defaults.
- Root layout stamps `data-mode`, `data-theme`, `data-font` and `dark` from a cookie/session; no `dark` for `system`.
- Picker applies at once, calls the action with the change, reverts on failure; the action merges partial updates and refuses unknown values.
- Name parity: CSS blocks ⊇ option lists.
- Contrast for every preset × mode (`theme-presets.md`).
- Screenshots of a representative page for every preset × mode, looked at after any token change.
