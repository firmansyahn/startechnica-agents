import { describe, it, expect, vi } from "vitest";
import pino from "pino";

// Rule log-redaction-test (nextjs-logging): credentials logged at the depths the app uses come out
// redacted, through the logger's real REDACT list. Add a case when the app logs a new shape.
vi.mock("server-only", () => ({}));
const { REDACT } = await import("./logger");

function capture() {
  const lines: string[] = [];
  const log = pino({ redact: { paths: REDACT, censor: "[redacted]" } }, { write: (l: string) => lines.push(l) });
  return { log, text: () => lines.join("") };
}

describe("logger redaction (rule log-redaction-test)", () => {
  it("redacts credentials in request headers and bodies", () => {
    const { log, text } = capture();
    log.info({ req: { headers: { authorization: "Bearer abc", cookie: "s=1" } }, body: { password: "p4ss", token: "t0k" } }, "x");
    expect(text()).not.toMatch(/Bearer abc|s=1|p4ss|t0k/);
  });

  it("redacts OAuth values one level down", () => {
    const { log, text } = capture();
    log.info({ grant: { code: "c0de", client_secret: "s3cr3t", refresh: "r3fr" } }, "x");
    expect(text()).not.toMatch(/c0de|s3cr3t|r3fr/);
  });
});
