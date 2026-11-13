import { getRuntimeConfig } from "@/src/configs/runtime-config";

// Kubernetes probe paths (app/livez, app/readyz). Both answer from this process alone: the
// backend's own /readyz decides whether it takes traffic, and a web pod that waited on it would
// leave the Service whenever the backend blinked, taking the pages that don't need it down too.
export const probeHeaders = { "Cache-Control": "no-store" } as const;

export interface ReadinessEnv {
  apiBaseURL: string;
  /** Production needs the shared session store and the app's OAuth client secret; development does not. */
  production?: boolean;
  redisURL?: string;
  clientSecret?: string;
}

function fromEnvironment(): ReadinessEnv {
  const { apiBaseURL, redisURL, oauthClientSecret, appEnv } = getRuntimeConfig();
  return { apiBaseURL, production: appEnv === "production", redisURL, clientSecret: oauthClientSecret };
}

// Ready once the settings the proxy and the session layer rely on are usable. API_BASE_URL is read
// per request, so a bad value set on the container shows here instead of as a 500 on every proxied
// call. In production, sessions live in Redis/Valkey so that every replica sees them, and the app
// signs in with its client secret: a pod without either can't serve and leaves the Service.
// The reason names the variable, never its value.
export function readiness(env: ReadinessEnv = fromEnvironment()): { ready: boolean; reason?: string } {
  try {
    // "backend:8080" parses as a URL whose scheme is "backend:", so check the scheme too.
    const { protocol } = new URL(env.apiBaseURL);
    if (protocol !== "http:" && protocol !== "https:") throw new Error(protocol);
  } catch {
    return { ready: false, reason: "API_BASE_URL" };
  }
  if (env.production && !env.redisURL) return { ready: false, reason: "REDIS_URL" };
  if (env.production && !env.clientSecret) return { ready: false, reason: "OAUTH_CLIENT_SECRET" };
  return { ready: true };
}
