// The server logger from nextjs-logging (references/server-logger.md is the source of truth;
// keep this copy in step with it). JSON to stdout, ECS field names, secrets redacted.
import "server-only";
import pino, { type Logger } from "pino";
import { headers } from "next/headers";

const REDACT = [
  "*.authorization", "*.cookie", "*.password", "*.secret", "*.token", "*.access", "*.refresh",
  "*.code", "*.client_secret", "*.apiKey",
  "req.headers.authorization", "req.headers.cookie", 'res.headers["set-cookie"]',
];

function build(): Logger {
  const dev = process.env.NODE_ENV === "development";
  return pino({
    level: process.env.LOG_LEVEL ?? (dev ? "debug" : "info"),
    base: { "service.name": process.env.SERVICE_NAME ?? "web" },
    messageKey: "message",
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: { level: (label) => ({ "log.level": label }) },
    redact: { paths: REDACT, censor: "[redacted]" },
    transport: dev ? { target: "pino-pretty", options: { colorize: true } } : undefined,
  });
}

const g = globalThis as unknown as { __logger?: Logger };
export const logger: Logger = (g.__logger ??= build());   // one instance across dev hot reloads

/** A child logger carrying the current request's id; use in route handlers, actions and server components. */
export async function requestLogger(bindings: Record<string, unknown> = {}): Promise<Logger> {
  const id = (await headers()).get("x-request-id") ?? undefined;
  return logger.child({ "http.request.id": id, ...bindings });
}
