import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";

/** The app's build identity, as the backend reports its own. */
export interface AppBuild {
  version: string;
  commit: string;
}

const DEV = "dev";

/** Where the image build writes the app's build (Dockerfile), beside package.json. */
export const BUILD_FILE = "build.json";

function field(value: unknown): string {
  return typeof value === "string" && value.trim() ? value.trim() : DEV;
}

/**
 * The app's own build, for a version page. The image build writes build.json from the APP_VERSION
 * and GIT_SHA build arguments, after `next build`, so a new commit doesn't rebuild the app. It is
 * read on the server when asked, never inlined into the bundle. A run without the file (`yarn dev`,
 * a local build) reports "dev".
 */
export async function appBuild(file = path.join(process.cwd(), BUILD_FILE)): Promise<AppBuild> {
  try {
    const parsed: unknown = JSON.parse(await readFile(file, "utf8"));
    const record = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
    return { version: field(record.version), commit: field(record.commit) };
  } catch {
    return { version: DEV, commit: DEV };
  }
}
