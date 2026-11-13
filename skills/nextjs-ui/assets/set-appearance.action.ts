// assets/set-appearance.action.ts — persist preset/font/mode into the session.
//
// STATUS: PLAN-DERIVED. Adapt the session API + validator name-list imports to
// the target repo. This assumes a getSession() handle with a .save() (iron or
// redis behind one interface). If the app uses cookies only, replace the body
// with a cookie write + revalidatePath/router.refresh on the client.
//
// One action, partial payload, per-field validation, merge (not replace).

"use server";

// ADAPT: your session entry point + its data shape
import { getSession } from "@/libs/session";
// ADAPT: your canonical name list (single source of truth, shared with CSS + config)
import { PRESETS as PRESET_NAMES } from "@/libs/appearance";
// OPTIONAL: your logging wrapper, if the repo wraps actions (e.g. withAction)
// import { withAction } from "@libs/logger";

const FONTS = ["inter", "system", "roboto", "geist"] as const;
const MODES = ["light", "dark", "system"] as const;

type Payload = {
  preset?: string;
  font?: string;
  mode?: (typeof MODES)[number];
};

function pick<T extends string>(
  value: string | undefined,
  allowed: readonly T[],
): T | undefined {
  if (value == null) return undefined;
  const v = value.toLowerCase() as T;
  return allowed.includes(v) ? v : undefined; // unknown -> undefined (field skipped)
}

export async function setAppearanceAction(input: Payload): Promise<void> {
  const session = await getSession();

  const preset = pick(input.preset, PRESET_NAMES as readonly string[]);
  const font = pick(input.font, FONTS);
  const mode = pick(input.mode, MODES);

  // Merge only the valid fields; leave the rest of session.theme intact.
  const current = session.theme ?? {};
  session.theme = {
    ...current,
    ...(preset ? { preset } : {}),
    ...(font ? { font } : {}),
    ...(mode ? { mode } : {}),
  };

  await session.save();
}

// If the repo wraps actions for logging/correlation, export the wrapped form:
// export const setAppearanceAction = withAction('setAppearanceAction', _setAppearanceAction);
//
// SessionData shape to add (in your session types):
//   theme?: { preset?: string; font?: string; mode?: 'light' | 'dark' | 'system' };
