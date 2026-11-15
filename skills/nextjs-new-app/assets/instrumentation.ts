// Uncaught server errors to the logger (nextjs-logging references/errors-and-reporting.md).
import type { Instrumentation } from "next";

export async function register() {
  // Start tracing here when the app has it (nextjs-logging: OpenTelemetry).
}

export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { logger } = await import("@/libs/logger");
  const digest = typeof err === "object" && err !== null && "digest" in err ? String(err.digest) : undefined;
  logger.error(
    {
      err,
      digest,
      "http.request.method": request.method,
      "url.path": request.path.split("?")[0],
      "http.request.id": [request.headers["x-request-id"]].flat()[0],
      "next.route": context.routePath,
      "next.route_type": context.routeType,
    },
    "request failed",
  );
};
