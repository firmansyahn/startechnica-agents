// The one reply shape for server actions and reads (go-nextjs-api-contract references/envelope-and-errors.md).
// Shared by server actions and the browser's runAction, so it holds no secret, uses no server API
// and doesn't import "server-only" (the one client-safe module in src/api/).
export type FieldErrors = Record<string, string[]>;
export interface Failure {
  status: number;
  message: string;
  fields?: FieldErrors;
}
export type Result<T> = { ok: true; data: T; total?: number } | { ok: false; error: Failure };

/** Thrown into TanStack Query's onError by runAction and by query functions. */
export class ApiError extends Error {
  readonly status: number;
  readonly fields?: FieldErrors;
  constructor(failure: Failure) {
    super(failure.message);
    this.name = "ApiError";
    this.status = failure.status;
    this.fields = failure.fields;
  }
}

function fallbackMessage(status: number): string {
  if (status === 401) return "Sign in again";
  if (status === 403) return "You don't have permission to do this";
  if (status === 404) return "Not found";
  if (status === 429) return "Too many requests";
  if (status >= 500) return "Something went wrong";
  return "The request was refused";
}

/** Maps the backend envelope ({ status, message, data, total?, errors? }) onto a Result. */
export function fromEnvelope<T>(status: number, body: unknown): Result<T> {
  const env = (body ?? {}) as { status?: string; message?: string; data?: T; total?: number; errors?: FieldErrors };
  if (status >= 200 && status < 300 && env.status !== "failed") return { ok: true, data: env.data as T, total: env.total };
  const failure: Failure = { status, message: env.message || fallbackMessage(status) };
  if (env.errors && typeof env.errors === "object") failure.fields = env.errors;
  return { ok: false, error: failure };
}

/** A short text for any thrown value, for toasts. */
export function errorText(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error && err.message) return err.message;
  return fallbackMessage(500);
}
