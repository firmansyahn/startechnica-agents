// The web server's runtime settings, in one place. Server-only: never import this from a client
// component.
//
// Every value here is read from process.env when called, never at build time, so one image serves
// any environment (set them on the container). Call it from request-time code (server components
// after cookies()/headers()/connection(), route handlers, server actions, proxy.ts), not from
// module scope, and never from next.config. Do not add NEXT_PUBLIC_ variables for settings: Next
// inlines those into the bundle during `next build`.
//
// PORT and HOSTNAME are read by `next start` itself, not here. .env.example documents them all.

export type RuntimeConfig = {
  /** API_BASE_URL: the backend, as this server reaches it; proxy.ts and the BFF call it. */
  apiBaseURL: string;
  /** APP_BASE_URL: this app's public address (OAuth redirects, Secure cookies). */
  appBaseURL: string;
  /** APP_ENV, normalized: always "production" when NODE_ENV is production (any `next build`/`next start`). */
  appEnv: string;
  /** TIMEZONE: the default time zone for dates the server formats. */
  timezone: string;
  /** OAUTH_CLIENT_SECRET: the app's OAuth client secret (nextjs-bff). Required in production. */
  oauthClientSecret: string;
  /** REDIS_URL: the shared session store. Empty keeps sessions in this process (development only). */
  redisURL: string;
};

export function getRuntimeConfig(): RuntimeConfig {
  return {
    apiBaseURL: process.env.API_BASE_URL ?? "http://127.0.0.1:8080",
    appBaseURL: process.env.APP_BASE_URL ?? "http://127.0.0.1:3000",
    appEnv: process.env.NODE_ENV === "production" ? "production" : (process.env.APP_ENV ?? "development"),
    timezone: process.env.TIMEZONE ?? "UTC",
    oauthClientSecret: process.env.OAUTH_CLIENT_SECRET ?? "",
    redisURL: process.env.REDIS_URL ?? "",
  };
}
