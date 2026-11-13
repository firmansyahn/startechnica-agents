// The client-side transport the services registry builds on (nextjs-data). Reads go to the app's
// reads proxy (nextjs-bff); writes are server actions unwrapped by runAction.
import { ApiError, fromEnvelope, type Result } from "@/src/api/result";

/** Where the reads proxy lives, e.g. "/app/api". Adjust to the app's area. */
export const READS_BASE = "/app/api";

export type Scope = string | null | undefined;

/** Query keys: [domain, resource, ...params, scope] (`nextjs-data` Queries rules). */
export function serviceKey(domain: string, resource: string, params: readonly unknown[] = [], scope?: Scope) {
  return scope ? ([domain, resource, ...params, { scope }] as const) : ([domain, resource, ...params] as const);
}

function signIn(): never {
  const next = window.location.pathname + window.location.search;
  // A full navigation on purpose: sign-in is a server route that starts the OAuth flow (nextjs-bff),
  // and the client cache of the signed-out session must go. Adjust the path to the app's sign-in route.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign(`/sign-in?next=${encodeURIComponent(next)}`);
  throw new ApiError({ status: 401, message: "Sign in again" });
}

/** One read through the proxy. Throws ApiError on failure, so useQuery's `error` is typed. */
export async function read<T>(path: string, opts: { scope?: Scope; query?: Record<string, string | number | undefined> } = {}): Promise<T> {
  const url = new URL(`${READS_BASE}/${path}`, window.location.origin);
  for (const [k, v] of Object.entries(opts.query ?? {})) if (v !== undefined) url.searchParams.set(k, String(v));
  const headers: Record<string, string> = { accept: "application/json", "x-app-request": "1" };   // the proxy's same-site header
  if (opts.scope) headers["tenant-id"] = opts.scope;
  const res = await fetch(url, { headers, credentials: "same-origin" });
  if (res.status === 401) signIn();
  const body = await res.json().catch(() => undefined);
  const result = fromEnvelope<T>(res.status, body);
  if (!result.ok) throw new ApiError(result.error);
  return result.data;
}

/** Unwraps a server action's Result for useMutation: data on success, ApiError thrown on failure. */
export async function runAction<T>(call: () => Promise<Result<T>>): Promise<T> {
  let result: Result<T>;
  try {
    result = await call();
  } catch (err) {
    // A deploy changed the action ids while this page was open (nextjs-deploy references/replicas.md).
    if (err instanceof Error && /Server Action .* was not found|Failed to find Server Action/i.test(err.message)) {
      throw new ApiError({ status: 409, message: "The app was updated. Reload the page and try again." });
    }
    throw err;
  }
  if (!result.ok) {
    if (result.error.status === 401) signIn();
    throw new ApiError(result.error);
  }
  return result.data;
}
